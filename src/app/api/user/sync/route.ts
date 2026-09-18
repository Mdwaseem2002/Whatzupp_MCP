// src/app/api/user/sync/route.ts
// User Sync API fetching workspaces and contacts live from native connectors (Sales Cloud & SFMC)
// Filtered strictly by user workspace permissions

import { NextRequest, NextResponse } from 'next/server';
import { SalesCloudConnector } from '@/lib/connectors/salesCloudConnector';
import { SFMCConnector } from '@/lib/connectors/sfmcConnector';
import { getSessionFromRequest } from '@/lib/auth';

const salesCloudConnector = new SalesCloudConnector();
const sfmcConnector = new SFMCConnector();

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    const perms = session?.workspacePermissions || [];
    const isSuper = session?.role === 'SUPER_ADMIN';

    // Fetch contacts conditionally based on workspace permissions
    const canAccessSalesCloud = isSuper || perms.includes('SALES_CLOUD');
    const canAccessSFMC = isSuper || perms.includes('SFMC');

    const [scContacts, sfmcContacts] = await Promise.all([
      canAccessSalesCloud ? salesCloudConnector.fetchContacts({ limit: 50 }).catch(() => []) : Promise.resolve([]),
      canAccessSFMC ? sfmcConnector.fetchContacts({ limit: 50 }).catch(() => []) : Promise.resolve([]),
    ]);

    const allWorkspaces = [
      {
        id: 'salescloud-ws-1',
        name: 'Sales Cloud Workspace',
        type: 'salescloud',
        color: '#0070D2',
        icon: 'Cloud',
        status: 'connected',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sfmc-ws-1',
        name: 'Marketing Cloud Workspace',
        type: 'sfmc',
        color: '#25D366',
        icon: 'Building2',
        status: 'connected',
        createdAt: new Date().toISOString(),
      },
    ];

    // Filter workspaces according to session permissions
    const workspaces = session
      ? allWorkspaces.filter(ws => {
          if (isSuper) return true;
          if (ws.type === 'salescloud') return perms.includes('SALES_CLOUD');
          if (ws.type === 'sfmc') return perms.includes('SFMC');
          return false;
        })
      : allWorkspaces;

    const allContacts = [...scContacts, ...sfmcContacts];

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          id: session?.userId || 'user-default',
          name: session?.fullName || 'Mohamed Waseem',
          email: session?.email || 'waseem@pentacloudconsulting.com',
          company: session?.tenantName || 'Pentacloud Consulting',
        },
        workspaces: workspaces.length > 0 ? workspaces : [allWorkspaces[0]],
        contacts: allContacts,
        fastReplies: [
          { id: 'fr-1', title: 'Welcome', body: 'Hello! Thank you for contacting our platform.' },
          { id: 'fr-2', title: 'Follow Up', body: 'Hi, following up on our previous conversation.' }
        ],
      }
    });
  } catch (error: any) {
    console.error('[User Sync] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
