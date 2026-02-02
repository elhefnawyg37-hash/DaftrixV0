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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const debugBankState = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, db_1.initDB)();
    const conn = yield (0, db_1.getConnection)();
    try {
        console.log('--- Debugging Bank State ---');
        // 1. Find the Bank "BNB" (or similar)
        const [banks] = yield conn.query('SELECT * FROM banks WHERE name LIKE ?', ['%BNB%']);
        if (banks.length === 0) {
            console.log('❌ Bank "BNB" not found.');
            return;
        }
        const bank = banks[0];
        console.log(`\n🏦 Bank Found: ${bank.name} (ID: ${bank.id})`);
        console.log(`   - Balance: ${bank.balance}`);
        console.log(`   - Account ID: ${bank.accountId}`);
        if (!bank.accountId) {
            console.log('   ❌ No Linked Account!');
            return;
        }
        // 2. Find the Linked Account
        const [accounts] = yield conn.query('SELECT * FROM accounts WHERE id = ?', [bank.accountId]);
        if (accounts.length === 0) {
            console.log('   ❌ Linked Account ID exists but Account record not found!');
            return;
        }
        const account = accounts[0];
        console.log(`\n📒 Linked Account: ${account.name} (${account.code})`);
        console.log(`   - Type: ${account.type}`);
        console.log(`   - Opening Balance: ${account.openingBalance}`);
        console.log(`   - Current Balance: ${account.balance}`);
        // 3. Find Journal Entries for this Account
        // We need to look into the JSON 'lines' column of the 'journal_entries' table
        // Since it's JSON, we might need to fetch all and filter in JS if MySQL version is old, 
        // or use JSON_CONTAINS if supported. For safety/simplicity in this script, I'll fetch recent entries and filter.
        console.log('\n📜 Checking Journal Entries...');
        const [entries] = yield conn.query('SELECT * FROM journal_entries ORDER BY date DESC LIMIT 50');
        let foundEntries = 0;
        for (const entry of entries) {
            const lines = typeof entry.lines === 'string' ? JSON.parse(entry.lines) : entry.lines;
            const relatedLine = lines.find((l) => l.accountId === bank.accountId);
            if (relatedLine) {
                foundEntries++;
                console.log(`   - [${entry.date}] ${entry.description}`);
                console.log(`     Debit: ${relatedLine.debit}, Credit: ${relatedLine.credit}, Balance: ${relatedLine.balance || 'N/A'}`);
            }
        }
        if (foundEntries === 0) {
            console.log('   ℹ️ No journal entries found for this account in the last 50 transactions.');
        }
    }
    catch (error) {
        console.error('Error:', error);
    }
    finally {
        conn.release();
        process.exit();
    }
});
debugBankState();
