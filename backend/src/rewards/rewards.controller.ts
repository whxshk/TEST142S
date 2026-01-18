import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RewardsService } from './rewards.service';
import { RequireScope } from '../common/decorators/require-scope.decorator';
import { ScopeGuard } from '../common/guards/scope.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantContext } from '../common/decorators/tenant-context.decorator';

@ApiTags('rewards')
@Controller('rewards')
@UseGuards(ScopeGuard, TenantGuard)
@ApiBearerAuth('JWT-auth')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Post()
  @RequireScope('merchant:*')
  async create(@Body() data: any, @TenantContext() tenantId: string) {
    return this.rewardsService.create(tenantId, data);
  }

  @Get()
  async findAll(@TenantContext() tenantId: string) {
    return this.rewardsService.findAll(tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantContext() tenantId: string) {
    return this.rewardsService.findOne(tenantId, id);
  }
}
