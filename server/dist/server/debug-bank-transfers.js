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
        console.log('=== Recent Journal Entries (last 5) ===');
        const [journals] = yield conn.query('SELECT id, date, description, referenceId FROM journal_entries ORDER BY date DESC LIMIT 5');
        journals.forEach((j) => {
            var _a;
            console.log('---');
            console.log('Date:', j.date);
            console.log('Desc:', (_a = j.description) === null || _a === void 0 ? void 0 : _a.substring(0, 100));
            console.log('RefId:', j.referenceId);
        });
        console.log('\n=== Recent PAY- Invoices (Payment Vouchers) ===');
        const [payments] = yield conn.query("SELECT number, type, total, paymentMethod, notes FROM invoices WHERE number LIKE 'PAY-%' ORDER BY date DESC LIMIT 5");
        if (payments.length === 0) {
            console.log('❌ No PAY- invoices found! Bank transfer payments are NOT being created.');
        }
        else {
            payments.forEach((p) => {
                var _a;
                console.log('---');
                console.log('Number:', p.number, '| Type:', p.type, '| Total:', p.total, '| Method:', p.paymentMethod);
                console.log('Notes:', (_a = p.notes) === null || _a === void 0 ? void 0 : _a.substring(0, 80));
            });
        }
        console.log('\n=== Recent Invoices with bankTransfers ===');
        const [invoicesWithBankTransfer] = yield conn.query("SELECT number, type, total, paymentMethod, bankTransfers FROM invoices WHERE bankTransfers IS NOT NULL AND bankTransfers != 'null' ORDER BY date DESC LIMIT 5");
        if (invoicesWithBankTransfer.length === 0) {
            console.log('❌ No invoices with bankTransfers found!');
        }
        else {
            invoicesWithBankTransfer.forEach((inv) => {
                console.log('---');
                console.log('Number:', inv.number, '| Type:', inv.type, '| Total:', inv.total);
                console.log('bankTransfers:', inv.bankTransfers);
            });
        }
        yield conn.end();
    });
}
debug().catch(console.error);
