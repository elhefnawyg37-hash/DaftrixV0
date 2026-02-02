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
function verifyAccounts() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield (0, db_1.getConnection)();
        try {
            const [accounts] = yield conn.query('SELECT code, name, type, balance FROM accounts ORDER BY code');
            console.log('=== دليل الحسابات (Chart of Accounts) - After Cleanup ===\n');
            console.log('Total Accounts:', accounts.length);
            console.log('\nكود\tاسم الحساب\t\t\t\tالنوع\t\tالرصيد الحالي');
            console.log('─'.repeat(100));
            let prevType = '';
            accounts.forEach((acc) => {
                // Add separator between account types
                if (acc.type !== prevType) {
                    console.log('');
                    prevType = acc.type;
                }
                const name = acc.name.padEnd(35);
                const type = acc.type.padEnd(10);
                const balance = acc.balance.toLocaleString('en-US');
                console.log(`${acc.code}\t${name}\t${type}\t${balance}`);
            });
            // Summary by type
            console.log('\n\n=== ملخص حسب النوع (Summary by Type) ===\n');
            const summary = new Map();
            accounts.forEach((acc) => {
                const existing = summary.get(acc.type) || { count: 0, total: 0 };
                existing.count++;
                existing.total += parseFloat(acc.balance) || 0;
                summary.set(acc.type, existing);
            });
            for (const [type, data] of summary.entries()) {
                console.log(`${type.padEnd(15)}: ${data.count} accounts, Total Balance: ${data.total.toLocaleString('en-US')}`);
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
verifyAccounts();
