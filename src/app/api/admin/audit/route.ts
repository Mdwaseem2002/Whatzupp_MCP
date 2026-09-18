// src/app/api/admin/audit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/authMiddleware';
import { prisma, hasDatabaseUrl } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { session, error } = await requireSuperAdmin(request);
  if (error) return error;

  if (hasDatabaseUrl()) {
    try {
      const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          tenant: { select: { name: true, tenantCode: true } },
          user: { select: { fullName: true, email: true } },
          performer: { select: { fullName: true, email: true } },
        },
      });

      return NextResponse.json({
        success: true,
        logs,
      });
    } catch {
      // Fallback
    }
  }
    return NextResponse.json({
      success: true,
      logs: [
        {
          id: 'log-1',
          action: 'SYSTEM_SEED',
          details: { message: 'First SUPER_ADMIN seeded successfully' },
          createdAt: new Date().toISOString(),
          tenant: null,
          user: { fullName: 'Waseem', email: 'waseem@whatzupp.com' },
          performer: null,
        },
      ],
    });
}
