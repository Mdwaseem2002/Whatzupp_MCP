import { NextRequest, NextResponse } from 'next/server';
import { validateWorkspaceAccess } from '@/lib/workspaceMiddleware';

export const dynamic = 'force-dynamic';

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
  const search = searchParams.get('search') || undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

  try {
    const contacts = await auth.connector!.fetchContacts({ search, limit });
    return NextResponse.json({
      workspaceId,
      contacts,
      count: contacts.length,
    });
  } catch (error: any) {
    console.error(`[API /workspaces/${workspaceId}/contacts] Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to fetch contacts' }, { status: 500 });
  }
}
