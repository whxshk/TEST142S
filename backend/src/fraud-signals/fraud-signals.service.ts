import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FraudSignalsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Track scan activity (called after successful scan)
   */
  async trackScan(tenantId: string, deviceId: string | null, customerId: string) {
    // Store in audit log with metadata for tracking
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'SCAN_EXECUTED',
        resourceType: 'transaction',
        resourceId: customerId,
        metadata: {
          deviceId,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Track redemption activity
   */
  async trackRedemption(tenantId: string, customerId: string, success: boolean) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: success ? 'REDEMPTION_SUCCESS' : 'REDEMPTION_FAILED',
        resourceType: 'redemption',
        resourceId: customerId,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Get misuse signals for a tenant
   */
  async getMisuseSignals(tenantId: string, deviceId?: string, customerId?: string) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Scans per device per hour
    const scansLastHour = await this.prisma.auditLog.count({
      where: {
        tenantId,
        action: 'SCAN_EXECUTED',
        createdAt: { gte: oneHourAgo },
      },
    });

    // Redemptions per customer per day
    const redemptionsLastDay = await this.prisma.auditLog.count({
      where: {
        tenantId,
        action: { in: ['REDEMPTION_SUCCESS', 'REDEMPTION_FAILED'] },
        createdAt: { gte: oneDayAgo },
        ...(customerId && { resourceId: customerId }),
      },
    });

    // Failed redemptions
    const failedRedemptions = await this.prisma.auditLog.count({
      where: {
        tenantId,
        action: 'REDEMPTION_FAILED',
        createdAt: { gte: oneDayAgo },
        ...(customerId && { resourceId: customerId }),
      },
    });

    return {
      scansLastHour,
      redemptionsLastDay,
      failedRedemptionsLastDay: failedRedemptions,
      signals: this.evaluateSignals(scansLastHour, redemptionsLastDay, failedRedemptions),
    };
  }

  private evaluateSignals(scans: number, redemptions: number, failures: number) {
    const signals: string[] = [];

    if (scans > 100) {
      signals.push('HIGH_SCAN_VOLUME');
    }

    if (redemptions > 20) {
      signals.push('HIGH_REDEMPTION_VOLUME');
    }

    if (failures > 5) {
      signals.push('REPEATED_FAILED_REDEMPTIONS');
    }

    return signals;
  }
}
