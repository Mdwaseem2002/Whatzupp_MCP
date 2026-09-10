import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import UserProfile from '@/models/UserProfile';
import User from '@/models/User';
import Workspace from '@/models/Workspace';
import WorkspaceContact from '@/models/WorkspaceContact';
import FastReply from '@/models/FastReply';

// Default SFMC user ID — used when auth is bypassed
const SFMC_USER_ID = 'sfmc-default-user';

export async function GET(request: NextRequest) {
  try {
    // Auth bypassed — SFMC integration handles identity
    const userId = SFMC_USER_ID;

    let profileData = null;
    let workspaces = [];
    let contacts = [];
    let fastReplies = [];

    try {
      await connectMongoDB();

      // Fetch all user data in parallel
      const [profile, user, ws, c, fr] = await Promise.all([
        UserProfile.findOne({ userId }).lean(),
        User.findById(userId).lean().catch(() => null),
        Workspace.find({ userId }).sort({ createdAt: 1 }).lean(),
        WorkspaceContact.find({ userId }).sort({ createdAt: -1 }).lean(),
        FastReply.find({ userId }).sort({ shortcut: 1 }).lean(),
      ]);

      const formatDocs = (docs: any[]) => docs.map(doc => ({ ...doc, id: doc._id.toString(), _id: undefined, __v: undefined }));
      
      workspaces = formatDocs(ws);
      contacts = formatDocs(c);
      fastReplies = formatDocs(fr);

      if (profile) {
        profileData = { ...profile, id: (profile as any)._id?.toString(), _id: undefined, __v: undefined };
        if (user) {
          if (!profileData.email) profileData.email = (user as any).email || '';
          if (!profileData.name) profileData.name = (user as any).name || '';
        }
      }
    } catch (dbError) {
      console.warn('[User Sync] MongoDB disabled or failed. Falling back to SFMC Data Extensions.', dbError);
      
      // Fallback: Fetch contacts directly from SFMC WhatsApp_Test_Audience Data Extension
      try {
        const { getSfmcAccessToken } = await import('@/lib/sfmcAuth');
        const { access_token } = await getSfmcAccessToken();
        const sfmcRestBaseUri = process.env.SFMC_REST_BASE_URI || '';
        const baseUri = sfmcRestBaseUri.replace(/\/$/, '');
        
        const url = `${baseUri}/data/v1/customobjectdata/key/WhatsApp_Test_Audience/rowset?$pageSize=2500`;
        const sfmcRes = await fetch(url, { headers: { 'Authorization': `Bearer ${access_token}` } });
        
        if (sfmcRes.ok) {
          const sfmcData = await sfmcRes.json();
          if (sfmcData.items) {
            console.log('[DEBUG] First SFMC row (Audience):', JSON.stringify(sfmcData.items[0]));
            contacts = sfmcData.items.map((row: any, i: number) => {
              // Helper to do case-insensitive search across flat row, keys, and values
              const getValue = (keyName: string) => {
                const lowerKey = keyName.toLowerCase();
                const searchObj = (obj: any) => {
                  if (!obj) return null;
                  const key = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
                  return key ? obj[key] : null;
                };
                return searchObj(row.keys) || searchObj(row.values) || searchObj(row) || '';
              };

              const name = getValue('ContactKey') || `Contact ${i}`;
              const phone = getValue('MobilePhone') || '';
              return {
                id: name + '_' + i,
                name: name,
                phoneNumber: phone,
                workspaceId: 'sfmc-ws-1',
                tags: [],
                company: '',
                email: ''
              };
            });
          }
        }

        // Fetch Fast Replies from SFMC DE
        const fastReplyUrl = `${baseUri}/data/v1/customobjectdata/key/WhatsApp_Fast_Replies/rowset?$pageSize=2500`;
        const sfmcFastReplyRes = await fetch(fastReplyUrl, { headers: { 'Authorization': `Bearer ${access_token}` } });
        if (sfmcFastReplyRes.ok) {
          const sfmcFRData = await sfmcFastReplyRes.json();
          if (sfmcFRData.items) {
            console.log('[DEBUG] First SFMC row (FastReplies):', JSON.stringify(sfmcFRData.items[0]));
            fastReplies = sfmcFRData.items.map((row: any, i: number) => {
              const getValue = (keyName: string) => {
                const lowerKey = keyName.toLowerCase();
                const searchObj = (obj: any) => {
                  if (!obj) return null;
                  const key = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
                  return key ? obj[key] : null;
                };
                return searchObj(row.keys) || searchObj(row.values) || searchObj(row) || '';
              };

              return {
                id: getValue('Id') || `fr_${i}`,
                userId: getValue('UserId') || SFMC_USER_ID,
                title: getValue('Title') || 'Untitled',
                body: getValue('Body') || '',
                createdAt: getValue('CreatedAt') || new Date().toISOString(),
              };
            });
          }
        }
      } catch (sfmcError) {
        console.error('[User Sync] SFMC fallback failed:', sfmcError);
      }
    }

    if (workspaces.length === 0) {
      workspaces = [
        {
          id: 'sfmc-ws-1',
          name: 'Marketing Cloud Workspace',
          type: 'sfmc',
          status: 'connected',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'salescloud-ws-1',
          name: 'Sales Cloud Workspace',
          type: 'salescloud',
          status: 'connected',
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return NextResponse.json({
      success: true,
      data: {
        profile: profileData,
        workspaces,
        contacts,
        fastReplies,
      }
    });

  } catch (error: any) {
    console.error('[User Sync] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
