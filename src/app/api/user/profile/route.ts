import { NextResponse } from 'next/server';
import { getConfig, setConfig } from '@/lib/storage/kvStore';

export async function GET() {
  const profile = await getConfig('user_profile') || {
    name: 'Mohamed Waseem',
    email: 'waseem@pentacloudconsulting.com',
    company: 'Pentacloud Consulting',
  };
  return NextResponse.json({ success: true, profile });
}

export async function POST(request: Request) {
  const body = await request.json();
  await setConfig('user_profile', body);
  return NextResponse.json({ success: true, profile: body });
}
