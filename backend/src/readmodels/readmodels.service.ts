import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReadmodelsService {
  private readonly logger = new Logger(ReadmodelsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Update customer balance read model (idempotent)
   */
  async updateCustomerBalance(
    tenantId: string,
    customerId: string,
    balance: number,
    eventId?: string,
  ): Promise<void> {
    try {
      await this.prisma.customerBalance.upsert({
        where: {
          tenantId_customerId: {
            tenantId,
            customerId,
          },
        },
        create: {
          tenantId,
          customerId,
          balance,
          lastUpdatedAt: new Date(),
        },
        update: {
          balance,
          lastUpdatedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update customer balance for ${customerId}`, error);
      throw error;
    }
  }

  /**
   * Create transaction summary (idempotent)
   */
  async createTransactionSummary(
    tenantId: string,
    transactionId: string,
    customerId: string,
    amount: number,
    type: 'ISSUE' | 'REDEEM',
    transactionDate: Date,
  ): Promise<void> {
    try {
      await this.prisma.transactionSummary.upsert({
        where: { transactionId },
        create: {
          tenantId,
          transactionId,
          customerId,
          amount,
          type,
          transactionDate,
        },
        update: {
          // Update if needed (shouldn't happen for immutable transactions)
          amount,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create transaction summary for ${transactionId}`, error);
      throw error;
    }
  }
}
