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
exports.recalculateAccountBalances = exports.deleteAccount = exports.updateAccount = exports.createAccount = exports.getAccounts = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const auditController_1 = require("./auditController");
const errorHandler_1 = require("../utils/errorHandler");
const getAccounts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const [rows] = yield conn.query('SELECT * FROM accounts');
        conn.release();
        res.json(rows);
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'accounts');
    }
});
exports.getAccounts = getAccounts;
const createAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        yield conn.beginTransaction();
        const { id, code, name, type, openingBalance, balance } = req.body;
        // Use provided ID or generate new one
        const accountId = id || (0, uuid_1.v4)();
        yield conn.query('INSERT INTO accounts (id, code, name, type, openingBalance, balance) VALUES (?, ?, ?, ?, ?, ?)', [accountId, code, name, type, openingBalance || 0, balance || openingBalance || 0]);
        yield conn.commit();
        // Log audit trail
        const user = req.body.user || 'System';
        yield (0, auditController_1.logAction)(user, 'ACCOUNT', 'CREATE', `إنشاء حساب - ${name}`, `الرمز: ${code}, النوع: ${type}`);
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'accounts', updatedBy: user });
        }
        res.status(201).json({ id: accountId, code, name, type, openingBalance: openingBalance || 0, balance: balance || openingBalance || 0 });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error creating account:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        conn.release();
    }
});
exports.createAccount = createAccount;
const updateAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        yield conn.beginTransaction();
        const { id } = req.params;
        const { code, name, type } = req.body;
        yield conn.query('UPDATE accounts SET code = ?, name = ?, type = ? WHERE id = ?', [code, name, type, id]);
        yield conn.commit();
        // Log audit trail
        const user = req.body.user || 'System';
        yield (0, auditController_1.logAction)(user, 'ACCOUNT', 'UPDATE', `تحديث حساب - ${name}`, `الرمز: ${code}, النوع: ${type}`);
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'accounts', updatedBy: user });
        }
        res.json(Object.assign({ id }, req.body));
    }
    catch (error) {
        yield conn.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'updating account');
    }
    finally {
        conn.release();
    }
});
exports.updateAccount = updateAccount;
const deleteAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const conn = yield (0, db_1.getConnection)();
    try {
        yield conn.beginTransaction();
        const { id } = req.params;
        // Get account name before deletion
        const [accounts] = yield conn.query('SELECT name FROM accounts WHERE id = ?', [id]);
        const accountName = ((_a = accounts[0]) === null || _a === void 0 ? void 0 : _a.name) || id;
        yield conn.query('DELETE FROM accounts WHERE id = ?', [id]);
        yield conn.commit();
        // Log audit trail
        const user = (((_b = req.body) === null || _b === void 0 ? void 0 : _b.user) || req.query.user) || 'System';
        yield (0, auditController_1.logAction)(user, 'ACCOUNT', 'DELETE', `حذف حساب - ${accountName}`, `تم حذف الحساب | رقم المرجع: ${id}`);
        // Broadcast real-time deletion
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:deleted', { entityType: 'accounts', entityId: id, deletedBy: user });
        }
        res.json({ message: 'Account deleted' });
    }
    catch (error) {
        yield conn.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'deleting account');
    }
    finally {
        conn.release();
    }
});
exports.deleteAccount = deleteAccount;
/**
 * Recalculate all account balances from journal entries
 * This is the PERMANENT SOLUTION for treasury balance discrepancies
 *
 * Formula: New Balance = Opening Balance + SUM(debits) - SUM(credits) for debit-normal accounts
 *         New Balance = Opening Balance + SUM(credits) - SUM(debits) for credit-normal accounts
 */
const recalculateAccountBalances = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const conn = yield (0, db_1.getConnection)();
    try {
        yield conn.beginTransaction();
        // Get all accounts with their current and opening balances
        const [accounts] = yield conn.query('SELECT id, code, name, type, openingBalance, balance FROM accounts');
        // Get all journal line movements grouped by account
        const [movements] = yield conn.query(`
            SELECT 
                accountId,
                SUM(debit) as totalDebit,
                SUM(credit) as totalCredit
            FROM journal_lines
            GROUP BY accountId
        `);
        // Create a lookup map for movements
        const movementMap = new Map();
        for (const mov of movements) {
            movementMap.set(mov.accountId, {
                totalDebit: parseFloat(mov.totalDebit) || 0,
                totalCredit: parseFloat(mov.totalCredit) || 0
            });
        }
        // Determine debit-normal vs credit-normal account types
        // Debit-normal: ASSET, EXPENSE (balance increases with debit)
        // Credit-normal: LIABILITY, EQUITY, REVENUE (balance increases with credit)
        const debitNormalTypes = ['ASSET', 'EXPENSE'];
        let updatedCount = 0;
        const changes = [];
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
            // Only update if different
            const currentBalance = parseFloat(account.balance) || 0;
            if (Math.abs(currentBalance - newBalance) > 0.001) {
                yield conn.query('UPDATE accounts SET balance = ? WHERE id = ?', [newBalance, account.id]);
                updatedCount++;
                changes.push({
                    accountName: account.name,
                    oldBalance: currentBalance,
                    newBalance: newBalance
                });
            }
        }
        yield conn.commit();
        // Log audit trail
        const user = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.user) || 'System';
        if (updatedCount > 0) {
            yield (0, auditController_1.logAction)(user, 'ACCOUNT', 'RECALCULATE', `إعادة احتساب أرصدة الحسابات`, `تم تحديث ${updatedCount} حساب`);
        }
        // Broadcast real-time update to refresh all clients
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'accounts', updatedBy: user });
        }
        res.json({
            message: `تم إعادة احتساب أرصدة ${updatedCount} حساب بنجاح`,
            updatedCount,
            changes: changes.slice(0, 20) // Only show first 20 changes
        });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error recalculating account balances:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'recalculating account balances');
    }
    finally {
        conn.release();
    }
});
exports.recalculateAccountBalances = recalculateAccountBalances;
