// src/app/api/admin/tenants/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/authMiddleware';
import { prisma, hasDatabaseUrl } from '@/lib/db';
import { getLocalTenants, saveLocalTenant, toggleLocalTenantStatus, deleteLocalTenant } from '@/lib/storage/tenantStore';

export async function GET(request: NextRequest) {
  const { session, error } = await requireSuperAdmin(request);
  if (error) return error;

  let dbTenants: any[] = [];

  if (hasDatabaseUrl()) {
    try {
      dbTenants = await prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          tenantWorkspaces: true,
          users: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              status: true,
            },
          },
        },
      });
    } catch {
      // Fallback
    }
  }

  const localTenants = getLocalTenants();

  const tenantMap = new Map<string, any>();
  for (const t of localTenants) {
    tenantMap.set(t.tenantCode, t);
  }
  for (const t of dbTenants) {
    tenantMap.set(t.tenantCode, t);
  }

  const combinedTenants = Array.from(tenantMap.values());

  return NextResponse.json({
    success: true,
    tenants: combinedTenants,
  });
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSuperAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { action, tenantId, status, name, tenantCode } = body;

    if (action === 'DELETE' && tenantId) {
      deleteLocalTenant(tenantId);
      if (hasDatabaseUrl()) {
        try {
          await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
        } catch {}
      }
      return NextResponse.json({ success: true, message: 'Tenant deleted successfully' });
    }

    if (action === 'TOGGLE_STATUS' && tenantId && status) {
      toggleLocalTenantStatus(tenantId, status);
      try {
        const updated = await prisma.tenant.update({
          where: { id: tenantId },
          data: { status },
        });

        await prisma.auditLog.create({
          data: {
            tenantId,
            action: `TENANT_STATUS_${status.toUpperCase()}`,
            performedBy: session?.userId || null,
          },
        });

        return NextResponse.json({ success: true, tenant: updated });
      } catch {
        return NextResponse.json({ success: true, message: `Tenant status updated to ${status}` });
      }
    }

    if (action === 'CREATE') {
      const code = (tenantCode || 'TENANT').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      const newTenant = {
        id: `t-${Date.now()}`,
        name: name || 'New Enterprise Client',
        tenantCode: code,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        tenantWorkspaces: [
          { workspaceType: 'SFMC' },
          { workspaceType: 'SALES_CLOUD' },
        ],
        users: [],
      };

      saveLocalTenant(newTenant);

      if (hasDatabaseUrl()) {
        try {
          const tenant = await prisma.tenant.create({
            data: {
              name: name || 'New Enterprise Client',
              tenantCode: code,
              status: 'active',
            },
          });
          return NextResponse.json({ success: true, tenant });
        } catch (err: any) {
          console.warn('DB Tenant create error:', err);
        }
      }

      return NextResponse.json({ success: true, tenant: newTenant });
    }

    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
