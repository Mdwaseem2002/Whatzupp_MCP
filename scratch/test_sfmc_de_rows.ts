import fs from 'fs';
import path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        process.env[key] = val;
      }
    }
  });
}

import { getSfmcAccessToken } from '../src/lib/sfmcAuth';

async function testFetchDe() {
  try {
    const { access_token } = await getSfmcAccessToken();
    const restBase = (process.env.SFMC_REST_BASE_URI || '').replace(/\/$/, '');

    console.log('Fetching WhatsApp_Sent_Messages rowset...');
    const urlSent = `${restBase}/data/v1/customobjectdata/key/WhatsApp_Sent_Messages/rowset?$pageSize=2500`;
    const resSent = await fetch(urlSent, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const dataSent = await resSent.json();
    console.log('WhatsApp_Sent_Messages count:', dataSent.count, 'items length:', dataSent.items?.length);
    if (dataSent.items && dataSent.items.length > 0) {
      console.log('Sample Sent row FIRST (index 0):', JSON.stringify(dataSent.items[0], null, 2));
      console.log('Sample Sent row LAST:', JSON.stringify(dataSent.items[dataSent.items.length - 1], null, 2));
    }

    console.log('\nFetching WhatsApp_Received_Messages rowset...');
    const urlRecv = `${restBase}/data/v1/customobjectdata/key/WhatsApp_Received_Messages/rowset?$pageSize=2500`;
    const resRecv = await fetch(urlRecv, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const dataRecv = await resRecv.json();
    console.log('WhatsApp_Received_Messages count:', dataRecv.count, 'items length:', dataRecv.items?.length);
    if (dataRecv.items && dataRecv.items.length > 0) {
      console.log('Sample Recv row FIRST (index 0):', JSON.stringify(dataRecv.items[0], null, 2));
      console.log('Sample Recv row LAST:', JSON.stringify(dataRecv.items[dataRecv.items.length - 1], null, 2));
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

testFetchDe();
