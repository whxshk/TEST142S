import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(tenantId: string) {
    const [totalCustomers, totalTransactions, totalBalance] = await Promise.all([
      this.prisma.customerMerchantAccount.count({ where: { tenantId } }),
      this.prisma.transaction.count({ where: { tenantId } }),
      this.prisma.customerBalance.aggregate({
        where: { tenantId },
        _sum: { balance: true },
      }),
    ]);

    return {
      totalCustomers,
      totalTransactions,
      totalBalance: Number(totalBalance._sum.balance || 0),
    };
  }
}
