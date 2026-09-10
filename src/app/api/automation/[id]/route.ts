import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig } from '@/lib/storage/kvStore';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const automations = (await getConfig('automations') as any[]) || [];
  const found = automations.find(a => a.id === id);
  return NextResponse.json({ success: true, data: found || null });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const automations = (await getConfig('automations') as any[]) || [];
  const index = automations.findIndex(a => a.id === id);
  if (index >= 0) {
    automations[index] = { ...automations[index], ...body, updatedAt: new Date().toISOString() };
    await setConfig('automations', automations);
    return NextResponse.json({ success: true, data: automations[index] });
  }
  return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const automations = (await getConfig('automations') as any[]) || [];
  const filtered = automations.filter(a => a.id !== id);
  await setConfig('automations', filtered);
  return NextResponse.json({ success: true });
}
