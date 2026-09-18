// src/lib/authMiddleware.ts
// Server-side authentication & authorization middleware for WhatZupp SaaS
// Used by API routes to validate tenant, role, and workspace permissions
// Does NOT modify any existing connector, webhook, or routing logic

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from './auth';

export interface SessionPayload {
  userId: string;
  tenantId: string | null;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TENANT_USER';
  workspacePermissions: string[];
  email: string;
  fullName: string;
}

/**
 * Extracts and validates session from request cookies or Authorization header.
 * Returns null if no valid session found.
 */
export async function getSession(request: NextRequest | Request): Promise<SessionPayload | null> {
  let token: string | undefined;

  // Try cookie first
  const cookieHeader = request.headers.get('cookie') || '';
  const sessionMatch = cookieHeader.match(/whatsapp_session=([^;]+)/);
  if (sessionMatch) {
    token = sessionMatch[1];
  }

  // Try Authorization header
  if (!token) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  return payload as unknown as SessionPayload;
}

/**
 * Validates that the session user has the required role.
 */
export function requireRole(session: SessionPayload, ...allowedRoles: string[]): boolean {
  return allowedRoles.includes(session.role);
}

/**
 * Validates that the session user has access to the specified workspace type.
 * SUPER_ADMIN always has access to all workspaces.
 */
export function hasWorkspaceAccess(session: SessionPayload, workspaceType: string): boolean {
  if (session.role === 'SUPER_ADMIN') return true;
  return session.workspacePermissions.includes(workspaceType);
}

/**
 * Returns a 401 Unauthorized response.
 */
export function unauthorized(message = 'Unauthorized: Please log in') {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

/**
 * Returns a 403 Forbidden response.
 */
export function forbidden(message = 'Forbidden: You do not have permission to access this resource') {
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}

/**
 * Helper: Require authentication and return session or error response.
 * Usage in API routes:
 *   const { session, error } = await requireAuth(request);
 *   if (error) return error;
 *   // session is guaranteed non-null here
 */
export async function requireAuth(request: NextRequest | Request): Promise<{
  session: SessionPayload | null;
  error: NextResponse | null;
}> {
  const session = await getSession(request);
  if (!session) {
    return { session: null, error: unauthorized() };
  }
  return { session, error: null };
}

/**
 * Helper: Require SUPER_ADMIN role.
 */
export async function requireSuperAdmin(request: NextRequest | Request): Promise<{
  session: SessionPayload | null;
  error: NextResponse | null;
}> {
  const { session, error } = await requireAuth(request);
  if (error) return { session: null, error };
  if (!requireRole(session!, 'SUPER_ADMIN')) {
    return { session: null, error: forbidden('Forbidden: SUPER_ADMIN access required') };
  }
  return { session, error: null };
}

/**
 * Helper: Require a specific workspace permission.
 */
export async function requireWorkspace(request: NextRequest | Request, workspaceType: string): Promise<{
  session: SessionPayload | null;
  error: NextResponse | null;
}> {
  const { session, error } = await requireAuth(request);
  if (error) return { session: null, error };
  if (!hasWorkspaceAccess(session!, workspaceType)) {
    return { session: null, error: forbidden(`Forbidden: ${workspaceType} access required`) };
  }
  return { session, error: null };
}
