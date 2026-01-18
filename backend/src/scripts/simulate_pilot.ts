/**
 * Pilot Simulator Script
 * Simulates realistic pilot data across 7 days
 * 
 * Usage: npm run simulate:pilot
 * Requires: NODE_ENV=development, PILOT_MODE=true
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

// Guard: Only run in development + pilot mode
if (process.env.NODE_ENV !== 'development' || process.env.PILOT_MODE !== 'true') {
  console.error('❌ Simulator only runs in development with PILOT_MODE=true');
  process.exit(1);
}

interface SimulatedData {
  tenantId: string;
  locationId: string;
  adminUserId: string;
  staffUserId: string;
  deviceId: string;
  customers: Array<{ id: string; email: string }>;
  rewardId: string;
  adminToken: string;
  staffToken: string;
}

async function main() {
  console.log('🎯 Starting Pilot Simulator...\n');

  try {
    // Setup: Create or use existing pilot tenant
    const simulated = await setupPilotTenant();

    // Simulate transactions across 7 days
    await simulateTransactions(simulated);

    // Wait for async processing (metrics updates)
    console.log('\n⏳ Waiting for async processing (2 seconds)...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate reports
    await generateReports(simulated);

    console.log('\n✅ Pilot simulation complete!');
  } catch (error: any) {
    console.error('❌ Simulation failed:', error.message);
    if (error.response) {
      console.error('API Error:', error.response.data);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function setupPilotTenant(): Promise<SimulatedData> {
  console.log('📋 Setting up pilot tenant...');

  // Check if pilot tenant exists
  let tenant = await prisma.tenant.findFirst({
    where: { name: 'Pilot Simulator Tenant' },
  });

  if (!tenant) {
    // Create tenant
    tenant = await prisma.tenant.create({
      data: { name: 'Pilot Simulator Tenant', config: {} },
    });

    // Create location
    const location = await prisma.location.create({
      data: {
        tenantId: tenant.id,
        name: 'Pilot Location',
        address: '123 Pilot Street',
        isActive: true,
      },
    });

    // Create admin user
    const hashedPassword = await bcrypt.hash('pilot123', 10);
    const adminUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'pilot-admin@simulator.com',
        hashedPassword,
        roles: ['MERCHANT_ADMIN'],
        scopes: ['merchant:*'],
        isActive: true,
      },
    });

    // Create staff user
    const hashedStaffPassword = await bcrypt.hash('pilot123', 10);
    const staffUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'pilot-staff@simulator.com',
        hashedPassword: hashedStaffPassword,
        roles: ['STAFF'],
        scopes: ['scan:*'],
        isActive: true,
      },
    });

    // Create device
    const device = await prisma.device.create({
      data: {
        tenantId: tenant.id,
        locationId: location.id,
        deviceIdentifier: 'pilot-device-001',
        registeredByUserId: staffUser.id,
        isActive: true,
      },
    });

    // Create reward
    const reward = await prisma.reward.create({
      data: {
        tenantId: tenant.id,
        name: 'Free Coffee',
        pointsRequired: 100,
        description: 'Redeem 100 points for a free coffee',
        isActive: true,
      },
    });

    console.log('✅ Pilot tenant created');
  } else {
    console.log('ℹ️  Using existing pilot tenant');
  }

  // Get or create required entities
  const location = await prisma.location.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!location) throw new Error('Location not found');

  const adminUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'pilot-admin@simulator.com' },
  });
  if (!adminUser) throw new Error('Admin user not found');

  const staffUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'pilot-staff@simulator.com' },
  });
  if (!staffUser) throw new Error('Staff user not found');

  const device = await prisma.device.findFirst({
    where: { tenantId: tenant.id, deviceIdentifier: 'pilot-device-001' },
  });
  if (!device) throw new Error('Device not found');

  const reward = await prisma.reward.findFirst({
    where: { tenantId: tenant.id, name: 'Free Coffee' },
  });
  if (!reward) throw new Error('Reward not found');

  // Get auth tokens
  const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
    email: 'pilot-admin@simulator.com',
    password: 'pilot123',
  });

  const staffLogin = await axios.post(`${API_BASE}/auth/login`, {
    email: 'pilot-staff@simulator.com',
    password: 'pilot123',
  });

  return {
    tenantId: tenant.id,
    locationId: location.id,
    adminUserId: adminUser.id,
    staffUserId: staffUser.id,
    deviceId: device.id,
    customers: [],
    rewardId: reward.id,
    adminToken: adminLogin.data.access_token,
    staffToken: staffLogin.data.access_token,
  };
}

async function simulateTransactions(data: SimulatedData) {
  console.log('\n📊 Simulating transactions across 7 days...');

  const now = new Date();
  const daysAgo = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    return date;
  }).reverse();

  // Create 60 customers
  const customers: Array<{ id: string; email: string }> = [];
  for (let i = 0; i < 60; i++) {
    const customer = await prisma.customer.create({
      data: {
        qrTokenSecret: `sim-secret-${i}`,
        rotationIntervalSec: 30,
      },
    });

    await prisma.customerMerchantAccount.create({
      data: {
        customerId: customer.id,
        tenantId: data.tenantId,
        membershipStatus: 'ACTIVE',
      },
    });

    customers.push({ id: customer.id, email: `customer-${i}@simulator.com` });
  }

  data.customers = customers;
  console.log(`✅ Created ${customers.length} customers`);

  // 40 customers: issue points once (spread across days)
  console.log('  → 40 customers: 1 issue each');
  for (let i = 0; i < 40; i++) {
    const day = daysAgo[i % 7];
    const timestamp = new Date(day);
    timestamp.setHours(10 + (i % 8));

    await issuePoints(
      data,
      customers[i].id,
      20 + (i % 30),
      timestamp,
      `sim-issue-${i}`,
    );
  }

  // 15 customers: issue twice in 7 days (repeat customers)
  console.log('  → 15 customers: 2 issues each (repeat)');
  for (let i = 40; i < 55; i++) {
    const firstDay = daysAgo[(i - 40) % 5]; // First issue 2-6 days ago
    const secondDay = daysAgo[Math.min(6, (i - 40) % 5 + 1)]; // Second issue 1-5 days ago

    await issuePoints(
      data,
      customers[i].id,
      25,
      new Date(firstDay.setHours(10)),
      `sim-repeat-first-${i}`,
    );

    await issuePoints(
      data,
      customers[i].id,
      25,
      new Date(secondDay.setHours(14)),
      `sim-repeat-second-${i}`,
    );
  }

  // 10 customers: redeem once
  console.log('  → 10 customers: 1 redeem each');
  for (let i = 55; i < 65; i++) {
    // First issue enough points
    const issueDay = daysAgo[(i - 55) % 5];
    await issuePoints(
      data,
      customers[i].id,
      150, // Enough for redemption
      new Date(issueDay.setHours(10)),
      `sim-redeem-issue-${i}`,
    );

    // Then redeem
    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
    const redeemDay = new Date(issueDay);
    redeemDay.setHours(11);
    await redeemPoints(data, customers[i].id, redeemDay, `sim-redeem-${i}`);
  }

  // 5 customers: generate errors (we'll simulate via audit logs since API validates)
  console.log('  → 5 customers: errors tracked');
  for (let i = 0; i < 5; i++) {
    const day = daysAgo[i % 3];
    // Track error in audit log (simulating expired QR error)
    await prisma.auditLog.create({
      data: {
        tenantId: data.tenantId,
        action: 'SCAN_ERROR',
        resourceType: 'transaction',
        resourceId: customers[i].id,
        metadata: {
          errorType: 'EXPIRED_QR',
          timestamp: new Date(day.setHours(12 + i)).toISOString(),
        },
      },
    });
  }

  // 2 manual adjustments
  console.log('  → 2 manual adjustments');
  await manualAdjustment(data, customers[0].id, 10, 'Simulation adjustment 1', `sim-adj-1`);
  await manualAdjustment(data, customers[1].id, -5, 'Simulation adjustment 2', `sim-adj-2`);

  // 1 reversal
  console.log('  → 1 transaction reversal');
  const reversalIssueKey = `sim-reversal-issue`;
  const issueResponse = await issuePoints(
    data,
    customers[2].id,
    50,
    new Date(daysAgo[2].setHours(10)),
    reversalIssueKey,
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await reverseTransaction(data, issueResponse.transactionId, 'Simulation reversal');

  console.log('✅ Transaction simulation complete');
}

async function issuePoints(
  data: SimulatedData,
  customerId: string,
  amount: number,
  timestamp: Date,
  idempotencyKey: string,
): Promise<{ transactionId: string }> {
  // Note: API calls use current time, so we'll update timestamps after creation
  const response = await axios.post(
    `${API_BASE}/transactions/issue`,
    {
      customerId,
      amount,
      deviceId: data.deviceId,
    },
    {
      headers: {
        Authorization: `Bearer ${data.staffToken}`,
        'Idempotency-Key': idempotencyKey,
      },
    },
  );

  // Backdate the transaction and ledger entry (dev-only)
  await prisma.transaction.updateMany({
    where: { idempotencyKey },
    data: { createdAt: timestamp },
  });

  await prisma.loyaltyLedgerEntry.updateMany({
    where: { idempotencyKey },
    data: { createdAt: timestamp },
  });

  return { transactionId: response.data.id };
}

async function redeemPoints(
  data: SimulatedData,
  customerId: string,
  timestamp: Date,
  idempotencyKey: string,
) {
  const response = await axios.post(
    `${API_BASE}/transactions/redeem`,
    {
      customerId,
      rewardId: data.rewardId,
    },
    {
      headers: {
        Authorization: `Bearer ${data.staffToken}`,
        'Idempotency-Key': idempotencyKey,
      },
    },
  );

  // Backdate
  await prisma.transaction.updateMany({
    where: { idempotencyKey },
    data: { createdAt: timestamp },
  });

  await prisma.loyaltyLedgerEntry.updateMany({
    where: { idempotencyKey },
    data: { createdAt: timestamp },
  });

  return response.data;
}

async function manualAdjustment(
  data: SimulatedData,
  customerId: string,
  amount: number,
  reason: string,
  idempotencyKey: string,
) {
  await axios.post(
    `${API_BASE}/operator-tools/adjustment`,
    {
      customerId,
      amount,
      reason,
    },
    {
      headers: {
        Authorization: `Bearer ${data.adminToken}`,
        'Idempotency-Key': idempotencyKey,
      },
    },
  );
}

async function reverseTransaction(data: SimulatedData, transactionId: string, reason: string) {
  await axios.post(
    `${API_BASE}/operator-tools/reverse`,
    {
      transactionId,
      reason,
    },
    {
      headers: {
        Authorization: `Bearer ${data.adminToken}`,
      },
    },
  );
}

async function generateReports(data: SimulatedData) {
  console.log('\n📈 Generating Reports...\n');

  // Weekly Report
  const weekResponse = await axios.get(`${API_BASE}/analytics/pilot-weekly-report`, {
    headers: { Authorization: `Bearer ${data.adminToken}` },
  });

  const report = weekResponse.data;
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 WEEKLY PILOT REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Week: ${report.week}`);
  console.log(`Period: ${report.period.start} to ${report.period.end}\n`);

  console.log('📈 Metrics:');
  console.log(`  • Active Customers: ${report.metrics.weekly.activeCustomers}`);
  console.log(`  • Repeat Customers: ${report.metrics.weekly.repeatCustomers}`);
  console.log(`  • Total Transactions: ${report.metrics.weekly.transactionsTotal}`);
  console.log(`    - Issues: ${report.metrics.weekly.transactionsIssue}`);
  console.log(`    - Redeems: ${report.metrics.weekly.transactionsRedeem}`);
  console.log(`    - Adjustments: ${report.metrics.weekly.transactionsAdjust}`);
  console.log(`    - Reversals: ${report.metrics.weekly.transactionsReverse}`);
  console.log(`  • Redemption Rate: ${(report.metrics.weekly.transactionsIssue > 0 ? (report.metrics.weekly.transactionsRedeem / report.metrics.weekly.transactionsIssue * 100) : 0).toFixed(1)}%`);
  console.log(`  • Scan Errors: ${report.metrics.weekly.scanErrorsTotal}\n`);

  if (report.summary) {
    console.log('✓ What Improved:');
    report.summary.improved.forEach((item: string) => console.log(`  • ${item}`));
    console.log('');
    if (report.summary.needsFixing.length > 0) {
      console.log('⚠️  What Needs Fixing:');
      report.summary.needsFixing.forEach((item: string) => console.log(`  • ${item}`));
      console.log('');
    }
  }

  // Onboarding Funnel
  const funnelResponse = await axios.get(`${API_BASE}/analytics/pilot-onboarding-funnel`, {
    headers: { Authorization: `Bearer ${data.adminToken}` },
  });

  const funnel = funnelResponse.data;
  if (funnel) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 ONBOARDING FUNNEL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (funnel.durations) {
      console.log(`Time to Location: ${funnel.durations.timeToLocationMinutes || 'N/A'} minutes`);
      console.log(`Time to Staff: ${funnel.durations.timeToStaffMinutes || 'N/A'} minutes`);
      console.log(`Time to Device: ${funnel.durations.timeToDeviceMinutes || 'N/A'} minutes`);
      console.log(`Time to First Scan: ${funnel.durations.timeToFirstScanMinutes || 'N/A'} minutes`);
    }
    console.log('');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
