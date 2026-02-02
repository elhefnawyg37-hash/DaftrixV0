"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
function cleanupInvoiceNumbers() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield db_1.pool.getConnection();
        try {
            console.log('🔧 Invoice Number Cleanup Script\n');
            console.log('='.repeat(60));
            // Step 1: Find all invoices with timestamp suffixes
            const [rows] = yield conn.query(`
            SELECT id, number, type 
            FROM invoices 
            WHERE number REGEXP '-[a-z0-9]{8}$'
            ORDER BY type, date
        `);
            if (rows.length === 0) {
                console.log('✅ No invoices with timestamp suffixes found!');
                return;
            }
            console.log(`\n📋 Found ${rows.length} invoices with timestamp suffixes:\n`);
            const invoicesToFix = rows.map((r) => ({
                id: r.id,
                number: r.number,
                type: r.type
            }));
            // Group by type prefix
            const byType = {};
            for (const inv of invoicesToFix) {
                // Extract prefix (e.g., "PUR-" from "PUR-00001-mk4qbrut")
                const match = inv.number.match(/^([A-Z]+-(?:[A-Z]+-)?)/);
                const prefix = match ? match[1] : 'UNK-';
                if (!byType[prefix])
                    byType[prefix] = [];
                byType[prefix].push(inv);
            }
            // Step 2: For each type, find max clean number and assign new numbers
            for (const prefix of Object.keys(byType)) {
                console.log(`\n📂 Processing ${prefix} invoices...`);
                // Find max clean number for this prefix
                const [maxRows] = yield conn.query(`
                SELECT number FROM invoices 
                WHERE number LIKE ? 
                AND number NOT REGEXP '-[a-z0-9]{8}$'
                ORDER BY number DESC
            `, [`${prefix}%`]);
                let maxNum = 0;
                for (const row of maxRows) {
                    const numPart = row.number.substring(prefix.length);
                    if (/^\d+$/.test(numPart)) {
                        const n = parseInt(numPart, 10);
                        if (n > maxNum)
                            maxNum = n;
                    }
                }
                console.log(`   Current max clean number: ${prefix}${String(maxNum).padStart(5, '0')}`);
                // Assign new sequential numbers
                for (const inv of byType[prefix]) {
                    maxNum++;
                    inv.newNumber = `${prefix}${String(maxNum).padStart(5, '0')}`;
                    console.log(`   ${inv.number} → ${inv.newNumber}`);
                }
            }
            // Step 3: Preview changes
            console.log('\n' + '='.repeat(60));
            console.log('📝 Changes to be made:\n');
            for (const inv of invoicesToFix) {
                console.log(`  OLD: ${inv.number}`);
                console.log(`  NEW: ${inv.newNumber}`);
                console.log('');
            }
            // Step 4: Apply changes
            console.log('🔄 Applying changes...\n');
            yield conn.beginTransaction();
            let updated = 0;
            for (const inv of invoicesToFix) {
                if (!inv.newNumber)
                    continue;
                // Update invoice number
                yield conn.query('UPDATE invoices SET number = ? WHERE id = ?', [inv.newNumber, inv.id]);
                // Update journal entry descriptions that reference this invoice
                yield conn.query(`UPDATE journal_entries 
                 SET description = REPLACE(description, ?, ?)
                 WHERE description LIKE ?`, [inv.number, inv.newNumber, `%${inv.number}%`]);
                // Update any payments/receipts that link to this invoice
                yield conn.query(`UPDATE invoices 
                 SET relatedInvoiceIds = REPLACE(relatedInvoiceIds, ?, ?)
                 WHERE relatedInvoiceIds LIKE ?`, [inv.id, inv.id, `%${inv.id}%`]);
                updated++;
                console.log(`  ✅ Updated: ${inv.number} → ${inv.newNumber}`);
            }
            yield conn.commit();
            console.log('\n' + '='.repeat(60));
            console.log(`\n🎉 Successfully updated ${updated} invoice numbers!`);
            // Step 5: Verify
            console.log('\n📊 Verification - Current invoice numbers:\n');
            const [verification] = yield conn.query(`
            SELECT number, type, total 
            FROM invoices 
            WHERE type IN ('INVOICE_PURCHASE', 'INVOICE_SALE')
            ORDER BY type, number
            LIMIT 20
        `);
            for (const v of verification) {
                const hasTimestamp = /-[a-z0-9]{8}$/.test(v.number);
                const status = hasTimestamp ? '❌' : '✅';
                console.log(`  ${status} ${v.number} (${v.type})`);
            }
        }
        catch (error) {
            yield conn.rollback();
            console.error('❌ Error during cleanup:', error);
            throw error;
        }
        finally {
            conn.release();
            yield db_1.pool.end();
        }
    });
}
cleanupInvoiceNumbers().catch(console.error);
