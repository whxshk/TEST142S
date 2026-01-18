import { Module } from '@nestjs/common';
import { OperatorToolsService } from './operator-tools.service';
import { OperatorToolsController } from './operator-tools.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { OutboxModule } from '../outbox/outbox.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [LedgerModule, OutboxModule, AuditModule],
  controllers: [OperatorToolsController],
  providers: [OperatorToolsService],
  exports: [OperatorToolsService],
})
export class OperatorToolsModule {}
