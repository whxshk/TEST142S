import { Module } from '@nestjs/common';
import { ReadmodelsService } from './readmodels.service';
import { ReadmodelsConsumer } from './readmodels.consumer';
import { LedgerModule } from '../ledger/ledger.module';
import { PilotMetricsModule } from '../pilot-metrics/pilot-metrics.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [LedgerModule, PilotMetricsModule, PrismaModule],
  providers: [ReadmodelsService, ReadmodelsConsumer],
  exports: [ReadmodelsService],
})
export class ReadmodelsModule {}
