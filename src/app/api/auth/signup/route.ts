// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { prisma, hasDatabaseUrl } from '@/lib/db';
import { getLocalSignupRequests, saveLocalSignupRequest } from '@/lib/storage/signupStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, organizationName, email, phone, password, requestedWorkspaces } = body;

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Full name, email, and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    const workspaces: string[] = Array.isArray(requestedWorkspaces) && requestedWorkspaces.length > 0
      ? requestedWorkspaces
      : ['SFMC'];
    const orgName = organizationName || `${fullName}'s Organization`;

    // 1. Check local signup store for duplicates
    const localRequests = getLocalSignupRequests();
    const existingLocal = localRequests.find(r => r.email.toLowerCase() === cleanEmail);
    if (existingLocal) {
      if (existingLocal.status === 'PENDING') {
        return NextResponse.json(
          { success: false, error: 'A signup request for this email is already pending admin approval.' },
          { status: 400 }
        );
      }
      if (existingLocal.status === 'APPROVED') {
        return NextResponse.json(
          { success: false, error: 'This signup request has already been approved. Please log in.' },
          { status: 400 }
        );
      }
    }

    // 2. Always persist locally first so it shows in admin queue immediately
    const reqId = `req-${Date.now()}`;
    const newLocalReq = {
      id: reqId,
      fullName,
      organizationName: orgName,
      email: cleanEmail,
      phone: phone || null,
      passwordHash,
      requestedWorkspaces: workspaces,
      status: 'PENDING' as const,
      createdAt: new Date().toISOString(),
    };
    saveLocalSignupRequest(newLocalReq);

    // 3. Try DB insertion if configured
    if (hasDatabaseUrl()) {
      try {
        const existingUser = await prisma.user.findUnique({
          where: { email: cleanEmail },
        });

        if (existingUser) {
          return NextResponse.json(
            { success: false, error: 'An account with this email already exists. Please log in.' },
            { status: 400 }
          );
        }

        const signupReq = await prisma.signupRequest.create({
          data: {
            fullName,
            organizationName: orgName,
            email: cleanEmail,
            phone: phone || null,
            passwordHash,
            requestedWorkspaces: workspaces,
            status: 'PENDING',
          },
        });

        await prisma.adminNotification.create({
          data: {
            type: 'SIGNUP_REQUEST',
            referenceId: signupReq.id,
          },
        });
      } catch (dbErr: any) {
        console.warn('Prisma signup execution note (DB fallback active):', dbErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Signup request submitted successfully! Your request is pending admin approval.',
      requestId: reqId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit signup request' },
      { status: 500 }
    );
  }
}
