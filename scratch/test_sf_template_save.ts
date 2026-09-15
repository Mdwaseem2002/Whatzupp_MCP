import { SalesCloudConnector } from '../src/lib/connectors/salesCloudConnector';

async function testSaveTemplate() {
  try {
    const sc = new SalesCloudConnector();
    const wamid = `wamid.test.template.${Date.now()}`;
    const res = await sc.saveOutboundMessage({
      messageId: wamid,
      recipientPhone: '919952374972',
      content: '[Template: pentacloud_followup] Quick Follow-Up from Pentacloud',
      status: 'SENT',
    });
    console.log('saveOutboundMessage result:', res);

    // Now fetch messages for 919952374972
    const fetchRes = await sc.fetchMessages({ phoneNumber: '919952374972' });
    console.log('Fetched messages count:', fetchRes.messages.length);
    console.log('Fetched messages:', JSON.stringify(fetchRes.messages, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testSaveTemplate();
