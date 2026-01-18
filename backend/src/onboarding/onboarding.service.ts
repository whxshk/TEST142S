import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PilotMetricsService } from '../pilot-metrics/pilot-metrics.service';

export interface MerchantSignupDto {
  merchantName: string;
  adminEmail: string;
  adminPassword: string;
  locationName: string;
  locationAddress?: string;
}

export interface StaffInviteDto {
  email: string;
  scopes: string[];
}

@Injectable()
export class OnboardingService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private pilotMetricsService: PilotMetricsService,
  ) {}

  async createMerchant(signupDto: MerchantSignupDto, userId?: string) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { email: signupDto.adminEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Create tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: signupDto.merchantName,
        config: {},
      },
    });

    // Create first location
    const location = await this.prisma.location.create({
      data: {
        tenantId: tenant.id,
        name: signupDto.locationName,
        address: signupDto.locationAddress || null,
        isActive: true,
      },
    });

    // Create merchant admin user
    const hashedPassword = await bcrypt.hash(signupDto.adminPassword, 10);
    const adminUser = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: signupDto.adminEmail,
        hashedPassword,
        roles: ['MERCHANT_ADMIN'],
        scopes: ['merchant:*'], // Default scope for merchant admins
        isActive: true,
      },
    });

    // Audit log
    await this.auditService.log(
      tenant.id,
      adminUser.id,
      'MERCHANT_CREATED',
      'tenant',
      tenant.id,
      { merchantName: signupDto.merchantName },
    );

    // Track onboarding milestone
    await this.pilotMetricsService.trackOnboardingMilestone(tenant.id, 'merchant_signup');
    await this.pilotMetricsService.trackOnboardingMilestone(tenant.id, 'first_location');

    return {
      tenantId: tenant.id,
      locationId: location.id,
      userId: adminUser.id,
      email: adminUser.email,
    };
  }

  async inviteStaff(tenantId: string, inviterUserId: string, inviteDto: StaffInviteDto) {
    // Check if user already exists for this tenant
    const existingUser = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: inviteDto.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('User already exists for this tenant');
    }

    // Generate invite token (simple UUID-based)
    const { v4: uuidv4 } = require('uuid');
    const inviteToken = uuidv4();

    // Store invite in tenant config or create invite table (simplified: using config)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    const invites = ((tenant?.config as any)?.pendingInvites || []) as any[];
    invites.push({
      email: inviteDto.email,
      scopes: inviteDto.scopes || ['scan:*'],
      token: inviteToken,
      invitedBy: inviterUserId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        config: {
          ...(tenant?.config as any || {}),
          pendingInvites: invites,
        },
      },
    });

    // Audit log
    await this.auditService.log(
      tenantId,
      inviterUserId,
      'STAFF_INVITED',
      'user',
      inviteDto.email,
      { email: inviteDto.email, scopes: inviteDto.scopes },
    );

    // Track onboarding milestone (first staff invite only)
    const funnel = await this.prisma.pilotOnboardingFunnel.findUnique({
      where: { tenantId },
    });
    if (!funnel?.firstStaffInvitedAt) {
      await this.pilotMetricsService.trackOnboardingMilestone(tenantId, 'first_staff');
    }

    return {
      inviteToken,
      email: inviteDto.email,
      inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${inviteToken}`,
    };
  }

  async acceptInvite(inviteToken: string, password: string) {
    // Find tenant with this invite
    const tenants = await this.prisma.tenant.findMany({});
    
    let invite: any = null;
    let tenantId: string | null = null;

    for (const tenant of tenants) {
      const invites = ((tenant.config as any)?.pendingInvites || []) as any[];
      invite = invites.find((inv: any) => inv.token === inviteToken && new Date(inv.expiresAt) > new Date());
      if (invite) {
        tenantId = tenant.id;
        break;
      }
    }

    if (!invite || !tenantId) {
      throw new ConflictException('Invalid or expired invite token');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: invite.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: invite.email,
        hashedPassword,
        roles: ['STAFF'],
        scopes: invite.scopes || ['scan:*'],
        isActive: true,
      },
    });

    // Remove invite from tenant config
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const invites = ((tenant?.config as any)?.pendingInvites || []) as any[];
    const updatedInvites = invites.filter((inv: any) => inv.token !== inviteToken);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        config: {
          ...(tenant?.config as any || {}),
          pendingInvites: updatedInvites,
        },
      },
    });

    return {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
    };
  }
}
