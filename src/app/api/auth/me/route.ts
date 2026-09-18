// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma, hasDatabaseUrl } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({
        success: false,
        authenticated: false,
        user: null,
      }, { status: 401 });
    }

    // Try to fetch latest DB state if database is configured
    if (hasDatabaseUrl()) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: session.userId },
          include: {
            tenant: true,
            workspacePermissions: true,
          },
        });

        if (user) {
          if (user.status !== 'active') {
            return NextResponse.json({
              success: false,
              authenticated: false,
              error: `Account is ${user.status}`,
            }, { status: 403 });
          }

          return NextResponse.json({
            success: true,
            authenticated: true,
            user: {
              userId: user.id,
              email: user.email,
              fullName: user.fullName,
              tenantId: user.tenantId,
              tenantName: user.tenant?.name || null,
              role: user.role,
              workspacePermissions: user.workspacePermissions.map((p: { workspaceType: string }) => p.workspaceType),
            },
          });
        }
      } catch {
        // Fallback to JWT session payload if DB query fails
      }
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: session,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      authenticated: false,
      error: error.message || 'Failed to fetch session',
    }, { status: 500 });
  }
}
