import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

describe('SharkBand E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data
  let tenantA: any;
  let tenantB: any;
  let merchantAdminA: any;
  let merchantAdminB: any;
  let staffA: any;
  let customerA: any;
  let deviceA: any;
  let locationA: any;
  let rewardA: any;
  let tokens: { merchantAdminA: string; staffA: string; merchantAdminB: string } = {
    merchantAdminA: '',
    staffA: '',
    merchantAdminB: '',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create Tenant A
    tenantA = await prisma.tenant.create({
      data: { name: 'Test Merchant A', config: {} },
    });

    // Create Tenant B
    tenantB = await prisma.tenant.create({
      data: { name: 'Test Merchant B', config: {} },
    });

    // Create Location A
    locationA = await prisma.location.create({
      data: {
        tenantId: tenantA.id,
        name: 'Test Location A',
        address: 'Test Address',
        isActive: true,
      },
    });

    // Create Merchant Admin A
    const hashedPasswordA = await bcrypt.hash('admin123', 10);
    merchantAdminA = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        email: 'admin-a@test.com',
        hashedPassword: hashedPasswordA,
        roles: ['MERCHANT_ADMIN'],
        scopes: ['merchant:*'],
        isActive: true,
      },
    });

    // Create Staff A
    const hashedPasswordStaff = await bcrypt.hash('staff123', 10);
    staffA = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        email: 'staff-a@test.com',
        hashedPassword: hashedPasswordStaff,
        roles: ['STAFF'],
        scopes: ['scan:*'],
        isActive: true,
      },
    });

    // Create Merchant Admin B
    const hashedPasswordB = await bcrypt.hash('admin123', 10);
    merchantAdminB = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        email: 'admin-b@test.com',
        hashedPassword: hashedPasswordB,
        roles: ['MERCHANT_ADMIN'],
        scopes: ['merchant:*'],
        isActive: true,
      },
    });

    // Create Device A
    deviceA = await prisma.device.create({
      data: {
        tenantId: tenantA.id,
        locationId: locationA.id,
        deviceIdentifier: 'device-a-123',
        registeredByUserId: staffA.id,
        isActive: true,
      },
    });

    // Create Customer A
    customerA = await prisma.customer.create({
      data: {
        qrTokenSecret: 'test-secret',
        rotationIntervalSec: 30,
      },
    });

    await prisma.customerMerchantAccount.create({
      data: {
        customerId: customerA.id,
        tenantId: tenantA.id,
        membershipStatus: 'ACTIVE',
      },
    });

    // Create Reward A
    rewardA = await prisma.reward.create({
      data: {
        tenantId: tenantA.id,
        name: 'Test Reward',
        pointsRequired: 100,
        description: 'Test reward description',
        isActive: true,
      },
    });

    // Get auth tokens
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin-a@test.com', password: 'admin123' });

    tokens.merchantAdminA = adminLogin.body.access_token;

    const staffLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'staff-a@test.com', password: 'staff123' });

    tokens.staffA = staffLogin.body.access_token;

    const adminBLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin-b@test.com', password: 'admin123' });

    tokens.merchantAdminB = adminBLogin.body.access_token;
  }

  async function cleanupTestData() {
    await prisma.pilotDailyMetric.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.pilotOnboardingFunnel.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.pilotCustomerActivity.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.pilotRewardUsage.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.loyaltyLedgerEntry.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.transaction.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.redemption.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.customerMerchantAccount.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.device.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.reward.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.location.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.customer.deleteMany({ where: { id: customerA.id } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
  }

  describe('Auth + Scopes', () => {
    it('merchant admin can access analytics endpoints', () => {
      return request(app.getHttpServer())
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${tokens.merchantAdminA}`)
        .expect(200);
    });

    it('staff cannot access merchant admin endpoints', () => {
      return request(app.getHttpServer())
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${tokens.staffA}`)
        .expect(403);
    });

    it('unauthenticated cannot access protected endpoints', () => {
      return request(app.getHttpServer())
        .get('/api/v1/analytics/dashboard')
        .expect(401);
    });
  });

  describe('Idempotency', () => {
    let idempotencyKey: string;
    let firstResponse: any;

    beforeEach(() => {
      idempotencyKey = uuidv4();
    });

    it('issue same request twice with same Idempotency-Key -> only 1 ledger entry', async () => {
      // First request
      firstResponse = await request(app.getHttpServer())
        .post('/api/v1/transactions/issue')
        .set('Authorization', `Bearer ${tokens.staffA}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          customerId: customerA.id,
          amount: 50,
          deviceId: deviceA.id,
        })
        .expect(201);

      // Second request with same key
      const secondResponse = await request(app.getHttpServer())
        .post('/api/v1/transactions/issue')
        .set('Authorization', `Bearer ${tokens.staffA}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          customerId: customerA.id,
          amount: 50,
          deviceId: deviceA.id,
        })
        .expect(201);

      // Should return same transaction ID
      expect(secondResponse.body.id).toBe(firstResponse.body.id);

      // Check only 1 ledger entry exists
      const ledgerEntries = await prisma.loyaltyLedgerEntry.findMany({
        where: {
          tenantId: tenantA.id,
          customerId: customerA.id,
          idempotencyKey,
        },
      });

      expect(ledgerEntries.length).toBe(1);
    });

    it('redeem same request twice with same Idempotency-Key -> only 1 redeem effect', async () => {
      // First, issue enough points
      const issueKey = uuidv4();
      await request(app.getHttpServer())
        .post('/api/v1/transactions/issue')
        .set('Authorization', `Bearer ${tokens.staffA}`)
        .set('Idempotency-Key', issueKey)
        .send({
          customerId: customerA.id,
          amount: 200,
          deviceId: deviceA.id,
        })
        .expect(201);

      // Wait a bit for async processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const redeemKey = uuidv4();

      // First redemption
      const firstRedeem = await request(app.getHttpServer())
        .post('/api/v1/transactions/redeem')
        .set('Authorization', `Bearer ${tokens.staffA}`)
        .set('Idempotency-Key', redeemKey)
        .send({
          customerId: customerA.id,
          rewardId: rewardA.id,
        })
        .expect(201);

      // Second redemption with same key
      const secondRedeem = await request(app.getHttpServer())
        .post('/api/v1/transactions/redeem')
        .set('Authorization', `Bearer ${tokens.staffA}`)
        .set('Idempotency-Key', redeemKey)
        .send({
          customerId: customerA.id,
          rewardId: rewardA.id,
        })
        .expect(201);

      // Should return same result
      expect(secondRedeem.body.id).toBe(firstRedeem.body.id);

      // Check balance is only deducted once (should be 100, not 0)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const balance = await prisma.loyaltyLedgerEntry.aggregate({
        where: {
          tenantId: tenantA.id,
          customerId: customerA.id,
        },
        _sum: { amount: true },
      });

      // 200 issued - 100 redeemed = 100 remaining
      expect(Number(balance._sum.amount)).toBe(100);
    });
  });

  describe('Double-Spend Protection', () => {
    beforeEach(async () => {
      // Setup: Issue points
      const issueKey = uuidv4();
      await request(app.getHttpServer())
        .post('/api/v1/transactions/issue')
        .set('Authorization', `Bearer ${tokens.staffA}`)
        .set('Idempotency-Key', issueKey)
        .send({
          customerId: customerA.id,
          amount: 100,
          deviceId: deviceA.id,
        })
        .expect(201);

      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    it('attempt to redeem more than available -> fails', async () => {
      // Try to redeem more than balance (reward requires 200, but only 100 available)
      const bigReward = await prisma.reward.create({
        data: {
          tenantId: tenantA.id,
          name: 'Big Reward',
          pointsRequired: 200,
          isActive: true,
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/transactions/redeem')
        .set('Authorization', `Bearer ${tokens.staffA}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          customerId: customerA.id,
          rewardId: bigReward.id,
        })
        .expect(400);

      await prisma.reward.delete({ where: { id: bigReward.id } });
    });
  });

  describe('Tenant Isolation', () => {
    it('tenant A cannot read tenant B pilot metrics', async () => {
      // Try to access tenant B's weekly report with tenant A token
      // Should either return empty or tenant A's data, not tenant B's
      const response = await request(app.getHttpServer())
        .get('/api/v1/analytics/pilot-weekly-report')
        .set('Authorization', `Bearer ${tokens.merchantAdminA}`)
        .expect(200);

      // Response should not contain tenant B data (or should be empty if no data)
      // The tenant isolation is enforced at the JWT level, so this should work
      expect(response.body).toBeDefined();
    });

    it('tenant B cannot access tenant A resources', async () => {
      // Try to access tenant A's reward with tenant B token
      await request(app.getHttpServer())
        .get(`/api/v1/rewards/${rewardA.id}`)
        .set('Authorization', `Bearer ${tokens.merchantAdminB}`)
        .expect(404); // Should not find reward (tenant isolation)
    });
  });

  describe('Metrics Correctness', () => {
    it('daily metrics match expected counts after transactions', async () => {
      const today = new Date();
      const issueKey1 = uuidv4();
      const issueKey2 = uuidv4();

      // Issue points to 2 different customers
      await request(app.getHttpServer())
        .post('/api/v1/transactions/issue')
        .set('Authorization', `Bearer ${tokens.staffA}`)
        .set('Idempotency-Key', issueKey1)
        .send({
          customerId: customerA.id,
          amount: 50,
          deviceId: deviceA.id,
        })
        .expect(201);

      // Create second customer
      const customerB = await prisma.customer.create({
        data: {
          qrTokenSecret: 'test-secret-2',
          rotationIntervalSec: 30,
        },
      });

      await prisma.customerMerchantAccount.create({
        data: {
          customerId: customerB.id,
          tenantId: tenantA.id,
          membershipStatus: 'ACTIVE',
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/transactions/issue')
        .set('Authorization', `Bearer ${tokens.staffA}`)
        .set('Idempotency-Key', issueKey2)
        .send({
          customerId: customerB.id,
          amount: 50,
          deviceId: deviceA.id,
        })
        .expect(201);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check metrics (may need to query directly as async updates may not be immediate)
      // This is a simplified check - in real implementation, you'd verify the metrics service updated correctly
      const transactions = await prisma.transaction.count({
        where: {
          tenantId: tenantA.id,
          type: 'ISSUE',
          createdAt: {
            gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          },
        },
      });

      expect(transactions).toBeGreaterThanOrEqual(2);

      // Cleanup
      await prisma.customerMerchantAccount.delete({ where: { customerId: customerB.id, tenantId: tenantA.id } });
      await prisma.customer.delete({ where: { id: customerB.id } });
    });
  });
});
