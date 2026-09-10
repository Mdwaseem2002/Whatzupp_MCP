import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig } from '@/lib/storage/kvStore';

export async function GET(request: NextRequest) {
  try {
    const automations = (await getConfig('automations') as any[]) || [];
    return NextResponse.json({
      success: true,
      data: automations,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const automations = (await getConfig('automations') as any[]) || [];
    const newJourney = {
      id: `journey_${Date.now()}`,
      userId: 'sfmc-default-user',
      workspaceId: body.workspaceId || 'salescloud-ws-1',
      name: body.name || 'New Journey',
      status: body.status || 'draft',
      nodes: body.nodes || [],
      edges: body.edges || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    automations.push(newJourney);
    await setConfig('automations', automations);

    return NextResponse.json({
      success: true,
      data: newJourney,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
