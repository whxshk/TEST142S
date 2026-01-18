import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PilotMetricsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Update daily metrics for a tenant/location
   */
  async updateDailyMetrics(
    tenantId: string,
    locationId: string | null,
    date: Date,
    updates: Partial<{
      activeCustomers: number;
      repeatCustomers: number;
      transactionsIssue: number;
      transactionsRedeem: number;
      transactionsAdjust: number;
      transactionsReverse: number;
      scanErrorsExpiredQr: number;
      scanErrorsInsufficientBalance: number;
      scanErrorsUnauthorizedDevice: number;
    }>,
  ) {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    await this.prisma.pilotDailyMetric.upsert({
      where: {
        tenantId_locationId_metricDate: {
          tenantId,
          locationId: locationId || '',
          metricDate: dateOnly,
        },
      },
      create: {
        tenantId,
        locationId: locationId || null,
        metricDate: dateOnly,
        activeCustomers: updates.activeCustomers || 0,
        repeatCustomers: updates.repeatCustomers || 0,
        transactionsIssue: updates.transactionsIssue || 0,
        transactionsRedeem: updates.transactionsRedeem || 0,
        transactionsAdjust: updates.transactionsAdjust || 0,
        transactionsReverse: updates.transactionsReverse || 0,
        transactionsTotal: (updates.transactionsIssue || 0) + 
                          (updates.transactionsRedeem || 0) + 
                          (updates.transactionsAdjust || 0) + 
                          (updates.transactionsReverse || 0),
        scanErrorsExpiredQr: updates.scanErrorsExpiredQr || 0,
        scanErrorsInsufficientBalance: updates.scanErrorsInsufficientBalance || 0,
        scanErrorsUnauthorizedDevice: updates.scanErrorsUnauthorizedDevice || 0,
        scanErrorsTotal: (updates.scanErrorsExpiredQr || 0) + 
                        (updates.scanErrorsInsufficientBalance || 0) + 
                        (updates.scanErrorsUnauthorizedDevice || 0),
      },
      update: {
        ...(updates.activeCustomers !== undefined && { activeCustomers: { increment: updates.activeCustomers } }),
        ...(updates.repeatCustomers !== undefined && { repeatCustomers: { increment: updates.repeatCustomers } }),
        ...(updates.transactionsIssue !== undefined && { transactionsIssue: { increment: updates.transactionsIssue } }),
        ...(updates.transactionsRedeem !== undefined && { transactionsRedeem: { increment: updates.transactionsRedeem } }),
        ...(updates.transactionsAdjust !== undefined && { transactionsAdjust: { increment: updates.transactionsAdjust } }),
        ...(updates.transactionsReverse !== undefined && { transactionsReverse: { increment: updates.transactionsReverse } }),
        ...(updates.scanErrorsExpiredQr !== undefined && { scanErrorsExpiredQr: { increment: updates.scanErrorsExpiredQr } }),
        ...(updates.scanErrorsInsufficientBalance !== undefined && { scanErrorsInsufficientBalance: { increment: updates.scanErrorsInsufficientBalance } }),
        ...(updates.scanErrorsUnauthorizedDevice !== undefined && { scanErrorsUnauthorizedDevice: { increment: updates.scanErrorsUnauthorizedDevice } }),
        transactionsTotal: {
          increment: (updates.transactionsIssue || 0) + 
                    (updates.transactionsRedeem || 0) + 
                    (updates.transactionsAdjust || 0) + 
                    (updates.transactionsReverse || 0),
        },
        scanErrorsTotal: {
          increment: (updates.scanErrorsExpiredQr || 0) + 
                    (updates.scanErrorsInsufficientBalance || 0) + 
                    (updates.scanErrorsUnauthorizedDevice || 0),
        },
      },
    });
  }

  /**
   * Track customer activity
   */
  async trackCustomerActivity(tenantId: string, customerId: string, transactionDate: Date) {
    await this.prisma.pilotCustomerActivity.upsert({
      where: {
        tenantId_customerId: {
          tenantId,
          customerId,
        },
      },
      create: {
        tenantId,
        customerId,
        firstTransactionAt: transactionDate,
        lastTransactionAt: transactionDate,
        transactionCount: 1,
      },
      update: {
        lastTransactionAt: transactionDate,
        transactionCount: { increment: 1 },
        ...(transactionDate < new Date() && { firstTransactionAt: transactionDate }),
      },
    });
  }

  /**
   * Track reward usage
   */
  async trackRewardUsage(tenantId: string, rewardId: string, date: Date) {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    await this.prisma.pilotRewardUsage.upsert({
      where: {
        tenantId_rewardId_metricDate: {
          tenantId,
          rewardId,
          metricDate: dateOnly,
        },
      },
      create: {
        tenantId,
        rewardId,
        metricDate: dateOnly,
        redemptionCount: 1,
      },
      update: {
        redemptionCount: { increment: 1 },
      },
    });
  }

  /**
   * Track onboarding milestone
   */
  async trackOnboardingMilestone(
    tenantId: string,
    milestone: 'merchant_signup' | 'first_location' | 'first_staff' | 'first_device' | 'first_scan',
  ) {
    const now = new Date();
    const updateData: any = {};

    switch (milestone) {
      case 'merchant_signup':
        updateData.merchantSignupAt = now;
        break;
      case 'first_location':
        updateData.firstLocationCreatedAt = now;
        break;
      case 'first_staff':
        updateData.firstStaffInvitedAt = now;
        break;
      case 'first_device':
        updateData.firstDeviceRegisteredAt = now;
        break;
      case 'first_scan':
        updateData.firstScanAt = now;
        break;
    }

    const funnel = await this.prisma.pilotOnboardingFunnel.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...updateData,
      },
      update: updateData,
    });

    // Calculate durations
    if (funnel.merchantSignupAt) {
      const durations: any = {};
      
      if (funnel.firstLocationCreatedAt) {
        durations.timeToLocationMinutes = Math.floor(
          (funnel.firstLocationCreatedAt.getTime() - funnel.merchantSignupAt.getTime()) / 60000
        );
      }
      if (funnel.firstStaffInvitedAt) {
        durations.timeToStaffMinutes = Math.floor(
          (funnel.firstStaffInvitedAt.getTime() - funnel.merchantSignupAt.getTime()) / 60000
        );
      }
      if (funnel.firstDeviceRegisteredAt) {
        durations.timeToDeviceMinutes = Math.floor(
          (funnel.firstDeviceRegisteredAt.getTime() - funnel.merchantSignupAt.getTime()) / 60000
        );
      }
      if (funnel.firstScanAt) {
        durations.timeToFirstScanMinutes = Math.floor(
          (funnel.firstScanAt.getTime() - funnel.merchantSignupAt.getTime()) / 60000
        );
      }

      if (Object.keys(durations).length > 0) {
        await this.prisma.pilotOnboardingFunnel.update({
          where: { tenantId },
          data: durations,
        });
      }
    }

    return funnel;
  }
}
