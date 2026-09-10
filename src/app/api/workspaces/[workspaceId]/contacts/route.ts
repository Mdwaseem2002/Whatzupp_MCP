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
    const { name, phoneNumber, email, company } = body;
    if (!name || !phoneNumber) {
      return NextResponse.json({ error: 'name and phoneNumber are required' }, { status: 400 });
    }

    const contact = await auth.connector!.createContact({ name, phoneNumber, email, company });
    return NextResponse.json({ success: true, workspaceId, contact });
  } catch (error: any) {
    console.error(`[API /workspaces/${workspaceId}/contacts] POST Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to create contact' }, { status: 500 });
  }
}

export async function PATCH(
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
    const { id, name, phoneNumber, email, company } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required for update' }, { status: 400 });
    }

    const success = await auth.connector!.updateContact(id, { name, phoneNumber, email, company });
    return NextResponse.json({ success, workspaceId, id });
  } catch (error: any) {
    console.error(`[API /workspaces/${workspaceId}/contacts] PATCH Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await context.params;
  const auth = await validateWorkspaceAccess(request, workspaceId);

  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
    }

    const success = await auth.connector!.deleteContact(id);
    return NextResponse.json({ success, workspaceId, id });
  } catch (error: any) {
    console.error(`[API /workspaces/${workspaceId}/contacts] DELETE Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to delete contact' }, { status: 500 });
  }
}
