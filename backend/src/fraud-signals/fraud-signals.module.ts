import { Module } from '@nestjs/common';
import { FraudSignalsService } from './fraud-signals.service';
import { FraudSignalsController } from './fraud-signals.controller';

@Module({
  controllers: [FraudSignalsController],
  providers: [FraudSignalsService],
  exports: [FraudSignalsService],
})
export class FraudSignalsModule {}
