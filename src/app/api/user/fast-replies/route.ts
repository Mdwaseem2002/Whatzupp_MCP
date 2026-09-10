import { NextResponse } from 'next/server';
import { getConfig, setConfig } from '@/lib/storage/kvStore';

export async function GET() {
  const fastReplies = (await getConfig('fast_replies') as any[]) || [
    { id: 'fr-1', title: 'Welcome', body: 'Hello! Thank you for contacting Pentacloud Consulting.' },
    { id: 'fr-2', title: 'Follow Up', body: 'Hi, following up on our previous conversation.' }
  ];
  return NextResponse.json({ success: true, data: fastReplies });
}

export async function POST(request: Request) {
  const body = await request.json();
  const fastReplies = (await getConfig('fast_replies') as any[]) || [];
  fastReplies.push({ ...body, id: `fr_${Date.now()}` });
  await setConfig('fast_replies', fastReplies);
  return NextResponse.json({ success: true, data: fastReplies });
}
