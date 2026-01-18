import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { OutboxModule } from '../outbox/outbox.module';
import { FraudSignalsModule } from '../fraud-signals/fraud-signals.module';
import { PilotMetricsModule } from '../pilot-metrics/pilot-metrics.module';

@Module({
  imports: [LedgerModule, OutboxModule, FraudSignalsModule, PilotMetricsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
