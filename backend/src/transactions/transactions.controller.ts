import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { IssuePointsDto } from './dto/issue-points.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';
import { IdempotencyKey } from '../common/decorators/idempotency-key.decorator';
import { TenantContext } from '../common/decorators/tenant-context.decorator';
import { RequireScope } from '../common/decorators/require-scope.decorator';
import { ScopeGuard } from '../common/guards/scope.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(ScopeGuard, TenantGuard)
@ApiBearerAuth('JWT-auth')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('issue')
  @RequireScope('scan:*')
  @ApiOperation({ summary: 'Issue points to customer (via QR scan)' })
  @ApiHeader({ name: 'Idempotency-Key', description: 'UUID for idempotent requests', required: true })
  @ApiResponse({ status: 201, description: 'Points issued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or insufficient balance' })
  async issuePoints(
    @Body() dto: IssuePointsDto,
    @TenantContext() tenantId: string,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.transactionsService.issuePoints(
      tenantId,
      dto.customerId,
      dto.amount,
      dto.deviceId || null,
      idempotencyKey,
    );
  }

  @Post('redeem')
  @RequireScope('scan:*', 'customer:*')
  @ApiOperation({ summary: 'Redeem points for reward' })
  @ApiHeader({ name: 'Idempotency-Key', description: 'UUID for idempotent requests', required: true })
  @ApiResponse({ status: 201, description: 'Points redeemed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or insufficient points' })
  async redeemPoints(
    @Body() dto: RedeemPointsDto,
    @TenantContext() tenantId: string,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.transactionsService.redeemPoints(
      tenantId,
      dto.customerId,
      dto.rewardId,
      idempotencyKey,
    );
  }
}
