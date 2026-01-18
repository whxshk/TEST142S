import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RulesetsService } from './rulesets.service';
import { ScopeGuard } from '../common/guards/scope.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantContext } from '../common/decorators/tenant-context.decorator';

@ApiTags('rulesets')
@Controller('rulesets')
@UseGuards(ScopeGuard, TenantGuard)
@ApiBearerAuth('JWT-auth')
export class RulesetsController {
  constructor(private readonly rulesetsService: RulesetsService) {}

  @Get()
  async findAll(@TenantContext() tenantId: string) {
    return this.rulesetsService.findAll(tenantId);
  }
}
