import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function getSfmcAccessToken() {
  const sfmcClientId = process.env.SFMC_CLIENT_ID!;
  const sfmcClientSecret = process.env.SFMC_CLIENT_SECRET!;
  const sfmcAuthBaseUri = process.env.SFMC_AUTH_BASE_URI!.replace(/\/$/, '');

  const res = await fetch(`${sfmcAuthBaseUri}/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: sfmcClientId,
      client_secret: sfmcClientSecret,
    }),
  });

  if (!res.ok) throw new Error('Auth failed');
  return res.json();
}

async function checkSfmcDE() {
  try {
    const { access_token } = await getSfmcAccessToken();
    const sfmcRestBaseUri = process.env.SFMC_REST_BASE_URI!.replace(/\/$/, '');
    
    const url = `${sfmcRestBaseUri}/data/v1/customobjectdata/key/WhatsApp_Received_Messages/rowset?$orderBy=CreatedDate DESC&$top=5`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${access_token}` } });
    
    if (!res.ok) {
      console.log('Failed:', await res.text());
      return;
    }
    
    const data = await res.json();
    console.log(JSON.stringify(data.items, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

checkSfmcDE();
