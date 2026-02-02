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
dotenv_1.default.config();
function debug() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield promise_1.default.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cloud_erp',
        });
        console.log('=== Looking for journal entry for PAY-00006 (bank transfer) ===');
        const [je] = yield conn.query("SELECT id, date, description, referenceId FROM journal_entries WHERE referenceId LIKE '%PAY-00006%' OR description LIKE '%PAY-00006%'");
        if (je.length === 0) {
            console.log('❌ No journal entry found for PAY-00006!');
        }
        else {
            console.log('✅ Journal entries found:', je);
        }
        console.log('\n=== Journal entries containing "تحويل بنكي" ===');
        const [bankJE] = yield conn.query("SELECT id, date, description, referenceId FROM journal_entries WHERE description LIKE '%تحويل بنكي%' LIMIT 5");
        if (bankJE.length === 0) {
            console.log('❌ No bank transfer journal entries found!');
        }
        else {
            bankJE.forEach((j) => {
                console.log('---');
                console.log('Date:', j.date);
                console.log('Desc:', j.description);
                console.log('RefId:', j.referenceId);
            });
        }
        console.log('\n=== Journal lines with Bank accounts (102*) ===');
        const [bankLines] = yield conn.query(`
        SELECT jl.journalId, jl.accountName, jl.debit, jl.credit, je.description, je.referenceId
        FROM journal_lines jl
        JOIN journal_entries je ON jl.journalId = je.id
        JOIN accounts a ON jl.accountId = a.id
        WHERE a.code LIKE '102%'
        ORDER BY je.date DESC
        LIMIT 10
    `);
        if (bankLines.length === 0) {
            console.log('❌ No journal lines with Bank accounts (102*) found!');
        }
        else {
            bankLines.forEach((l) => {
                var _a;
                console.log('---');
                console.log('Account:', l.accountName, '| Debit:', l.debit, '| Credit:', l.credit);
                console.log('Desc:', (_a = l.description) === null || _a === void 0 ? void 0 : _a.substring(0, 80));
                console.log('RefId:', l.referenceId);
            });
        }
        yield conn.end();
    });
}
debug().catch(console.error);
