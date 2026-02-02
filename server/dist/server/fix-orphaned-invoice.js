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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const readline_1 = __importDefault(require("readline"));
const rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout
});
function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}
function fixOrphanedInvoice() {
    return __awaiter(this, void 0, void 0, function* () {
        const invoiceId = '75990df8-a402-4b06-968e-8ee31c76d522';
        const conn = yield (0, db_1.getConnection)();
        try {
            console.log('🔍 Checking invoice:', invoiceId);
            console.log('================================\n');
            // Check invoice header
            const [invoice] = yield conn.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
            if (invoice.length === 0) {
                console.log('❌ Invoice not found!');
                return;
            }
            const inv = invoice[0];
            console.log('📄 Invoice Details:');
            console.log(`   Type: ${inv.type}`);
            console.log(`   Date: ${inv.date}`);
            console.log(`   Partner: ${inv.partnerName}`);
            console.log(`   Total: ${inv.total} EGP`);
            console.log(`   Status: ${inv.status}`);
            console.log('');
            // Check invoice lines
            const [lines] = yield conn.query('SELECT * FROM invoice_lines WHERE invoiceId = ?', [invoiceId]);
            console.log(`📋 Invoice Lines: ${lines.length} items`);
            if (lines.length === 0) {
                console.log('⚠️ NO LINES FOUND - This invoice has no products!\n');
                console.log('This is the data integrity issue you reported.\n');
                console.log('Options:');
                console.log('1. Delete the entire invoice (recommended if data cannot be recovered)');
                console.log('2. Keep the invoice header and exit (you\'ll need to manually re-enter products)');
                console.log('3. Cancel and do nothing\n');
                const choice = yield question('Select option (1, 2, or 3): ');
                if (choice === '1') {
                    console.log('\n⚠️ WARNING: This will delete the invoice and all related records!\n');
                    const confirm = yield question('Type "DELETE" to confirm: ');
                    if (confirm === 'DELETE') {
                        yield conn.beginTransaction();
                        try {
                            // Delete related records
                            yield conn.query('DELETE FROM journal_entries WHERE referenceId = ?', [invoiceId]);
                            yield conn.query('DELETE FROM cheques WHERE transactionId = ?', [invoiceId]);
                            yield conn.query('DELETE FROM payment_allocations WHERE paymentId = ? OR invoiceId = ?', [invoiceId, invoiceId]);
                            // Delete the invoice (lines will be cascade deleted)
                            yield conn.query('DELETE FROM invoices WHERE id = ?', [invoiceId]);
                            yield conn.commit();
                            console.log('\n✅ Invoice deleted successfully!');
                            console.log('ℹ️ Note: You may need to manually adjust partner balances if this was a posted transaction.');
                        }
                        catch (error) {
                            yield conn.rollback();
                            console.error('\n❌ Error deleting invoice:', error);
                        }
                    }
                    else {
                        console.log('\n❌ Deletion cancelled - confirmation not received');
                    }
                }
                else if (choice === '2') {
                    console.log('\n✅ Invoice kept. You can edit it in the UI to add products.');
                    console.log('ℹ️ Navigate to the invoice edit page and add the required line items.');
                }
                else {
                    console.log('\n✅ No action taken');
                }
            }
            else {
                console.log('✅ This invoice has line items - no data integrity issue detected');
                console.log('Lines:');
                for (const line of lines) {
                    console.log(`   - ${line.productName}: ${line.quantity} x ${line.price} = ${line.total}`);
                }
            }
        }
        catch (error) {
            console.error('Error:', error);
        }
        finally {
            conn.release();
            rl.close();
            process.exit(0);
        }
    });
}
fixOrphanedInvoice();
