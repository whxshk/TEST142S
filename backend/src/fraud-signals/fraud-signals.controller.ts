import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FraudSignalsService } from './fraud-signals.service';
import { RequireScope } from '../common/decorators/require-scope.decorator';
import { ScopeGuard } from '../common/guards/scope.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantContext } from '../common/decorators/tenant-context.decorator';
import { Query } from '@nestjs/common';

@ApiTags('fraud-signals')
@Controller('fraud-signals')
@UseGuards(ScopeGuard, TenantGuard)
@ApiBearerAuth('JWT-auth')
export class FraudSignalsController {
  constructor(private readonly fraudSignalsService: FraudSignalsService) {}

  @Get()
  @RequireScope('merchant:*')
  async getSignals(
    @TenantContext() tenantId: string,
    @Query('deviceId') deviceId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.fraudSignalsService.getMisuseSignals(tenantId, deviceId, customerId);
  }
}
