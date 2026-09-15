// Quick test to verify the SFMC messages API returns ISO timestamps
async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/sfmc/messages');
    const data = await res.json();
    
    console.log('success:', data.success);
    console.log('sentCount:', data.sentCount);
    console.log('receivedCount:', data.receivedCount);
    console.log('totalCount:', data.totalCount);
    
    if (data.messages && data.messages.length > 0) {
      // Check first 3 for ISO format
      console.log('\n--- Latest 3 messages (should be recent) ---');
      data.messages.slice(0, 3).forEach((m, i) => {
        const isISO = m.timestamp.includes('T');
        console.log(`${i}: dir=${m.direction} ts=${m.timestamp} iso=${isISO} body="${(m.body||'').substring(0,40)}"`);
      });
      
      console.log('\n--- Oldest 3 messages ---');
      data.messages.slice(-3).forEach((m, i) => {
        const isISO = m.timestamp.includes('T');
        console.log(`${i}: dir=${m.direction} ts=${m.timestamp} iso=${isISO} body="${(m.body||'').substring(0,40)}"`);
      });
      
      // Check all timestamps are ISO
      const nonISO = data.messages.filter(m => !m.timestamp.includes('T'));
      console.log(`\nNon-ISO timestamps: ${nonISO.length}/${data.messages.length}`);
      if (nonISO.length > 0) {
        console.log('PROBLEM! Non-ISO examples:', nonISO.slice(0,3).map(m => m.timestamp));
      }
      
      // Check sort is correct (descending)
      let sortOk = true;
      for (let i = 1; i < data.messages.length; i++) {
        if (new Date(data.messages[i-1].timestamp) < new Date(data.messages[i].timestamp)) {
          sortOk = false;
          console.log(`Sort broken at ${i}: ${data.messages[i-1].timestamp} < ${data.messages[i].timestamp}`);
          break;
        }
      }
      console.log('Sort descending correct:', sortOk);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
