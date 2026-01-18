import { Module } from '@nestjs/common';
import { PilotMetricsService } from './pilot-metrics.service';

@Module({
  providers: [PilotMetricsService],
  exports: [PilotMetricsService],
})
export class PilotMetricsModule {}
