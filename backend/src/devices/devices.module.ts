import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { PilotMetricsModule } from '../pilot-metrics/pilot-metrics.module';

@Module({
  imports: [PilotMetricsModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
