// src/app/api/admin/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/authMiddleware';
import { prisma, hasDatabaseUrl } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { session, error } = await requireSuperAdmin(request);
  if (error) return error;

  if (hasDatabaseUrl()) {
    try {
      const notifications = await prisma.adminNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const unreadCount = await prisma.adminNotification.count({
        where: { isRead: false },
      });

      return NextResponse.json({
        success: true,
        notifications,
        unreadCount,
      });
    } catch {
      // Fallback
    }
  }
    return NextResponse.json({
      success: true,
      notifications: [
        {
          id: 'n-1',
          type: 'SIGNUP_REQUEST',
          referenceId: 'demo-req-1',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    });
}
