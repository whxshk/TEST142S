import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { PilotReportsService } from './pilot-reports.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PilotReportsService],
  exports: [PilotReportsService],
})
export class AnalyticsModule {}
