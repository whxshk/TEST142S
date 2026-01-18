import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { ScopeGuard } from '../common/guards/scope.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantContext } from '../common/decorators/tenant-context.decorator';

@ApiTags('devices')
@Controller('devices')
@UseGuards(ScopeGuard, TenantGuard)
@ApiBearerAuth('JWT-auth')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  async register(@Body() data: any, @TenantContext() tenantId: string) {
    return this.devicesService.register(tenantId, data);
  }

  @Get()
  async findAll(@TenantContext() tenantId: string) {
    return this.devicesService.findAll(tenantId);
  }
}
