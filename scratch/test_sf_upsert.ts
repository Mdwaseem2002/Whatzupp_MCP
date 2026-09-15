import { getSalesCloudAccessToken } from '../src/lib/salesCloudAuth';

async function testUpsert() {
  try {
    const { access_token, instance_url } = await getSalesCloudAccessToken();
    const wamid = `wamid.test.${Date.now()}`;
    const timestamp = new Date().toISOString();

    const payload: Record<string, any> = {
      Phone__c: '919952374972',
      Content__c: 'Test message from script',
      Direction__c: 'OUTBOUND',
      Status__c: 'SENT',
      Timestamp__c: timestamp,
    };

    const upsertUrl = `${instance_url}/services/data/v59.0/sobjects/WhatsApp_Message__c/Message_Id__c/${encodeURIComponent(wamid)}`;
    console.log('Posting upsert to:', upsertUrl);
    console.log('Payload:', JSON.stringify(payload));

    const res = await fetch(upsertUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Upsert status:', res.status);
    const resText = await res.text();
    console.log('Upsert response:', resText);
  } catch (err) {
    console.error('Upsert error:', err);
  }
}

testUpsert();
