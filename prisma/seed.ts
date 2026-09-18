// prisma/seed.ts
// Seeds the first SUPER_ADMIN user for WhatZupp SaaS Platform
// Run with: npx prisma db seed
//
// This creates:
// 1. Waseem as SUPER_ADMIN with tenantId = NULL (platform-level)
// 2. An audit log entry for the seed operation

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding WhatZupp SaaS Platform...');

  // Check if SUPER_ADMIN already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (existingAdmin) {
    console.log(`✅ SUPER_ADMIN already exists: ${existingAdmin.email}`);
    return;
  }

  // Create SUPER_ADMIN (platform-level, no tenant)
  const passwordHash = await bcrypt.hash('WhatZupp@Admin2026', 12);

  const superAdmin = await prisma.user.create({
    data: {
      fullName: 'Mohamed Waseem',
      email: 'waseem@pentacloudconsulting.com',
      phone: '919952374972',
      passwordHash,
      role: 'SUPER_ADMIN',
      tenantId: null, // Platform-level — not bound to any tenant
      status: 'active',
    },
  });

  console.log(`✅ SUPER_ADMIN created: ${superAdmin.email} (ID: ${superAdmin.id})`);

  // Create audit log for seed operation
  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      action: 'SYSTEM_SEED',
      details: {
        description: 'Initial SUPER_ADMIN account created via seed script',
        email: superAdmin.email,
        role: 'SUPER_ADMIN',
      },
      performedBy: superAdmin.id,
    },
  });

  console.log('✅ Audit log created: SYSTEM_SEED');
  console.log('');
  console.log('🎉 Seed complete!');
  console.log('');
  console.log('Login credentials:');
  console.log(`  Email:    ${superAdmin.email}`);
  console.log('  Password: WhatZupp@Admin2026');
  console.log('');
  console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
