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
function checkBankAccountSync() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield (0, db_1.getConnection)();
        try {
            console.log('=== Checking Bank-Account Synchronization ===\n');
            // Get all banks
            const [banks] = yield conn.query('SELECT id, name, accountId, balance FROM banks ORDER BY name');
            console.log(`Total Banks: ${banks.length}\n`);
            // Check each bank's GL account
            const issues = [];
            for (const bank of banks) {
                if (!bank.accountId) {
                    issues.push({
                        bank: bank.name,
                        issue: 'No GL Account linked',
                        bankBalance: bank.balance
                    });
                    console.log(`⚠️  ${bank.name}: No GL Account linked (Balance: ${bank.balance})`);
                }
                else {
                    // Check if GL account exists
                    const [accounts] = yield conn.query('SELECT id, code, name, balance FROM accounts WHERE id = ?', [bank.accountId]);
                    if (accounts.length === 0) {
                        issues.push({
                            bank: bank.name,
                            issue: 'GL Account not found',
                            accountId: bank.accountId,
                            bankBalance: bank.balance
                        });
                        console.log(`❌ ${bank.name}: GL Account ${bank.accountId} not found (Bank Balance: ${bank.balance})`);
                    }
                    else {
                        const account = accounts[0];
                        const balanceDiff = Math.abs(parseFloat(bank.balance) - parseFloat(account.balance));
                        if (balanceDiff > 0.01) {
                            issues.push({
                                bank: bank.name,
                                issue: 'Balance mismatch',
                                bankBalance: bank.balance,
                                glBalance: account.balance,
                                difference: balanceDiff
                            });
                            console.log(`⚠️  ${bank.name}: Balance mismatch`);
                            console.log(`    Bank Balance: ${bank.balance}`);
                            console.log(`    GL Balance: ${account.balance}`);
                            console.log(`    Difference: ${balanceDiff}`);
                        }
                        else {
                            console.log(`✅ ${bank.name}: Synced correctly (${account.code} - ${account.name}, Balance: ${account.balance})`);
                        }
                    }
                }
            }
            console.log('\n=== Summary ===');
            if (issues.length === 0) {
                console.log('✅ All banks are properly synced with GL accounts!');
            }
            else {
                console.log(`⚠️  Found ${issues.length} issues:`);
                issues.forEach((issue, idx) => {
                    console.log(`\n${idx + 1}. ${issue.bank}:`);
                    console.log(`   Issue: ${issue.issue}`);
                    if (issue.bankBalance !== undefined) {
                        console.log(`   Bank Balance: ${issue.bankBalance}`);
                    }
                    if (issue.glBalance !== undefined) {
                        console.log(`   GL Balance: ${issue.glBalance}`);
                    }
                    if (issue.difference !== undefined) {
                        console.log(`   Difference: ${issue.difference}`);
                    }
                });
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
checkBankAccountSync();
