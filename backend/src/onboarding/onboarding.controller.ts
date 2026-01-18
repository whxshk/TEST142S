import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { MerchantSignupDto } from './dto/merchant-signup.dto';
import { StaffInviteDto } from './dto/staff-invite.dto';
import { Public } from '../common/decorators/public.decorator';
import { RequireScope } from '../common/decorators/require-scope.decorator';
import { ScopeGuard } from '../common/guards/scope.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantContext } from '../common/decorators/tenant-context.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Public()
  @Post('merchant-signup')
  @ApiOperation({ summary: 'Self-serve merchant signup' })
  @ApiResponse({ status: 201, description: 'Merchant created successfully' })
  async merchantSignup(@Body() dto: MerchantSignupDto) {
    return this.onboardingService.createMerchant(dto);
  }

  @Post('invite-staff')
  @UseGuards(ScopeGuard, TenantGuard)
  @RequireScope('merchant:*')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Invite staff member (merchant admin only)' })
  @ApiResponse({ status: 201, description: 'Staff invited successfully' })
  async inviteStaff(
    @Body() dto: StaffInviteDto,
    @TenantContext() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.onboardingService.inviteStaff(tenantId, user.userId, dto);
  }

  @Public()
  @Post('accept-invite')
  @ApiOperation({ summary: 'Accept staff invite and create account' })
  @ApiResponse({ status: 201, description: 'Invite accepted, account created' })
  async acceptInvite(
    @Body() body: { inviteToken: string; password: string },
  ) {
    return this.onboardingService.acceptInvite(body.inviteToken, body.password);
  }
}
