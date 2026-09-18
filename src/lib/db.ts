// src/lib/db.ts
// Prisma Client Singleton for Supabase Postgres
// Used by all SaaS layer APIs (auth, admin, tenant management)

import { PrismaClient } from '@prisma/client';

export function hasDatabaseUrl(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(
    url &&
    url.trim().length > 0 &&
    !url.includes('[YOUR-PASSWORD]') &&
    !url.includes('YOUR-PASSWORD')
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(process.env.DATABASE_URL && {
      datasourceUrl: process.env.DATABASE_URL,
    }),
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
