import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { OutboxService } from '../outbox/outbox.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OperatorToolsService {
  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
    private outboxService: OutboxService,
    private auditService: AuditService,
  ) {}

  /**
   * Manual adjustment (credit/debit)
   * Only for merchant admins
   */
  async manualAdjustment(
    tenantId: string,
    customerId: string,
    amount: number,
    reason: string,
    userId: string,
    idempotencyKey: string,
  ) {
    // Validate customer belongs to tenant
    const account = await this.prisma.customerMerchantAccount.findFirst({
      where: {
        tenantId,
        customerId,
      },
    });

    if (!account) {
      throw new NotFoundException(`Customer ${customerId} not found for this tenant`);
    }

    // Create adjustment transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          tenantId,
          customerId,
          type: amount > 0 ? 'ISSUE' : 'REDEEM',
          amount: Math.abs(amount),
          status: 'COMPLETED',
          idempotencyKey,
          metadata: {
            type: 'MANUAL_ADJUSTMENT',
            reason,
            adjustedBy: userId,
          },
        },
      });

      // Append ledger entry
      const ledgerEntry = await this.ledgerService.appendEntry(
        tenantId,
        customerId,
        amount,
        idempotencyKey,
        transaction.id,
        'MANUAL_ADJUSTMENT',
      );

      // Write outbox event
      await this.outboxService.writeEvent(
        tenantId,
        amount > 0 ? 'points.issued' : 'points.redeemed',
        {
          transactionId: transaction.id,
          customerId,
          amount,
          balanceAfter: ledgerEntry.balanceAfter,
          reason,
          type: 'MANUAL_ADJUSTMENT',
        },
        tx,
      );

      return { transaction, balanceAfter: ledgerEntry.balanceAfter };
    });

    // Audit log
    await this.auditService.log(
      tenantId,
      userId,
      'MANUAL_ADJUSTMENT',
      'transaction',
      result.transaction.id,
      {
        customerId,
        amount,
        reason,
      },
    );

    return {
      transactionId: result.transaction.id,
      amount,
      balanceAfter: result.balanceAfter,
    };
  }

  /**
   * Transaction reversal (soft)
   */
  async reverseTransaction(
    tenantId: string,
    transactionId: string,
    reason: string,
    userId: string,
  ) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        tenantId,
      },
      include: {
        ledgerEntries: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (transaction.status === 'FAILED') {
      throw new BadRequestException('Cannot reverse a failed transaction');
    }

    // Calculate reversal amount (opposite sign)
    const reversalAmount = -Number(transaction.amount);

    // Create reversal transaction
    const reversalIdempotencyKey = `reversal-${transactionId}-${Date.now()}`;

    const result = await this.manualAdjustment(
      tenantId,
      transaction.customerId,
      reversalAmount,
      `Reversal of ${transactionId}: ${reason}`,
      userId,
      reversalIdempotencyKey,
    );

    // Update original transaction metadata
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        metadata: {
          ...(transaction.metadata as any || {}),
          reversed: true,
          reversalTransactionId: result.transactionId,
          reversalReason: reason,
          reversedAt: new Date().toISOString(),
        },
      },
    });

    // Audit log
    await this.auditService.log(
      tenantId,
      userId,
      'TRANSACTION_REVERSED',
      'transaction',
      transactionId,
      {
        reversalTransactionId: result.transactionId,
        reason,
      },
    );

    return result;
  }
}
