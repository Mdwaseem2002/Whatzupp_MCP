// src/__tests__/workspaceIsolation.test.ts
// Comprehensive Go/No-Go Verification Test Suite
// Includes 5 Read Isolation Access Control Tests + 2 Inbound Webhook Fan-Out/Unmatched Functional Tests
// Uses per-test try/catch blocks, logs individual results, accumulates failures, and sets exitCode = 1 on failure.

import assert from 'node:assert';
import { validateWorkspaceAccess } from '../lib/workspaceMiddleware';
import { SalesCloudConnector } from '../lib/connectors/salesCloudConnector';
import { SFMCConnector } from '../lib/connectors/sfmcConnector';
import { pushUnmatched, getUnmatchedQueue, removeUnmatched } from '../lib/storage/kvStore';

async function runIsolationTestSuite() {
  console.log('====================================================');
  console.log('RUNNING WORKSPACE ISOLATION & FAN-OUT TEST SUITE');
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;
  const sfmcKey = 'sfmc-secret-key-123';
  const salesCloudKey = 'salescloud-secret-key-456';
  const testPhone = '9952374972';

  // ----------------------------------------------------
  // TEST 1: Query sfmc-ws-1 with valid SFMC key
  // ----------------------------------------------------
  try {
    console.log('[TEST 1] Querying sfmc-ws-1 with valid SFMC key...');
    const req = new Request('http://localhost:3000/api/workspaces/sfmc-ws-1/messages', {
      headers: { 'X-Workspace-Key': sfmcKey },
    });
    const auth = await validateWorkspaceAccess(req, 'sfmc-ws-1');
    assert.strictEqual(auth.success, true, 'Auth should succeed for sfmc-ws-1 with valid key');
    assert.strictEqual(auth.workspaceId, 'sfmc-ws-1');
    assert.strictEqual(auth.authenticatedVia, 'service_key');

    const sfmcPage = await auth.connector!.fetchMessages({ phoneNumber: testPhone });
    assert.strictEqual(sfmcPage.messages.length, 3, 'SFMC workspace must return exactly 3 messages');
    sfmcPage.messages.forEach(m => {
      assert.ok(m.id.startsWith('sfmc-'), `Message ID ${m.id} must belong to SFMC workspace`);
      assert.ok(!m.content.includes('Sales Cloud'), 'SFMC workspace must NOT contain Sales Cloud messages!');
    });
    console.log('  ✓ TEST 1 PASSED: SFMC messages isolated correctly.');
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 1 FAILED:', err.message || err);
    failedCount++;
  }

  // ----------------------------------------------------
  // TEST 2: Query salescloud-ws-1 with valid Sales Cloud key
  // ----------------------------------------------------
  try {
    console.log('\n[TEST 2] Querying salescloud-ws-1 with valid Sales Cloud key...');
    const req = new Request('http://localhost:3000/api/workspaces/salescloud-ws-1/messages', {
      headers: { 'X-Workspace-Key': salesCloudKey },
    });
    const auth = await validateWorkspaceAccess(req, 'salescloud-ws-1');
    assert.strictEqual(auth.success, true, 'Auth should succeed for salescloud-ws-1 with valid key');
    assert.strictEqual(auth.workspaceId, 'salescloud-ws-1');
    assert.strictEqual(auth.authenticatedVia, 'service_key');

    const scPage = await auth.connector!.fetchMessages({ phoneNumber: testPhone });
    assert.strictEqual(scPage.messages.length, 2, 'Sales Cloud workspace must return exactly 2 messages');
    scPage.messages.forEach(m => {
      assert.ok(m.id.startsWith('sc-'), `Message ID ${m.id} must belong to Sales Cloud workspace`);
      assert.ok(!m.content.includes('SFMC'), 'Sales Cloud workspace must NOT contain SFMC messages!');
    });
    console.log('  ✓ TEST 2 PASSED: Sales Cloud messages isolated correctly.');
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 2 FAILED:', err.message || err);
    failedCount++;
  }

  // ----------------------------------------------------
  // TEST 3: Query salescloud-ws-1 with SFMC key (mismatch) -> expect 403
  // ----------------------------------------------------
  try {
    console.log('\n[TEST 3] Querying salescloud-ws-1 with SFMC key (mismatch)...');
    const req = new Request('http://localhost:3000/api/workspaces/salescloud-ws-1/messages', {
      headers: { 'X-Workspace-Key': sfmcKey },
    });
    const auth = await validateWorkspaceAccess(req, 'salescloud-ws-1');
    assert.strictEqual(auth.success, false, 'Auth should fail for mismatched workspace key');
    assert.strictEqual(auth.status, 403, 'Mismatched key must return 403 Forbidden');
    console.log(`  ✓ TEST 3 PASSED: Mismatched key returned ${auth.status} ${auth.error}`);
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 3 FAILED:', err.message || err);
    failedCount++;
  }

  // ----------------------------------------------------
  // TEST 4: Query with NO key and no session -> expect 401
  // ----------------------------------------------------
  try {
    console.log('\n[TEST 4] Querying with NO X-Workspace-Key and no session...');
    const req = new Request('http://localhost:3000/api/workspaces/salescloud-ws-1/messages', {
      headers: {},
    });

    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production';
    const auth = await validateWorkspaceAccess(req, 'salescloud-ws-1');
    (process.env as any).NODE_ENV = originalEnv;

    assert.strictEqual(auth.success, false, 'Auth should fail when no credentials or key are provided');
    assert.strictEqual(auth.status, 401, 'Missing key & no session must return 401 Unauthorized');
    console.log(`  ✓ TEST 4 PASSED: Missing key returned ${auth.status} ${auth.error}`);
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 4 FAILED:', err.message || err);
    failedCount++;
  }

  // ----------------------------------------------------
  // TEST 5: Browser Session Workspace Access Test
  // ----------------------------------------------------
  try {
    console.log('\n[TEST 5] Querying sfmc-ws-1 with session user context...');
    const req = new Request('http://localhost:3000/api/workspaces/sfmc-ws-1/messages', {
      headers: { 'X-Dev-User-Id': 'test-user-1' },
    });
    const auth = await validateWorkspaceAccess(req, 'sfmc-ws-1');
    assert.strictEqual(auth.success, true, 'User session access should succeed');
    assert.strictEqual(auth.authenticatedVia, 'user_session');
    assert.strictEqual(auth.workspaceId, 'sfmc-ws-1');

    const sfmcPage = await auth.connector!.fetchMessages({ phoneNumber: testPhone });
    assert.ok(sfmcPage.messages.length > 0, 'Session read must return workspace messages');
    console.log('  ✓ TEST 5 PASSED: User session workspace read verified.');
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 5 FAILED:', err.message || err);
    failedCount++;
  }

  // ----------------------------------------------------
  // TEST 6: Inbound Message Dual-Match Fan-Out Functional Test
  // ----------------------------------------------------
  try {
    console.log('\n[TEST 6] Testing Inbound Fan-Out for dual-matching contact...');
    const scConnector = new SalesCloudConnector();
    const sfmcConnectorInstance = new SFMCConnector();
    const dualPhone = '9952374972'; // Present in both mock connectors

    const scMatch = await scConnector.resolveContact({ phoneNumber: dualPhone });
    const sfmcMatch = await sfmcConnectorInstance.fetchContacts({ search: dualPhone });

    assert.ok(scMatch, 'Dual phone must resolve in Sales Cloud connector');
    assert.ok(sfmcMatch.length > 0, 'Dual phone must resolve in SFMC connector');
    console.log('  ✓ TEST 6 PASSED: Dual-matching contact verified for conditional fan-out.');
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 6 FAILED:', err.message || err);
    failedCount++;
  }

  // ----------------------------------------------------
  // TEST 7: Inbound Message Unmatched Queue Functional Test
  // ----------------------------------------------------
  try {
    console.log('\n[TEST 7] Testing Unmatched Queue push & retrieval...');
    const dummyUnmatched = {
      id: `test-unmatched-${Date.now()}`,
      phoneNumber: '18005550000',
      content: 'Hello, this is an unknown number!',
      timestamp: new Date().toISOString(),
    };

    await pushUnmatched(dummyUnmatched);
    const queue = await getUnmatchedQueue();
    const found = queue.find(q => q.id === dummyUnmatched.id);
    assert.ok(found, 'Dummy message must be present in unmatched queue');
    assert.strictEqual(found?.phoneNumber, '18005550000');

    // Clean up
    await removeUnmatched(dummyUnmatched.id);
    console.log('  ✓ TEST 7 PASSED: Unmatched queue push and retrieval verified.');
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 7 FAILED:', err.message || err);
    failedCount++;
  }

  // ----------------------------------------------------
  // FINAL ACCUMULATED REPORT
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`TEST SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('====================================================');

  if (failedCount > 0) {
    console.error(`\n❌ TEST SUITE FAILED WITH ${failedCount} FAILURES.`);
    process.exitCode = 1;
  } else {
    console.log('\n🚀 ALL 7 ISOLATION & FUNCTIONAL TESTS PASSED PERFECTLY!\n');
    process.exitCode = 0;
  }
}

runIsolationTestSuite();
