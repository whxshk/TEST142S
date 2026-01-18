import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OutboxService {
  constructor(private prisma: PrismaService) {}

  /**
   * Write event to outbox within a transaction
   * Must be called within a Prisma transaction context
   */
  async writeEvent(
    tenantId: string,
    eventType: string,
    payload: Record<string, any>,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx || this.prisma;

    await client.outboxEvent.create({
      data: {
        tenantId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });
  }
}
