import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PilotReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get weekly pilot report for a merchant
   */
  async getWeeklyReport(tenantId: string, week: string) {
    // Parse week (format: YYYY-WW)
    const [year, weekNum] = week.split('-').map(Number);
    const weekStart = this.getWeekStartDate(year, weekNum);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Get daily metrics for the week
    const dailyMetrics = await this.prisma.pilotDailyMetric.findMany({
      where: {
        tenantId,
        metricDate: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      orderBy: {
        metricDate: 'asc',
      },
    });

    // Aggregate weekly totals
    const weekly = dailyMetrics.reduce(
      (acc, day) => ({
        activeCustomers: Math.max(acc.activeCustomers, day.activeCustomers),
        repeatCustomers: Math.max(acc.repeatCustomers, day.repeatCustomers),
        transactionsIssue: acc.transactionsIssue + day.transactionsIssue,
        transactionsRedeem: acc.transactionsRedeem + day.transactionsRedeem,
        transactionsAdjust: acc.transactionsAdjust + day.transactionsAdjust,
        transactionsReverse: acc.transactionsReverse + day.transactionsReverse,
        transactionsTotal: acc.transactionsTotal + day.transactionsTotal,
        scanErrorsTotal: acc.scanErrorsTotal + day.scanErrorsTotal,
      }),
      {
        activeCustomers: 0,
        repeatCustomers: 0,
        transactionsIssue: 0,
        transactionsRedeem: 0,
        transactionsAdjust: 0,
        transactionsReverse: 0,
        transactionsTotal: 0,
        scanErrorsTotal: 0,
      },
    );

    // Calculate redemption rate (redeems / issues, capped at 1.0)
    const redemptionRate =
      weekly.transactionsIssue > 0
        ? Math.min(1, Number((weekly.transactionsRedeem / weekly.transactionsIssue).toFixed(4)))
        : 0;

    // Get top rewards
    const topRewards = await this.prisma.pilotRewardUsage.findMany({
      where: {
        tenantId,
        metricDate: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        reward: true,
      },
      orderBy: {
        redemptionCount: 'desc',
      },
      take: 5,
    });

    // Generate plain English summary
    const summary = this.generateSummary(weekly, redemptionRate, dailyMetrics.length);

    return {
      week,
      period: {
        start: weekStart.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0],
      },
      summary,
      metrics: {
        weekly,
        daily: dailyMetrics.map((m) => ({
          date: m.metricDate.toISOString().split('T')[0],
          activeCustomers: m.activeCustomers,
          repeatCustomers: m.repeatCustomers,
          transactionsIssue: m.transactionsIssue,
          transactionsRedeem: m.transactionsRedeem,
          redemptionRate: m.redemptionRate ? Number(m.redemptionRate) : 0,
          scanErrorsTotal: m.scanErrorsTotal,
        })),
      },
      topRewards: topRewards.map((r) => ({
        rewardId: r.rewardId,
        rewardName: r.reward.name,
        redemptionCount: r.redemptionCount,
      })),
      retention: {
        repeatCustomerRate:
          weekly.activeCustomers > 0
            ? Number((weekly.repeatCustomers / weekly.activeCustomers).toFixed(4))
            : 0,
      },
      operationalFriction: {
        manualAdjustments: weekly.transactionsAdjust,
        reversals: weekly.transactionsReverse,
        errorRate:
          weekly.transactionsTotal > 0
            ? Number((weekly.scanErrorsTotal / weekly.transactionsTotal).toFixed(4))
            : 0,
      },
    };
  }

  /**
   * Get onboarding funnel metrics
   */
  async getOnboardingFunnel(tenantId: string) {
    const funnel = await this.prisma.pilotOnboardingFunnel.findUnique({
      where: { tenantId },
    });

    if (!funnel) {
      return null;
    }

    return {
      tenantId,
      milestones: {
        merchantSignup: funnel.merchantSignupAt?.toISOString() || null,
        firstLocation: funnel.firstLocationCreatedAt?.toISOString() || null,
        firstStaff: funnel.firstStaffInvitedAt?.toISOString() || null,
        firstDevice: funnel.firstDeviceRegisteredAt?.toISOString() || null,
        firstScan: funnel.firstScanAt?.toISOString() || null,
      },
      durations: {
        timeToLocationMinutes: funnel.timeToLocationMinutes,
        timeToStaffMinutes: funnel.timeToStaffMinutes,
        timeToDeviceMinutes: funnel.timeToDeviceMinutes,
        timeToFirstScanMinutes: funnel.timeToFirstScanMinutes,
      },
      completion: {
        hasLocation: !!funnel.firstLocationCreatedAt,
        hasStaff: !!funnel.firstStaffInvitedAt,
        hasDevice: !!funnel.firstDeviceRegisteredAt,
        hasFirstScan: !!funnel.firstScanAt,
        isComplete: !!funnel.firstScanAt,
      },
    };
  }

  private getWeekStartDate(year: number, week: number): Date {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return ISOweekStart;
  }

  private generateSummary(
    weekly: any,
    redemptionRate: number,
    daysWithData: number,
  ): { improved: string[]; needsFixing: string[] } {
    const improved: string[] = [];
    const needsFixing: string[] = [];

    // Active customers
    if (weekly.activeCustomers > 0) {
      improved.push(`${weekly.activeCustomers} active customers this week`);
    } else {
      needsFixing.push('No active customers yet - need to process first scan');
    }

    // Repeat customers
    if (weekly.repeatCustomers > 0) {
      improved.push(`${weekly.repeatCustomers} repeat customers (good retention signal)`);
    } else if (weekly.activeCustomers > 5) {
      needsFixing.push('Low repeat customer rate - consider improving engagement');
    }

    // Redemption rate
    if (redemptionRate > 0.3) {
      improved.push(`Strong redemption rate: ${(redemptionRate * 100).toFixed(1)}%`);
    } else if (weekly.transactionsIssue > 10 && redemptionRate < 0.1) {
      needsFixing.push(`Low redemption rate: ${(redemptionRate * 100).toFixed(1)}% - customers may not see value`);
    }

    // Transaction volume
    if (weekly.transactionsTotal > 50) {
      improved.push(`Strong transaction volume: ${weekly.transactionsTotal} transactions`);
    } else if (daysWithData > 3 && weekly.transactionsTotal < 10) {
      needsFixing.push('Low transaction volume - check if staff are using the system');
    }

    // Errors
    if (weekly.scanErrorsTotal > weekly.transactionsTotal * 0.1) {
      needsFixing.push(`High error rate: ${weekly.scanErrorsTotal} errors - check device setup and QR tokens`);
    }

    // Manual interventions
    if (weekly.transactionsAdjust + weekly.transactionsReverse > 5) {
      needsFixing.push(`${weekly.transactionsAdjust + weekly.transactionsReverse} manual adjustments/reversals - consider process improvements`);
    }

    if (improved.length === 0) {
      improved.push('Getting started - first week of operations');
    }

    return { improved, needsFixing };
  }
}
