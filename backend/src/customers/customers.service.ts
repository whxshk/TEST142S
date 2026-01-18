import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async getQrToken(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const rotationInterval = customer.rotationIntervalSec || 30;
    const timestampBucket = Math.floor(Date.now() / 1000 / rotationInterval);
    const token = crypto
      .createHmac('sha256', customer.qrTokenSecret)
      .update(`${customerId}:${timestampBucket}`)
      .digest('hex');

    return {
      qrToken: token,
      expiresAt: new Date((timestampBucket + 1) * rotationInterval * 1000),
      refreshInterval: rotationInterval,
    };
  }
}
