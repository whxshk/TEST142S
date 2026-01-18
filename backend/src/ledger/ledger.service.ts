import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Append entry to ledger (idempotent)
   * Calculates balance_after from previous entries
   */
  async appendEntry(
    tenantId: string,
    customerId: string,
    amount: number,
    idempotencyKey: string,
    transactionId: string,
    operationType: string = 'TRANSACTION',
  ): Promise<{ id: string; balanceAfter: number }> {
    // Check idempotency
    const existing = await this.prisma.loyaltyLedgerEntry.findFirst({
      where: {
        tenantId,
        idempotencyKey,
        operationType,
      },
    });

    if (existing) {
      return {
        id: existing.id,
        balanceAfter: Number(existing.balanceAfter),
      };
    }

    // Calculate current balance from all previous entries
    const previousEntries = await this.prisma.loyaltyLedgerEntry.findMany({
      where: {
        tenantId,
        customerId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const currentBalance = previousEntries.reduce(
      (sum, entry) => sum + Number(entry.amount),
      0,
    );

    const newBalance = currentBalance + amount;

    // Insert ledger entry
    try {
      const entry = await this.prisma.loyaltyLedgerEntry.create({
        data: {
          tenantId,
          customerId,
          transactionId,
          amount: new Decimal(amount),
          balanceAfter: new Decimal(newBalance),
          idempotencyKey,
          operationType,
        },
      });

      return {
        id: entry.id,
        balanceAfter: Number(entry.balanceAfter),
      };
    } catch (error: any) {
      // Handle unique constraint violation (idempotency race condition)
      if (error.code === 'P2002') {
        const existing = await this.prisma.loyaltyLedgerEntry.findFirst({
          where: {
            tenantId,
            idempotencyKey,
            operationType,
          },
        });

        if (existing) {
          return {
            id: existing.id,
            balanceAfter: Number(existing.balanceAfter),
          };
        }
      }
      throw error;
    }
  }

  /**
   * Get customer balance (derived from ledger entries)
   */
  async getBalance(tenantId: string, customerId: string): Promise<number> {
    const result = await this.prisma.loyaltyLedgerEntry.aggregate({
      where: {
        tenantId,
        customerId,
      },
      _sum: {
        amount: true,
      },
    });

    return Number(result._sum.amount || 0);
  }

  /**
   * Get ledger history with pagination
   */
  async getLedgerHistory(
    tenantId: string,
    customerId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      this.prisma.loyaltyLedgerEntry.findMany({
        where: {
          tenantId,
          customerId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        include: {
          transaction: true,
        },
      }),
      this.prisma.loyaltyLedgerEntry.count({
        where: {
          tenantId,
          customerId,
        },
      }),
    ]);

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        transactionId: entry.transactionId,
        amount: Number(entry.amount),
        balanceAfter: Number(entry.balanceAfter),
        operationType: entry.operationType,
        createdAt: entry.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
