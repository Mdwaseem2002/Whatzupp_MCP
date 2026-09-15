import { getSalesCloudAccessToken } from '../src/lib/salesCloudAuth';

async function testSOQL() {
  try {
    const { access_token, instance_url } = await getSalesCloudAccessToken();
    console.log('Got Salesforce Access Token. Instance:', instance_url);

    // 1. Describe WhatsApp_Message__c object fields
    const descUrl = `${instance_url}/services/data/v59.0/sobjects/WhatsApp_Message__c/describe`;
    const descRes = await fetch(descUrl, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    console.log('Describe status:', descRes.status);
    if (!descRes.ok) {
      console.error('Describe error:', await descRes.text());
    } else {
      const descData = await descRes.json();
      console.log('WhatsApp_Message__c Fields:');
      descData.fields.forEach((f: any) => {
        console.log(`  - ${f.name} (${f.type}) ${f.externalId ? '[EXTERNAL ID]' : ''}`);
      });
    }

    // 2. Test the exact SOQL query from salesCloudConnector.ts
    const safePhone = '919952374972';
    const last10 = safePhone.slice(-10);
    const soql = `SELECT Id, Message_Id__c, Phone__c, Content__c, Direction__c, Status__c, Timestamp__c, Lead__c, Contact__c FROM WhatsApp_Message__c WHERE (Phone__c = '${safePhone}' OR Phone__c LIKE '%${last10}') ORDER BY Timestamp__c ASC LIMIT 50`;
    console.log('\nRunning SOQL:', soql);

    const queryUrl = `${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
    const res = await fetch(queryUrl, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    console.log('SOQL Status:', res.status);
    const resText = await res.text();
    console.log('SOQL Response:', resText);

  } catch (err) {
    console.error('Error:', err);
  }
}

testSOQL();
