import assert from 'node:assert';
import { validateWorkspaceAccess } from '../lib/workspaceMiddleware';
import { workspaceRegistry } from '../lib/connectors/workspaceRegistry';

async function runIsolationTests() {
  console.log('====================================================');
  console.log('RUNNING WORKSPACE ISOLATION GO/NO-GO VERIFICATION');
  console.log('====================================================');

  const sfmcKey = 'sfmc-secret-key-123';
  const salesCloudKey = 'salescloud-secret-key-456';
  const testPhone = '9952374972';

  // TEST 1: Request sfmc-ws-1 with SFMC key -> expect 3 SFMC messages, 0 Sales Cloud messages
  console.log('\n[TEST 1] Querying sfmc-ws-1 with valid SFMC key...');
  const req1 = new Request('http://localhost:3000/api/workspaces/sfmc-ws-1/messages', {
    headers: { 'X-Workspace-Key': sfmcKey },
  });
  const auth1 = await validateWorkspaceAccess(req1, 'sfmc-ws-1');
  assert.strictEqual(auth1.success, true, 'Auth should succeed for sfmc-ws-1 with valid key');
  assert.strictEqual(auth1.workspaceId, 'sfmc-ws-1');
  assert.strictEqual(auth1.authenticatedVia, 'service_key');

  const sfmcPage = await auth1.connector!.fetchMessages({ phoneNumber: testPhone });
  console.log(` -> Returned ${sfmcPage.messages.length} messages for ${testPhone} in SFMC workspace.`);
  assert.strictEqual(sfmcPage.messages.length, 3, 'SFMC workspace must return exactly 3 messages');
  sfmcPage.messages.forEach(m => {
    assert.ok(m.id.startsWith('sfmc-'), `Message ID ${m.id} must belong to SFMC workspace`);
    assert.ok(!m.content.includes('Sales Cloud'), 'SFMC workspace must NOT contain Sales Cloud messages!');
  });
  console.log(' ✓ TEST 1 PASSED: SFMC messages isolated correctly.');

  // TEST 2: Request salescloud-ws-1 with Sales Cloud key -> expect 2 Sales Cloud messages, 0 SFMC messages
  console.log('\n[TEST 2] Querying salescloud-ws-1 with valid Sales Cloud key...');
  const req2 = new Request('http://localhost:3000/api/workspaces/salescloud-ws-1/messages', {
    headers: { 'X-Workspace-Key': salesCloudKey },
  });
  const auth2 = await validateWorkspaceAccess(req2, 'salescloud-ws-1');
  assert.strictEqual(auth2.success, true, 'Auth should succeed for salescloud-ws-1 with valid key');
  assert.strictEqual(auth2.workspaceId, 'salescloud-ws-1');
  assert.strictEqual(auth2.authenticatedVia, 'service_key');

  const scPage = await auth2.connector!.fetchMessages({ phoneNumber: testPhone });
  console.log(` -> Returned ${scPage.messages.length} messages for ${testPhone} in Sales Cloud workspace.`);
  assert.strictEqual(scPage.messages.length, 2, 'Sales Cloud workspace must return exactly 2 messages');
  scPage.messages.forEach(m => {
    assert.ok(m.id.startsWith('sc-'), `Message ID ${m.id} must belong to Sales Cloud workspace`);
    assert.ok(!m.content.includes('SFMC'), 'Sales Cloud workspace must NOT contain SFMC messages!');
  });
  console.log(' ✓ TEST 2 PASSED: Sales Cloud messages isolated correctly.');

  // TEST 3: Mismatched Key -> Request salescloud-ws-1 with SFMC key -> expect 403 Forbidden
  console.log('\n[TEST 3] Querying salescloud-ws-1 with SFMC key (mismatch)...');
  const req3 = new Request('http://localhost:3000/api/workspaces/salescloud-ws-1/messages', {
    headers: { 'X-Workspace-Key': sfmcKey },
  });
  const auth3 = await validateWorkspaceAccess(req3, 'salescloud-ws-1');
  assert.strictEqual(auth3.success, false, 'Auth should fail for mismatched workspace key');
  assert.strictEqual(auth3.status, 403, 'Mismatched key must return 403 Forbidden');
  console.log(` ✓ TEST 3 PASSED: Mismatched key returned ${auth3.status} ${auth3.error}`);

  // TEST 4 (User Fix #6): Missing Key & No Session -> expect 401 Unauthorized
  console.log('\n[TEST 4] Querying with NO X-Workspace-Key header and no session...');
  const req4 = new Request('http://localhost:3000/api/workspaces/salescloud-ws-1/messages', {
    headers: {},
  });

  // Temporarily set NODE_ENV to production to test strict unauthenticated access
  const originalEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = 'production';
  const auth4 = await validateWorkspaceAccess(req4, 'salescloud-ws-1');
  (process.env as any).NODE_ENV = originalEnv;

  assert.strictEqual(auth4.success, false, 'Auth should fail when no credentials or key are provided');
  assert.strictEqual(auth4.status, 401, 'Missing key & no session must return 401 Unauthorized (not 403)');
  console.log(` ✓ TEST 4 PASSED: Missing key returned ${auth4.status} ${auth4.error}`);

  console.log('\n====================================================');
  console.log('ALL WORKSPACE ISOLATION TESTS PASSED PERFECTLY!');
  console.log('====================================================\n');
}

runIsolationTests().catch(err => {
  console.error('\n❌ WORKSPACE ISOLATION TEST FAILED:', err);
  process.exit(1);
});
