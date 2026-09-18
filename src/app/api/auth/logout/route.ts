// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { deleteSessionCookie } from '@/lib/auth';

export async function POST() {
  await deleteSessionCookie();
  return NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });
}
