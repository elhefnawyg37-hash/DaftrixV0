"use strict";
/**
 * Account Balance Utilities
 *
 * Provides functions to update account balances based on journal entries.
 * This ensures that account.balance stays in sync with journal movements.
 */
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
exports.updateAccountBalancesFromJournal = updateAccountBalancesFromJournal;
exports.collectAffectedAccountIds = collectAffectedAccountIds;
/**
 * Update account balances for a list of affected accounts.
 * Recalculates balance from openingBalance + journal movements.
 *
 * Formula:
 * - For ASSET/EXPENSE accounts: Balance = Opening + Debits - Credits
 * - For LIABILITY/EQUITY/REVENUE accounts: Balance = Opening + Credits - Debits
 *
 * @param conn Database connection (must be within a transaction)
 * @param accountIds List of account IDs that were affected by journal changes
 */
function updateAccountBalancesFromJournal(conn, accountIds) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!accountIds || accountIds.length === 0) {
            return { updatedCount: 0, changes: [] };
        }
        // Debit-normal account types (balance increases with debit)
        const debitNormalTypes = ['ASSET', 'EXPENSE'];
        const changes = [];
        let updatedCount = 0;
        // Get account details for all affected accounts
        const placeholders = accountIds.map(() => '?').join(',');
        const [accounts] = yield conn.query(`SELECT id, code, name, type, openingBalance, balance FROM accounts WHERE id IN (${placeholders})`, accountIds);
        // Get journal movements for all affected accounts
        const [movements] = yield conn.query(`SELECT 
            accountId,
            SUM(debit) as totalDebit,
            SUM(credit) as totalCredit
        FROM journal_lines
        WHERE accountId IN (${placeholders})
        GROUP BY accountId`, accountIds);
        // Create lookup map for movements
        const movementMap = new Map();
        for (const mov of movements) {
            movementMap.set(mov.accountId, {
                totalDebit: parseFloat(mov.totalDebit) || 0,
                totalCredit: parseFloat(mov.totalCredit) || 0
            });
        }
        // Update each affected account
        for (const account of accounts) {
            const movement = movementMap.get(account.id);
            const totalDebit = (movement === null || movement === void 0 ? void 0 : movement.totalDebit) || 0;
            const totalCredit = (movement === null || movement === void 0 ? void 0 : movement.totalCredit) || 0;
            const openingBalance = parseFloat(account.openingBalance) || 0;
            let newBalance;
            if (debitNormalTypes.includes(account.type)) {
                // For ASSET/EXPENSE: Balance = Opening + Debits - Credits
                newBalance = openingBalance + totalDebit - totalCredit;
            }
            else {
                // For LIABILITY/EQUITY/REVENUE: Balance = Opening + Credits - Debits
                newBalance = openingBalance + totalCredit - totalDebit;
            }
            // Round to 2 decimal places
            newBalance = Math.round(newBalance * 100) / 100;
            const currentBalance = parseFloat(account.balance) || 0;
            // Only update if different
            if (Math.abs(currentBalance - newBalance) > 0.001) {
                yield conn.query('UPDATE accounts SET balance = ? WHERE id = ?', [newBalance, account.id]);
                updatedCount++;
                changes.push({
                    accountId: account.id,
                    oldBalance: currentBalance,
                    newBalance: newBalance
                });
                console.log(`💰 Account balance updated: ${account.name} (${account.code}): ${currentBalance.toLocaleString()} → ${newBalance.toLocaleString()}`);
            }
        }
        return { updatedCount, changes };
    });
}
/**
 * Collect unique account IDs from journal entry lines.
 * Used to determine which accounts need balance updates.
 */
function collectAffectedAccountIds(journalLines) {
    const uniqueIds = new Set();
    for (const line of journalLines) {
        if (line.accountId) {
            uniqueIds.add(line.accountId);
        }
    }
    return Array.from(uniqueIds);
}
