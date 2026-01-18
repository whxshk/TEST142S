import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RewardsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, data: any) {
    return this.prisma.reward.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.reward.findMany({
      where: { tenantId, isActive: true },
    });
  }

  async findOne(tenantId: string, id: string) {
    const reward = await this.prisma.reward.findFirst({
      where: { id, tenantId },
    });

    if (!reward) {
      throw new NotFoundException(`Reward ${id} not found`);
    }

    return reward;
  }
}
