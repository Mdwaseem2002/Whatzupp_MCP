import { NextRequest, NextResponse } from 'next/server';
import { validateWorkspaceAccess } from '@/lib/workspaceMiddleware';

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
    const { phoneNumber, name, email } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });
    }

    const contact = await auth.connector!.resolveContact({
      phoneNumber,
      name,
      email,
    });

    return NextResponse.json({
      workspaceId,
      contact,
    });
  } catch (error: any) {
    console.error(`[API /workspaces/${workspaceId}/contacts/resolve] Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to resolve contact' }, { status: 500 });
  }
}
