/**
 * Migration: Cleanup Journal Entry Descriptions
 * 
 * This script shortens existing journal entry descriptions by:
 * 1. Removing invoice notes (البضاعة المباعة لا ترد...)
 * 2. Removing duplicate (Ref: uuid) patterns
 * 3. Shortening "عكس القيد: عكس القيد:" to just "عكس قيد:"
 * 
 * Run with: npx ts-node server/migrations/cleanup-journal-descriptions.ts
 */

import { pool } from '../db';

async function cleanupJournalDescriptions() {
    const conn = await pool.getConnection();

    try {
        console.log('🔧 Starting Journal Description Cleanup...\n');

        // Get all journal entries
        const [entries] = await conn.query('SELECT id, description, referenceId FROM journal_entries');
        const journalEntries = entries as Array<{ id: string, description: string, referenceId: string }>;

        console.log(`Found ${journalEntries.length} journal entries to process.\n`);

        let updatedCount = 0;

        for (const entry of journalEntries) {
            let newDesc = entry.description;
            const originalDesc = entry.description;

            // 1. Remove (Ref: uuid) patterns - can appear multiple times
            newDesc = newDesc.replace(/\s*\(Ref:\s*[a-f0-9-]+\)/gi, '');

            // 2. Remove common invoice notes (Arabic)
            // These are typical terms like "البضاعة المباعة لا ترد..."
            newDesc = newDesc.replace(/\s*-?\s*البضاعة المباعة لا ترد ولا تستبدل[^-]*/g, '');
            newDesc = newDesc.replace(/\s*-?\s*تطبق الشروط والأحكام\.?/g, '');

            // 3. Fix duplicate "عكس القيد: عكس القيد:" 
            newDesc = newDesc.replace(/عكس القيد:\s*عكس القيد:/g, 'عكس قيد:');
            newDesc = newDesc.replace(/عكس القيد:/g, 'عكس قيد:');

            // 4. For reverse entries, simplify to just use referenceId if available
            if (entry.referenceId && entry.referenceId.startsWith('REV-')) {
                // Extract the original reference if it's a reverse of an invoice
                const invMatch = newDesc.match(/#([A-Z]+-\d+)/);
                if (invMatch) {
                    newDesc = `عكس قيد: #${invMatch[1]}`;
                }
            }

            // 5. Clean up multiple dashes and trailing spaces
            newDesc = newDesc.replace(/\s+-\s*$/g, '').trim();
            newDesc = newDesc.replace(/\s+/g, ' ').trim();

            // Only update if description changed
            if (newDesc !== originalDesc) {
                await conn.query('UPDATE journal_entries SET description = ? WHERE id = ?', [newDesc, entry.id]);
                updatedCount++;

                console.log(`✅ Updated: ${entry.id.slice(-8)}`);
                console.log(`   Before: ${originalDesc.substring(0, 80)}...`);
                console.log(`   After:  ${newDesc}\n`);
            }
        }

        console.log('═'.repeat(60));
        console.log(`\n✨ Cleanup Complete!`);
        console.log(`   Total entries processed: ${journalEntries.length}`);
        console.log(`   Entries updated: ${updatedCount}`);
        console.log(`   Entries unchanged: ${journalEntries.length - updatedCount}\n`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    } finally {
        conn.release();
        process.exit(0);
    }
}

// Run the migration
cleanupJournalDescriptions().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
