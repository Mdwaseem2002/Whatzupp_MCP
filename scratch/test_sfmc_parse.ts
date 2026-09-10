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

function getFieldValue(row: any, fieldName: string): string {
  const lowerKey = fieldName.toLowerCase();
  
  const searchObj = (obj: any) => {
    if (!obj) return null;
    const key = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
    return key ? obj[key] : null;
  };

  return searchObj(row.keys) || searchObj(row.values) || searchObj(row) || '';
}

async function testParse() {
  const { access_token } = await getSfmcAccessToken();
  const restBase = (process.env.SFMC_REST_BASE_URI || '').replace(/\/$/, '');

  const urlSent = `${restBase}/data/v1/customobjectdata/key/WhatsApp_Sent_Messages/rowset?$pageSize=2500`;
  const resSent = await fetch(urlSent, { headers: { Authorization: `Bearer ${access_token}` } });
  const dataSent = await resSent.json();

  const urlRecv = `${restBase}/data/v1/customobjectdata/key/WhatsApp_Received_Messages/rowset?$pageSize=2500`;
  const resRecv = await fetch(urlRecv, { headers: { Authorization: `Bearer ${access_token}` } });
  const dataRecv = await resRecv.json();

  const phoneQuery = '9952374972';

  const sentMsgs: any[] = [];
  (dataSent.items || []).forEach((row: any) => {
    const phone = getFieldValue(row, 'Phone');
    const wamid = getFieldValue(row, 'WaMid');
    const content = getFieldValue(row, 'MessageContent') || `[Template: ${getFieldValue(row, 'TemplateName')}]`;
    const timestamp = getFieldValue(row, 'SentTime') || getFieldValue(row, 'CreatedDate');

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.endsWith(phoneQuery)) {
      sentMsgs.push({ wamid, phone, content, timestamp });
    }
  });

  const recvMsgs: any[] = [];
  (dataRecv.items || []).forEach((row: any) => {
    const phone = getFieldValue(row, 'Phone');
    const wamid = getFieldValue(row, 'WaMid');
    const content = getFieldValue(row, 'MessageContent');
    const timestamp = getFieldValue(row, 'ReceivedTime') || getFieldValue(row, 'CreatedDate');

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.endsWith(phoneQuery)) {
      recvMsgs.push({ wamid, phone, content, timestamp });
    }
  });

  console.log(`Found ${sentMsgs.length} sent messages for ${phoneQuery}:`);
  sentMsgs.slice(-5).forEach(m => console.log('  Sent:', m));

  console.log(`\nFound ${recvMsgs.length} received messages for ${phoneQuery}:`);
  recvMsgs.slice(-5).forEach(m => console.log('  Recv:', m));
}

testParse();
