import { NextResponse } from 'next/server';

export async function GET() {
  const workspaces = [
    {
      id: 'salescloud-ws-1',
      name: 'Sales Cloud Workspace',
      type: 'salescloud',
      status: 'connected',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sfmc-ws-1',
      name: 'Marketing Cloud Workspace',
      type: 'sfmc',
      status: 'connected',
      createdAt: new Date().toISOString(),
    },
  ];
  return NextResponse.json({ success: true, data: workspaces });
}
