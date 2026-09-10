import { getSalesCloudAccessToken } from '../src/lib/salesCloudAuth';

async function testSelect() {
  try {
    const { access_token, instance_url } = await getSalesCloudAccessToken();

    const soql = `SELECT Id, Message_Id__c, Phone__c, Content__c, Direction__c, Status__c, Timestamp__c, Lead__c, Contact__c FROM WhatsApp_Message__c ORDER BY CreatedDate DESC LIMIT 10`;
    console.log('Testing SOQL:', soql);

    const queryUrl = `${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
    const res = await fetch(queryUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    console.log('HTTP Status:', res.status);
    const data = await res.json();
    console.log('Data:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

testSelect();
