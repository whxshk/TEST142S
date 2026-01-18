import { Module } from '@nestjs/common';
import { RulesetsService } from './rulesets.service';
import { RulesetsController } from './rulesets.controller';

@Module({
  controllers: [RulesetsController],
  providers: [RulesetsService],
  exports: [RulesetsService],
})
export class RulesetsModule {}
