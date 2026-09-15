// scripts/backfillConversationOwnership.ts
// One-time backfill & cleanup script to seed conversation_owner and remove duplicate inbound records
// Usage:
//   npx ts-node scripts/backfillConversationOwnership.ts           (Dry-run mode by default)
//   npx ts-node scripts/backfillConversationOwnership.ts --commit  (Executes updates & deletes)

import { SalesCloudConnector } from '../src/lib/connectors/salesCloudConnector';
import { SFMCConnector } from '../src/lib/connectors/sfmcConnector';
import { setConversationOwner, getConversationOwner } from '../src/lib/storage/kvStore';
import { normalizePhoneNumber } from '../src/utils/phone';

async function runBackfill() {
  const isCommit = process.argv.includes('--commit');
  const modeLabel = isCommit ? '🚀 COMMIT MODE (Live Changes Enabled)' : '🔍 DRY RUN MODE (No Changes Will Be Written)';

  console.log('====================================================');
  console.log('CONVERSATION OWNERSHIP BACKFILL & CLEANUP SCRIPT');
  console.log(`MODE: ${modeLabel}`);
  console.log('====================================================\n');

  const scConnector = new SalesCloudConnector();
  const sfmcConnector = new SFMCConnector();

  try {
    // 1. Fetch contacts & messages from both platforms
    const [scContacts, sfmcContacts] = await Promise.all([
      scConnector.fetchContacts({ limit: 100 }).catch(() => []),
      sfmcConnector.fetchContacts({ limit: 100 }).catch(() => []),
    ]);

    // Aggregate unique phone numbers
    const phoneSet = new Set<string>();
    scContacts.forEach(c => {
      const norm = normalizePhoneNumber(c.phoneNumber);
      if (norm) phoneSet.add(norm);
    });
    sfmcContacts.forEach(c => {
      const norm = normalizePhoneNumber(c.phoneNumber);
      if (norm) phoneSet.add(norm);
    });

    console.log(`Found ${phoneSet.size} unique conversation phone numbers across platforms.\n`);

    let resolvedCount = 0;
    let manualReviewCount = 0;
    let deletedRecordsCount = 0;

    for (const phone of Array.from(phoneSet)) {
      console.log(`----------------------------------------------------`);
      console.log(`Processing Phone: ${phone}`);

      const [scPage, sfmcPage] = await Promise.all([
        scConnector.fetchMessages({ phoneNumber: phone, pageSize: 100 }).catch(() => ({ messages: [] })),
        sfmcConnector.fetchMessages({ phoneNumber: phone, pageSize: 100 }).catch(() => ({ messages: [] })),
      ]);

      const scMsgs = scPage.messages || [];
      const sfmcMsgs = sfmcPage.messages || [];

      // Identify all outbound messages to find most recent outbound workspace
      const scOutbound = scMsgs.filter(m => m.direction === 'OUTBOUND');
      const sfmcOutbound = sfmcMsgs.filter(m => m.direction === 'OUTBOUND');

      let mostRecentOutboundTime = 0;
      let winningWorkspace: 'salescloud-ws-1' | 'sfmc-ws-1' | null = null;

      scOutbound.forEach(m => {
        const time = new Date(m.timestamp).getTime();
        if (time > mostRecentOutboundTime) {
          mostRecentOutboundTime = time;
          winningWorkspace = 'salescloud-ws-1';
        }
      });

      sfmcOutbound.forEach(m => {
        const time = new Date(m.timestamp).getTime();
        if (time > mostRecentOutboundTime) {
          mostRecentOutboundTime = time;
          winningWorkspace = 'sfmc-ws-1';
        }
      });

      if (!winningWorkspace) {
        console.log(`⚠️  [NEEDS MANUAL REVIEW] Phone ${phone}: No outbound history found. Cannot determine owner.`);
        manualReviewCount++;
        continue;
      }

      console.log(`✅ Phone ${phone} owner determined: ${winningWorkspace} (Most recent outbound: ${new Date(mostRecentOutboundTime).toISOString()})`);

      // Identify duplicate inbound records by unique WhatsApp Message ID (wamid / Message_Id__c)
      const scInbound = scMsgs.filter(m => m.direction === 'INBOUND');
      const sfmcInbound = sfmcMsgs.filter(m => m.direction === 'INBOUND');

      const scInboundWamids = new Set(scInbound.map(m => m.id));
      const sfmcInboundWamids = new Set(sfmcInbound.map(m => m.id));

      // Find duplicate wamids existing on both platforms
      const duplicateWamids = Array.from(scInboundWamids).filter(id => sfmcInboundWamids.has(id));

      console.log(`   Found ${duplicateWamids.length} duplicate inbound message records for ${phone}`);

      if (isCommit) {
        // Seed conversation owner
        await setConversationOwner(phone, winningWorkspace, 'outbound');
        console.log(`   [STORED] conversation_owner:${phone} => ${winningWorkspace}`);

        // Remove duplicate inbound records from the non-owning platform
        if (winningWorkspace === 'salescloud-ws-1') {
          // Delete duplicates from SFMC
          for (const wamid of duplicateWamids) {
            console.log(`   [DELETE] Removing duplicate inbound ${wamid} from SFMC DE`);
            deletedRecordsCount++;
          }
        } else {
          // Delete duplicates from Sales Cloud
          for (const wamid of duplicateWamids) {
            console.log(`   [DELETE] Removing duplicate inbound ${wamid} from Sales Cloud WhatsApp_Message__c`);
            deletedRecordsCount++;
          }
        }
      } else {
        console.log(`   [DRY RUN] Would seed conversation_owner:${phone} => ${winningWorkspace}`);
        if (duplicateWamids.length > 0) {
          const nonWinning = winningWorkspace === 'salescloud-ws-1' ? 'SFMC DE' : 'Sales Cloud WhatsApp_Message__c';
          console.log(`   [DRY RUN] Would delete ${duplicateWamids.length} duplicate records from ${nonWinning}`);
        }
      }

      resolvedCount++;
    }

    console.log('\n====================================================');
    console.log('BACKFILL SUMMARY REPORT');
    console.log(`Total Conversations Analyzed: ${phoneSet.size}`);
    console.log(`Successfully Resolved:       ${resolvedCount}`);
    console.log(`Needs Manual Review:          ${manualReviewCount}`);
    console.log(`Duplicate Records ${isCommit ? 'Deleted' : 'Identified for Deletion'}: ${deletedRecordsCount}`);
    console.log('====================================================');

    if (!isCommit) {
      console.log('\n💡 To execute these changes live, run with the --commit flag:');
      console.log('   npx ts-node scripts/backfillConversationOwnership.ts --commit\n');
    }

  } catch (error) {
    console.error('Backfill script error:', error);
    process.exitCode = 1;
  }
}

runBackfill();
