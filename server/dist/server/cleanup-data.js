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
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
const readline_1 = __importDefault(require("readline"));
dotenv_1.default.config();
// Helper to safely count rows (returns 0 if table doesn't exist)
function safeCount(conn, table) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const [rows] = yield conn.query(`SELECT COUNT(*) as count FROM ${table}`);
            return rows[0].count;
        }
        catch (e) {
            return 0;
        }
    });
}
// Helper to safely delete from table
function safeDelete(conn, table) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield conn.query(`DELETE FROM ${table}`);
            return true;
        }
        catch (e) {
            return false;
        }
    });
}
function cleanup() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield promise_1.default.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cloud_erp',
        });
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║         🧹 INVOICE & PAYMENT CLEANUP SCRIPT 🧹              ║');
        console.log('║   ⚠️  WARNING: This will DELETE data permanently! ⚠️        ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        // Count what will be deleted
        const invoiceCount = yield safeCount(conn, 'invoices');
        const journalCount = yield safeCount(conn, 'journal_entries');
        const journalLineCount = yield safeCount(conn, 'journal_lines');
        const accountTxCount = yield safeCount(conn, 'account_transactions');
        const chequeCount = yield safeCount(conn, 'cheques');
        console.log('📊 Data that will be DELETED:');
        console.log('─────────────────────────────────────────────');
        console.log(`   📄 Invoices:             ${invoiceCount}`);
        console.log(`   📒 Journal Entries:      ${journalCount}`);
        console.log(`   📑 Journal Lines:        ${journalLineCount}`);
        console.log(`   💳 Account Transactions: ${accountTxCount}`);
        console.log(`   📄 Cheques:              ${chequeCount}`);
        console.log('─────────────────────────────────────────────\n');
        // Ask for confirmation
        const rl = readline_1.default.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        const answer = yield new Promise((resolve) => {
            rl.question('⚠️  Type "DELETE ALL" to confirm: ', resolve);
        });
        rl.close();
        if (answer !== 'DELETE ALL') {
            console.log('\n❌ Cleanup cancelled. No data was deleted.');
            yield conn.end();
            return;
        }
        console.log('\n🔄 Starting cleanup...\n');
        try {
            yield conn.beginTransaction();
            // Delete in correct order (children first, then parents)
            const tables = [
                'journal_lines',
                'journal_entries',
                'account_transactions',
                'cheques',
                'payment_allocations',
                'invoices'
            ];
            let step = 1;
            for (const table of tables) {
                console.log(`${step}️⃣  Deleting ${table}...`);
                if (yield safeDelete(conn, table)) {
                    console.log(`   ✅ ${table} deleted`);
                }
                else {
                    console.log(`   ⚠️ ${table} skipped (table may not exist)`);
                }
                step++;
            }
            yield conn.commit();
            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║           ✅ CLEANUP COMPLETED SUCCESSFULLY! ✅              ║');
            console.log('╚════════════════════════════════════════════════════════════╝\n');
            // Reset partner balances to 0
            console.log(`${step}️⃣  Resetting partner balances to 0...`);
            yield conn.query('UPDATE partners SET balance = 0');
            console.log('   ✅ Partner balances reset');
            console.log('\n💡 All data has been deleted. You can now start fresh.\n');
        }
        catch (error) {
            yield conn.rollback();
            console.error('\n❌ Error during cleanup:', error.message);
            console.log('Transaction rolled back. No data was deleted.');
        }
        yield conn.end();
    });
}
cleanup().catch(console.error);
