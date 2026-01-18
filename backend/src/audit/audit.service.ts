import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(tenantId: string, userId: string, action: string, resourceType: string, resourceId: string, metadata?: any) {
    return this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        resourceType,
        resourceId,
        metadata: metadata || {},
      },
    });
  }
}
