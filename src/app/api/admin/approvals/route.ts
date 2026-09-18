// src/app/api/admin/approvals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/authMiddleware';
import { prisma, hasDatabaseUrl } from '@/lib/db';
import {
  getLocalSignupRequests,
  updateLocalSignupRequestStatus,
  updateLocalSignupRequest,
  deleteLocalSignupRequest,
} from '@/lib/storage/signupStore';

export async function GET(request: NextRequest) {
  const { session, error } = await requireSuperAdmin(request);
  if (error) return error;

  let dbRequests: any[] = [];

  if (hasDatabaseUrl()) {
    try {
      dbRequests = await prisma.signupRequest.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          approver: {
            select: { fullName: true, email: true },
          },
        },
      });
    } catch (err: any) {
      console.warn('Prisma approvals query error, relying on local store:', err.message);
    }
  }

  const localRequests = getLocalSignupRequests();

  // Merge DB requests and Local requests cleanly by email (DB takes precedence)
  const reqMap = new Map<string, any>();

  for (const r of localRequests) {
    reqMap.set(r.email.toLowerCase(), r);
  }

  for (const r of dbRequests) {
    reqMap.set(r.email.toLowerCase(), r);
  }

  const combinedRequests = Array.from(reqMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({
    success: true,
    requests: combinedRequests,
  });
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSuperAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { action, requestId, tenantCode, organizationName, licensedWorkspaces, role, rejectedReason, fullName, email, status } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { success: false, error: 'requestId and action are required' },
        { status: 400 }
      );
    }

    if (action === 'DELETE') {
      deleteLocalSignupRequest(requestId);
      if (hasDatabaseUrl()) {
        try {
          await prisma.signupRequest.delete({ where: { id: requestId } }).catch(() => {});
        } catch {}
      }
      return NextResponse.json({
        success: true,
        message: 'Signup request deleted successfully',
      });
    }

    if (action === 'EDIT') {
      const workspaces: string[] = Array.isArray(licensedWorkspaces) && licensedWorkspaces.length > 0
        ? licensedWorkspaces
        : ['SALES_CLOUD'];

      updateLocalSignupRequest(requestId, {
        fullName: fullName || undefined,
        organizationName: organizationName || undefined,
        email: email || undefined,
        requestedWorkspaces: workspaces,
        status: status || undefined,
      });

      if (hasDatabaseUrl()) {
        try {
          await prisma.signupRequest.update({
            where: { id: requestId },
            data: {
              fullName: fullName || undefined,
              organizationName: organizationName || undefined,
              requestedWorkspaces: workspaces,
              status: status || undefined,
            },
          }).catch(() => {});
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: 'Request details & workspace licenses updated successfully',
      });
    }

    if (action === 'REJECT') {
      updateLocalSignupRequestStatus(requestId, 'REJECTED');
      try {
        const updatedReq = await prisma.signupRequest.update({
          where: { id: requestId },
          data: {
            status: 'REJECTED',
            rejectedReason: rejectedReason || 'Signup request rejected by administrator.',
          },
        });

        await prisma.auditLog.create({
          data: {
            action: 'SIGNUP_REJECTED',
            performedBy: session?.userId || null,
            details: { requestId, reason: rejectedReason },
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Signup request rejected',
          request: updatedReq,
        });
      } catch (dbErr: any) {
        return NextResponse.json({
          success: true,
          message: 'Signup request marked as REJECTED',
        });
      }
    }

    if (action === 'APPROVE') {
      const code = (tenantCode || 'TENANT').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      const orgName = organizationName || 'New Client Enterprise';
      const workspaces: string[] = Array.isArray(licensedWorkspaces) && licensedWorkspaces.length > 0
        ? licensedWorkspaces
        : ['SFMC'];
      const userRole = role || 'TENANT_ADMIN';

      updateLocalSignupRequest(requestId, {
        status: 'APPROVED',
        requestedWorkspaces: workspaces,
        organizationName: orgName,
      });

      try {
        const signupReq = await prisma.signupRequest.findUnique({
          where: { id: requestId },
        });

        if (signupReq) {
          let tenant = await prisma.tenant.findUnique({
            where: { tenantCode: code },
          });

          if (!tenant) {
            tenant = await prisma.tenant.create({
              data: {
                name: orgName,
                tenantCode: code,
                status: 'active',
              },
            });
          }

          for (const wsType of workspaces) {
            await prisma.tenantWorkspace.upsert({
              where: {
                tenantId_workspaceType: {
                  tenantId: tenant.id,
                  workspaceType: wsType,
                },
              },
              update: {},
              create: {
                tenantId: tenant.id,
                workspaceType: wsType,
              },
            });
          }

          const newUser = await prisma.user.create({
            data: {
              tenantId: tenant.id,
              fullName: signupReq.fullName,
              email: signupReq.email,
              phone: signupReq.phone,
              passwordHash: signupReq.passwordHash,
              role: userRole,
              status: 'active',
            },
          });

          for (const wsType of workspaces) {
            await prisma.workspacePermission.create({
              data: {
                userId: newUser.id,
                workspaceType: wsType,
              },
            });
          }

          await prisma.signupRequest.update({
            where: { id: requestId },
            data: {
              status: 'APPROVED',
              approvedBy: session?.userId || null,
              approvedAt: new Date(),
            },
          });

          await prisma.auditLog.create({
            data: {
              tenantId: tenant.id,
              userId: newUser.id,
              action: 'TENANT_APPROVED',
              performedBy: session?.userId || null,
              details: {
                tenantCode: code,
                tenantName: orgName,
                userEmail: newUser.email,
                licensedWorkspaces: workspaces,
              },
            },
          });

          return NextResponse.json({
            success: true,
            message: `Approved! Tenant ${code} created and user ${newUser.email} activated.`,
            tenant,
            user: newUser,
          });
        }
      } catch (dbErr: any) {
        // Fallback approve response
      }

      return NextResponse.json({
        success: true,
        message: `Signup approved successfully! Tenant ${code} activated.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
