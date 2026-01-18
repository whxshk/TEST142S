import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PilotMetricsService } from '../pilot-metrics/pilot-metrics.service';

@Injectable()
export class DevicesService {
  constructor(
    private prisma: PrismaService,
    private pilotMetricsService: PilotMetricsService,
  ) {}

  async register(tenantId: string, data: any) {
    const device = await this.prisma.device.create({ data: { ...data, tenantId } });
    
    // Track onboarding milestone (first device only)
    const funnel = await this.prisma.pilotOnboardingFunnel.findUnique({
      where: { tenantId },
    });
    if (!funnel?.firstDeviceRegisteredAt) {
      await this.pilotMetricsService.trackOnboardingMilestone(tenantId, 'first_device');
    }
    
    return device;
  }

  async findAll(tenantId: string) {
    return this.prisma.device.findMany({ where: { tenantId } });
  }
}
