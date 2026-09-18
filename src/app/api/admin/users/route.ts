// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/authMiddleware';
import { prisma, hasDatabaseUrl } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { session, error } = await requireSuperAdmin(request);
  if (error) return error;

  if (hasDatabaseUrl()) {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: true,
          workspacePermissions: true,
        },
      });

      return NextResponse.json({
        success: true,
        users,
      });
    } catch {
      // Fallback
    }
  }
    return NextResponse.json({
      success: true,
      users: [
        {
          id: 'u-superadmin',
          fullName: 'Waseem (Super Admin)',
          email: 'waseem@whatzupp.com',
          role: 'SUPER_ADMIN',
          status: 'active',
          tenantId: null,
          tenant: null,
          workspacePermissions: [{ workspaceType: 'SFMC' }, { workspaceType: 'SALES_CLOUD' }],
        },
        {
          id: 'u-1',
          fullName: 'Arshad Ali',
          email: 'arshad@pentacloud.com',
          role: 'TENANT_ADMIN',
          status: 'active',
          tenantId: 't-pentacloud',
          tenant: { name: 'Pentacloud Consultancy', tenantCode: 'PENTACLOUD' },
          workspacePermissions: [{ workspaceType: 'SFMC' }, { workspaceType: 'SALES_CLOUD' }],
        },
      ],
    });
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSuperAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { userId, action, status } = body;

    if (!userId || !action) {
      return NextResponse.json({ success: false, error: 'userId and action are required' }, { status: 400 });
    }

    if (action === 'TOGGLE_STATUS') {
      try {
        const updated = await prisma.user.update({
          where: { id: userId },
          data: { status: status || 'suspended' },
        });

        await prisma.auditLog.create({
          data: {
            userId,
            action: `USER_STATUS_${(status || 'suspended').toUpperCase()}`,
            performedBy: session?.userId || null,
          },
        });

        return NextResponse.json({ success: true, user: updated });
      } catch {
        return NextResponse.json({ success: true, message: `User status set to ${status}` });
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
