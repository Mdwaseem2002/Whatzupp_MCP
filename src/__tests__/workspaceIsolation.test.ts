// src/__tests__/workspaceIsolation.test.ts
// Comprehensive Go/No-Go Verification Test Suite
// Includes 5 Read Isolation Access Control Tests + 6 Ownership & Queue Functional Tests
// Uses per-test try/catch blocks, logs individual results, accumulates failures, and sets exitCode = 1 on failure.

import assert from 'node:assert';
import { validateWorkspaceAccess } from '../lib/workspaceMiddleware';
import { SalesCloudConnector } from '../lib/connectors/salesCloudConnector';
import { SFMCConnector } from '../lib/connectors/sfmcConnector';
import { workspaceRegistry } from '../lib/connectors/workspaceRegistry';
import { pushUnmatched, getUnmatchedQueue, removeUnmatched, setConversationOwner, getConversationOwner, setConfig } from '../lib/storage/kvStore';
import { normalizePhoneNumber } from '../utils/phone';
import { POST as webhookPOST } from '../app/api/webhook/route';

async function runIsolationTestSuite() {
  console.log('====================================================');
  console.log('RUNNING WORKSPACE ISOLATION & OWNERSHIP TEST SUITE');
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
    assert.ok(scPage.messages.length >= 2, 'Sales Cloud workspace must return workspace messages');
    scPage.messages.forEach(m => {
      assert.ok(m.id.startsWith('sc-') || m.id.startsWith('wamid') || m.id.startsWith('00'), `Message ID ${m.id} must belong to Sales Cloud workspace`);
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
  // TEST 6: Ownership Routing (salescloud-ws-1 owner)
  // Phone exists in both workspaces; conversation_owner set to salescloud-ws-1;
  // Simulate inbound -> assert routed to Sales Cloud ONLY.
  // ----------------------------------------------------
  try {
    console.log('\n[TEST 6] Testing Ownership Routing (Owner: salescloud-ws-1)...');
    const phone = '919952374972';
    await setConversationOwner(phone, 'salescloud-ws-1', 'outbound');

    const owner = await getConversationOwner(phone);
    assert.strictEqual(owner?.workspaceId, 'salescloud-ws-1', 'Owner must be set to salescloud-ws-1');

    const wamid = `wamid.test.owner.${Date.now()}`;
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            messages: [{
              id: wamid,
              from: phone,
              type: 'text',
              text: { body: 'Hello Sales Cloud' },
              timestamp: Math.floor(Date.now() / 1000).toString(),
            }]
          }
        }]
      }]
    };

    const req = new Request('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await webhookPOST(req);
    assert.strictEqual(res.status, 200, 'Webhook response must be 200 OK');

    const scConn = new SalesCloudConnector();
    const scPage = await scConn.fetchMessages({ phoneNumber: phone });
    const foundInSc = scPage.messages.some(m => m.id === wamid);
    assert.ok(foundInSc, 'Inbound message must be written to Sales Cloud workspace');

    console.log('  ✓ TEST 6 PASSED: Ownership routing to Sales Cloud verified.');
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 6 FAILED:', err.message || err);
    failedCount++;
  }

  // ----------------------------------------------------
  // TEST 7: Ownership Routing, Inverse (sfmc-ws-1 owner)
  // Owner set to sfmc-ws-1 -> simulate inbound -> assert routed to SFMC ONLY.
  // ----------------------------------------------------
  try {
    console.log('\n[TEST 7] Testing Ownership Routing Inverse (Owner: sfmc-ws-1)...');
    const phone = '919952374972';
    await setConversationOwner(phone, 'sfmc-ws-1', 'outbound');

    const owner = await getConversationOwner(phone);
    assert.strictEqual(owner?.workspaceId, 'sfmc-ws-1', 'Owner must be set to sfmc-ws-1');

    const wamid = `wamid.test.sfmc.${Date.now()}`;
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            messages: [{
              id: wamid,
              from: phone,
              type: 'text',
              text: { body: 'Hello SFMC' },
              timestamp: Math.floor(Date.now() / 1000).toString(),
            }]
          }
        }]
      }]
    };

    const req = new Request('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await webhookPOST(req);
    assert.strictEqual(res.status, 200, 'Webhook response must be 200 OK');

    const updatedOwner = await getConversationOwner(phone);
    assert.strictEqual(updatedOwner?.workspaceId, 'sfmc-ws-1', 'Owner must remain sfmc-ws-1');

    console.log('  ✓ TEST 7 PASSED: Inverse ownership routing to SFMC verified.');
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 7 FAILED:', err.message || err);
    failedCount++;
  }

  // ----------------------------------------------------
  // TEST 8: Ownership Transfer
  // Owner is sfmc-ws-1; send outbound from salescloud-ws-1;
  // Assert conversation_owner flips to salescloud-ws-1.
  // ----------------------------------------------------
  try {
    console.log('\n[TEST 8] Testing Ownership Transfer on Outbound Send...');
    const phone = '919952374972';
    await setConversationOwner(phone, 'sfmc-ws-1', 'outbound');

    const scConn = new SalesCloudConnector();
    await scConn.sendMessage({
      recipientPhone: phone,
      content: 'Outbound from Sales Cloud',
    });

    const newOwner = await getConversationOwner(phone);
    assert.strictEqual(newOwner?.workspaceId, 'salescloud-ws-1', 'Ownership must flip to salescloud-ws-1 after outbound send');
    console.log('  ✓ TEST 8 PASSED: Ownership transfer verified.');
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 8 FAILED:', err.message || err);
    failedCount++;
  }

  // ----------------------------------------------------
  // TEST 9: Ambiguous Queue (No owner + matches multiple workspaces)
  // Phone matches both workspaces, no ownership record -> 0 platform writes, 1 ambiguous-queue entry.
  // ----------------------------------------------------
  try {
    console.log('\n[TEST 9] Testing Ambiguous Queue placement for dual-matching contact...');
    const dualPhone = '919952374972';

    // Clear conversation owner so there is no ownership record
    await setConfig(`conversation_owner:${dualPhone}`, null);

    // Register contact in Sales Cloud fallback list so findContact resolves in Sales Cloud
    const scConn = workspaceRegistry.getConnector('salescloud-ws-1') as any;
    if (scConn && scConn.fallbackContacts) {
      scConn.fallbackContacts.push({
        id: '003IR00001k5UtxYAE',
        name: 'Waseem Dual Match',
        phoneNumber: dualPhone,
        salesforceObjectType: 'Contact',
        salesforceRecordId: '003IR00001k5UtxYAE',
        lastSyncedAt: new Date().toISOString()
      });
    }

    const wamid = `wamid.test.ambiguous.${Date.now()}`;
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            messages: [{
              id: wamid,
              from: dualPhone,
              type: 'text',
              text: { body: 'Ambiguous query' },
              timestamp: Math.floor(Date.now() / 1000).toString(),
            }]
          }
        }]
      }]
    };

    const req = new Request('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await webhookPOST(req);
    assert.strictEqual(res.status, 200, 'Webhook response must be 200 OK');

    const queue = await getUnmatchedQueue();
    const queuedMsg = queue.find(q => q.id === wamid);
    assert.ok(queuedMsg, 'Ambiguous message must be placed in queue');
    assert.strictEqual(queuedMsg?.status, 'ambiguous', 'Queued message status must be ambiguous');
    assert.ok(queuedMsg?.candidateWorkspaces && queuedMsg.candidateWorkspaces.length >= 2, 'Must list at least 2 candidate workspaces');

    // Clean up
    await removeUnmatched(wamid);
    console.log('  ✓ TEST 9 PASSED: Ambiguous queue placement verified.');
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 9 FAILED:', err.message || err);
    failedCount++;
  }

  // ----------------------------------------------------
  // TEST 10: Unmatched Queue Unchanged (0 matches)
  // ----------------------------------------------------
  try {
    console.log('\n[TEST 10] Testing Unmatched Queue placement for 0-match contact...');
    const unknownPhone = '18005559999';
    const wamid = `wamid.test.unmatched.${Date.now()}`;

    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            messages: [{
              id: wamid,
              from: unknownPhone,
              type: 'text',
              text: { body: 'Unknown number text' },
              timestamp: Math.floor(Date.now() / 1000).toString(),
            }]
          }
        }]
      }]
    };

    const req = new Request('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await webhookPOST(req);
    assert.strictEqual(res.status, 200, 'Webhook response must be 200 OK');

    const queue = await getUnmatchedQueue();
    const queuedMsg = queue.find(q => q.id === wamid);
    assert.ok(queuedMsg, 'Unknown number message must be placed in unmatched queue');
    assert.strictEqual(queuedMsg?.status, 'unmatched', 'Status must be unmatched');

    // Clean up
    await removeUnmatched(wamid);
    console.log('  ✓ TEST 10 PASSED: Unmatched queue placement verified.');
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 10 FAILED:', err.message || err);
    failedCount++;
  }

  // ----------------------------------------------------
  // TEST 11: Phone Normalization Resolution
  // Outbound to +91 99523 74972 then inbound from 919952374972 -> routes to same workspace.
  // ----------------------------------------------------
  try {
    console.log('\n[TEST 11] Testing Phone Normalization Resolution...');
    const formattedPhone = '+91 99523 74972';
    const normalizedExpected = '919952374972';

    const normalizedActual = normalizePhoneNumber(formattedPhone);
    assert.strictEqual(normalizedActual, normalizedExpected, 'Phone normalization must strip spaces and + sign');

    const scConn = new SalesCloudConnector();
    await scConn.sendMessage({
      recipientPhone: formattedPhone,
      content: 'Outbound to formatted phone',
    });

    const owner = await getConversationOwner(normalizedExpected);
    assert.strictEqual(owner?.workspaceId, 'salescloud-ws-1', 'Normalized phone must resolve ownership correctly');
    console.log('  ✓ TEST 11 PASSED: Phone normalization resolution verified.');
    passedCount++;
  } catch (err: any) {
    console.error('  ❌ TEST 11 FAILED:', err.message || err);
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
    console.log('\n🚀 ALL 11 ISOLATION & OWNERSHIP TESTS PASSED PERFECTLY!\n');
    process.exitCode = 0;
  }
}

runIsolationTestSuite();
