import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OperatorToolsService } from './operator-tools.service';
import { RequireScope } from '../common/decorators/require-scope.decorator';
import { ScopeGuard } from '../common/guards/scope.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantContext } from '../common/decorators/tenant-context.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdempotencyKey } from '../common/decorators/idempotency-key.decorator';

@ApiTags('operator-tools')
@Controller('operator-tools')
@UseGuards(ScopeGuard, TenantGuard)
@RequireScope('merchant:*')
@ApiBearerAuth('JWT-auth')
export class OperatorToolsController {
  constructor(private readonly operatorToolsService: OperatorToolsService) {}

  @Post('adjustment')
  @ApiOperation({ summary: 'Manual adjustment (credit/debit) - merchant admin only' })
  async manualAdjustment(
    @Body() body: { customerId: string; amount: number; reason: string },
    @TenantContext() tenantId: string,
    @CurrentUser() user: any,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.operatorToolsService.manualAdjustment(
      tenantId,
      body.customerId,
      body.amount,
      body.reason,
      user.userId,
      idempotencyKey,
    );
  }

  @Post('reverse')
  @ApiOperation({ summary: 'Reverse transaction - merchant admin only' })
  async reverseTransaction(
    @Body() body: { transactionId: string; reason: string },
    @TenantContext() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.operatorToolsService.reverseTransaction(
      tenantId,
      body.transactionId,
      body.reason,
      user.userId,
    );
  }
}
