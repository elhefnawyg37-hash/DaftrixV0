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
function checkInvoice() {
    return __awaiter(this, void 0, void 0, function* () {
        const invoiceId = '75990df8-a402-4b06-968e-8ee31c76d522';
        const conn = yield (0, db_1.getConnection)();
        try {
            console.log('🔍 Checking invoice:', invoiceId);
            console.log('================================');
            // Check invoice header
            const [invoice] = yield conn.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
            if (invoice.length === 0) {
                console.log('❌ Invoice not found!');
                return;
            }
            console.log('📄 Invoice Header:');
            console.log(JSON.stringify(invoice[0], null, 2));
            console.log('');
            // Check invoice lines
            const [lines] = yield conn.query('SELECT * FROM invoice_lines WHERE invoiceId = ?', [invoiceId]);
            console.log(`📋 Invoice Lines Count: ${lines.length}`);
            if (lines.length > 0) {
                console.log('Lines:');
                console.log(JSON.stringify(lines, null, 2));
            }
            else {
                console.log('⚠️ NO LINES FOUND - This is the issue!');
            }
            console.log('');
            // Check related journal entries
            const [journals] = yield conn.query('SELECT * FROM journal_entries WHERE referenceId = ?', [invoiceId]);
            console.log(`📊 Related Journal Entries: ${journals.length}`);
            if (journals.length > 0) {
                for (const j of journals) {
                    console.log('Journal:', j.id, j.description);
                    const [jlines] = yield conn.query('SELECT * FROM journal_lines WHERE journalId = ?', [j.id]);
                    console.log('  Lines:', jlines);
                }
            }
            console.log('');
            // Check partner balance
            const [partner] = yield conn.query('SELECT id, name, balance FROM partners WHERE id = ?', [invoice[0].partnerId]);
            if (partner.length > 0) {
                console.log('🤝 Partner:');
                console.log(JSON.stringify(partner[0], null, 2));
            }
        }
        catch (error) {
            console.error('Error:', error);
        }
        finally {
            conn.release();
            process.exit(0);
        }
    });
}
checkInvoice();
