// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createSessionToken, setSessionCookie, SessionPayload } from '@/lib/auth';
import { prisma, hasDatabaseUrl } from '@/lib/db';
import { getLocalSignupRequests } from '@/lib/storage/signupStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Try Prisma DB query if DATABASE_URL is configured
    if (hasDatabaseUrl()) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: cleanEmail },
          include: {
            tenant: true,
            workspacePermissions: true,
          },
        });

        if (user) {
          // Status checks
          if (user.status === 'suspended' || user.status === 'disabled') {
            return NextResponse.json(
              { success: false, error: 'Your account has been suspended or disabled by administrator.' },
              { status: 403 }
            );
          }

          const isPasswordValid = await verifyPassword(password, user.passwordHash);
          if (!isPasswordValid) {
            return NextResponse.json(
              { success: false, error: 'Invalid email or password' },
              { status: 401 }
            );
          }

          const sessionPayload: SessionPayload = {
            userId: user.id,
            email: user.email,
            fullName: user.fullName,
            tenantId: user.tenantId,
            tenantCode: user.tenant?.tenantCode || null,
            tenantName: user.tenant?.name || null,
            role: user.role as 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TENANT_USER',
            workspacePermissions: user.workspacePermissions.map((p: { workspaceType: string }) => p.workspaceType),
          };

          const token = await createSessionToken(sessionPayload);
          await setSessionCookie(token);

          return NextResponse.json({
            success: true,
            message: 'Login successful',
            user: sessionPayload,
          });
        }

        // Check if user has a pending or rejected SignupRequest in DB
        const signupReq = await prisma.signupRequest.findUnique({
          where: { email: cleanEmail },
        });

        if (signupReq) {
          if (signupReq.status === 'PENDING') {
            return NextResponse.json(
              { success: false, error: 'Your account signup request is pending admin approval.' },
              { status: 403 }
            );
          }
          if (signupReq.status === 'REJECTED') {
            return NextResponse.json(
              {
                success: false,
                error: `Signup request rejected: ${signupReq.rejectedReason || 'Does not meet onboarding criteria.'}`,
              },
              { status: 403 }
            );
          }
        }
      } catch (dbErr) {
        console.warn('Prisma DB query failed during login, checking local fallback store:', dbErr);
      }
    }

    // 2. Check local signup requests store
    const localRequests = getLocalSignupRequests();
    const localReq = localRequests.find(r => r.email.toLowerCase() === cleanEmail);

    if (localReq) {
      if (localReq.status === 'PENDING') {
        return NextResponse.json(
          { success: false, error: 'Your account signup request is pending admin approval.' },
          { status: 403 }
        );
      }

      if (localReq.status === 'REJECTED') {
        return NextResponse.json(
          { success: false, error: 'Signup request rejected: Does not meet onboarding criteria.' },
          { status: 403 }
        );
      }

      if (localReq.status === 'APPROVED') {
        // If passwordHash exists, verify it. If missing (legacy request), allow login.
        if (localReq.passwordHash) {
          const isPasswordValid = await verifyPassword(password, localReq.passwordHash);
          if (!isPasswordValid) {
            return NextResponse.json(
              { success: false, error: 'Invalid email or password' },
              { status: 401 }
            );
          }
        }

        const tenantCode = (localReq.organizationName || 'TENANT').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        const sessionPayload: SessionPayload = {
          userId: localReq.id,
          email: localReq.email,
          fullName: localReq.fullName,
          tenantId: `t-${tenantCode.toLowerCase()}`,
          tenantCode,
          tenantName: localReq.organizationName,
          role: 'TENANT_ADMIN',
          workspacePermissions: localReq.requestedWorkspaces || ['SFMC', 'SALES_CLOUD'],
        };

        const token = await createSessionToken(sessionPayload);
        await setSessionCookie(token);

        return NextResponse.json({
          success: true,
          message: 'Login successful',
          user: sessionPayload,
        });
      }
    }

    // 3. Fallback Admin Credentials
    if (
      cleanEmail === 'admin@whatzupp.com' ||
      cleanEmail === 'waseem@whatzupp.com' ||
      cleanEmail === 'waseem@pentacloudconsulting.com'
    ) {
      if (password === 'Pentacloud@123' || password === 'WhatZupp@Admin2026' || password === 'admin123') {
        const adminPayload: SessionPayload = {
          userId: 'super-admin-seed-id',
          email: cleanEmail,
          fullName: 'Waseem (Super Admin)',
          tenantId: null,
          role: 'SUPER_ADMIN',
          workspacePermissions: ['SFMC', 'SALES_CLOUD'],
        };

        const token = await createSessionToken(adminPayload);
        await setSessionCookie(token);

        return NextResponse.json({
          success: true,
          message: 'Login successful (Super Admin)',
          user: adminPayload,
        });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid email or password' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error during login' },
      { status: 500 }
    );
  }
}
