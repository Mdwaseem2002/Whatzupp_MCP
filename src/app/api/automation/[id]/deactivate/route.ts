import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig } from '@/lib/storage/kvStore';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const automations = (await getConfig('automations') as any[]) || [];
  const index = automations.findIndex(a => a.id === id);
  if (index >= 0) {
    automations[index].status = 'draft';
    automations[index].updatedAt = new Date().toISOString();
    await setConfig('automations', automations);
    return NextResponse.json({ success: true, data: automations[index] });
  }
  return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
}
