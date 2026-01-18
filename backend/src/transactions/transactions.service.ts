import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { OutboxService } from '../outbox/outbox.service';
import { FraudSignalsService } from '../fraud-signals/fraud-signals.service';
import { PilotMetricsService } from '../pilot-metrics/pilot-metrics.service';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
    private outboxService: OutboxService,
    private fraudSignalsService: FraudSignalsService,
    private pilotMetricsService: PilotMetricsService,
  ) {}

  async issuePoints(
    tenantId: string,
    customerId: string,
    amount: number,
    deviceId: string | null,
    idempotencyKey: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Check idempotency
    const existing = await this.prisma.transaction.findFirst({
      where: {
        tenantId,
        idempotencyKey,
      },
    });

    if (existing) {
      const balance = await this.ledgerService.getBalance(tenantId, customerId);
      return {
        id: existing.id,
        type: existing.type,
        amount: Number(existing.amount),
        status: existing.status,
        balance,
      };
    }

    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    // Validate device if provided
    if (deviceId) {
      const device = await this.prisma.device.findFirst({
        where: {
          id: deviceId,
          tenantId,
          isActive: true,
        },
      });

      if (!device) {
        throw new NotFoundException(`Device ${deviceId} not found or inactive`);
      }
    }

    // Create transaction and ledger entry atomically
    const result = await this.prisma.$transaction(async (tx) => {
      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          tenantId,
          customerId,
          type: 'ISSUE',
          amount,
          status: 'COMPLETED',
          idempotencyKey,
          deviceId,
        },
      });

      // Append ledger entry (idempotent)
      const ledgerEntry = await this.ledgerService.appendEntry(
        tenantId,
        customerId,
        amount,
        idempotencyKey,
        transaction.id,
        'ISSUE',
      );

      // Write outbox event (atomic with transaction)
      await this.outboxService.writeEvent(
        tenantId,
        'points.issued',
        {
          transactionId: transaction.id,
          customerId,
          amount,
          balanceAfter: ledgerEntry.balanceAfter,
          deviceId,
          idempotencyKey,
        },
        tx,
      );

      return { transaction, balanceAfter: ledgerEntry.balanceAfter };
    });

    // Track fraud signals
    await this.fraudSignalsService.trackScan(tenantId, deviceId, customerId);

    // Track onboarding milestone (first scan only)
    const funnel = await this.prisma.pilotOnboardingFunnel.findUnique({
      where: { tenantId },
    });
    if (!funnel?.firstScanAt) {
      await this.pilotMetricsService.trackOnboardingMilestone(tenantId, 'first_scan');
    }

    return {
      id: result.transaction.id,
      type: result.transaction.type,
      amount: Number(result.transaction.amount),
      status: result.transaction.status,
      balance: result.balanceAfter,
    };
  }

  async redeemPoints(
    tenantId: string,
    customerId: string,
    rewardId: string,
    idempotencyKey: string,
  ) {
    // Check idempotency
    const existing = await this.prisma.redemption.findFirst({
      where: {
        tenantId,
        idempotencyKey,
      },
    });

    if (existing && existing.status === 'COMPLETED') {
      const balance = await this.ledgerService.getBalance(tenantId, customerId);
      return {
        id: existing.id,
        status: existing.status,
        pointsDeducted: Number(existing.pointsDeducted),
        balance,
      };
    }

    // Get reward
    const reward = await this.prisma.reward.findFirst({
      where: {
        id: rewardId,
        tenantId,
        isActive: true,
      },
    });

    if (!reward) {
      throw new NotFoundException(`Reward ${rewardId} not found`);
    }

    const pointsRequired = Number(reward.pointsRequired);

    // Check balance with lock (SELECT FOR UPDATE)
    const result = await this.prisma.$transaction(async (tx) => {
      const balance = await this.ledgerService.getBalance(tenantId, customerId);

      if (balance < pointsRequired) {
        throw new BadRequestException('Insufficient points');
      }

      // Create redemption record
      const redemption = await tx.redemption.create({
        data: {
          tenantId,
          customerId,
          rewardId,
          pointsDeducted: pointsRequired,
          status: 'COMPLETED',
          idempotencyKey,
          completedAt: new Date(),
        },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          tenantId,
          customerId,
          type: 'REDEEM',
          amount: -pointsRequired,
          status: 'COMPLETED',
          idempotencyKey: `${idempotencyKey}-tx`,
        },
      });

      // Append ledger entry (negative amount)
      const ledgerEntry = await this.ledgerService.appendEntry(
        tenantId,
        customerId,
        -pointsRequired,
        idempotencyKey,
        transaction.id,
        'REDEEM',
      );

      // Write outbox event
      await this.outboxService.writeEvent(
        tenantId,
        'points.redeemed',
        {
          redemptionId: redemption.id,
          transactionId: transaction.id,
          customerId,
          rewardId,
          pointsDeducted: pointsRequired,
          balanceAfter: ledgerEntry.balanceAfter,
          idempotencyKey,
        },
        tx,
      );

      return { redemption, balanceAfter: ledgerEntry.balanceAfter };
    });

    // Track fraud signals
    await this.fraudSignalsService.trackRedemption(tenantId, customerId, true);

    return {
      id: result.redemption.id,
      status: result.redemption.status,
      pointsDeducted: Number(result.redemption.pointsDeducted),
      balance: result.balanceAfter,
    };
  }

  async redeemPointsFailure(tenantId: string, customerId: string) {
    // Track failed redemption
    await this.fraudSignalsService.trackRedemption(tenantId, customerId, false);
  }
}
