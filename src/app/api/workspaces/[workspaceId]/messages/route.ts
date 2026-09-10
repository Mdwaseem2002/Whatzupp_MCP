import { NextRequest, NextResponse } from 'next/server';
import { validateWorkspaceAccess } from '@/lib/workspaceMiddleware';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await context.params;
  const auth = await validateWorkspaceAccess(request, workspaceId);

  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  const { searchParams } = new URL(request.url);
  const recordId = searchParams.get('recordId') || undefined;
  const phoneNumber = searchParams.get('phoneNumber') || undefined;
  const cursor = searchParams.get('cursor') || undefined;
  const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : 50;

  try {
    const page = await auth.connector!.fetchMessages({
      recordId,
      phoneNumber,
      cursor,
      pageSize,
    });
    return NextResponse.json({
      workspaceId,
      messages: page.messages,
      nextCursor: page.nextCursor,
    });
  } catch (error: any) {
    console.error(`[API /workspaces/${workspaceId}/messages] GET Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await context.params;
  const auth = await validateWorkspaceAccess(request, workspaceId);

  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json();
    const { recipientPhone, content, salesforceRecordId, salesforceObjectType } = body;

    if (!recipientPhone || !content) {
      return NextResponse.json({ error: 'recipientPhone and content are required' }, { status: 400 });
    }

    const result = await auth.connector!.sendMessage({
      recipientPhone,
      content,
      salesforceRecordId,
      salesforceObjectType,
    });

    return NextResponse.json({
      workspaceId,
      messageId: result.messageId,
      status: result.status,
    });
  } catch (error: any) {
    console.error(`[API /workspaces/${workspaceId}/messages] POST Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 });
  }
}
