/**
 * Seed script for demo/pilot tenants
 * Run with: npx ts-node src/scripts/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Coffee Shop',
      config: {},
    },
  });

  console.log(`✅ Created tenant: ${tenant.name}`);

  // Create demo location
  const location = await prisma.location.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      tenantId: tenant.id,
      name: 'Main Store',
      address: '123 Main St, Doha, Qatar',
      isActive: true,
    },
  });

  console.log(`✅ Created location: ${location.name}`);

  // Create demo admin user
  const hashedPassword = await bcrypt.hash('demo123456', 10);
  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'admin@demo.com',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.com',
      hashedPassword,
      roles: ['MERCHANT_ADMIN'],
      scopes: ['merchant:*'],
      isActive: true,
    },
  });

  console.log(`✅ Created admin user: ${adminUser.email} (password: demo123456)`);

  // Create demo staff user
  const staffPassword = await bcrypt.hash('staff123456', 10);
  const staffUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'staff@demo.com',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'staff@demo.com',
      hashedPassword: staffPassword,
      roles: ['STAFF'],
      scopes: ['scan:*'],
      isActive: true,
    },
  });

  console.log(`✅ Created staff user: ${staffUser.email} (password: staff123456)`);

  // Create demo reward
  const reward = await prisma.reward.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      tenantId: tenant.id,
      name: 'Free Coffee',
      pointsRequired: 100,
      description: 'Redeem 100 points for a free coffee',
      isActive: true,
    },
  });

  console.log(`✅ Created reward: ${reward.name}`);

  console.log('\n✅ Seeding complete!');
  console.log('\nDemo credentials:');
  console.log('  Admin: admin@demo.com / demo123456');
  console.log('  Staff: staff@demo.com / staff123456');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
