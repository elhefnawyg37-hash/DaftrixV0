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
exports.updateCheque = exports.getCheques = exports.deleteBank = exports.resyncBankGL = exports.updateBank = exports.createBank = exports.getBanks = exports.createReceipt = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const auditController_1 = require("./auditController");
const errorHandler_1 = require("../utils/errorHandler");
/**
 * Create a treasury receipt from mobile app
 * POST /api/treasury/receipts
 */
const createReceipt = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log('📱💰 Treasury Receipt Request Received:', JSON.stringify(req.body, null, 2));
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        const { partnerId, partnerName, amount, date, method, reference, notes, bankAccountId, salesmanId } = req.body;
        const user = req.user;
        if (!partnerId || !amount || amount <= 0) {
            connection.release();
            return res.status(400).json({ error: 'Partner ID and amount are required' });
        }
        const receiptId = (0, uuid_1.v4)();
        const receiptNumber = `RCV-${Date.now().toString(36).toUpperCase()}`;
        const receiptDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const paymentMethod = method === 'BANK' ? 'BANK' : 'CASH';
        console.log(`💰 Creating treasury receipt: ${receiptNumber} for ${amount} (${paymentMethod})`);
        // Get bank's GL account ID if bank payment
        let bankGLAccountId = null;
        let bankName = null;
        if (paymentMethod === 'BANK' && bankAccountId) {
            const [bankRows] = yield connection.query(`SELECT b.name, b.accountId FROM banks b WHERE b.id = ? OR b.accountId = ? LIMIT 1`, [bankAccountId, bankAccountId]);
            if (bankRows[0]) {
                bankGLAccountId = bankRows[0].accountId;
                bankName = bankRows[0].name;
                console.log(`🏦 Found bank: ${bankName}, GL Account: ${bankGLAccountId}`);
            }
        }
        // 1. Create receipt invoice
        yield connection.query(`
            INSERT INTO invoices (
                id, number, date, type, partnerId, partnerName,
                total, paidAmount, status, paymentMethod, posted,
                notes, salesmanId, createdBy, bankAccountId
            ) VALUES (?, ?, ?, 'RECEIPT', ?, ?, ?, ?, 'POSTED', ?, 1, ?, ?, ?, ?)
        `, [
            receiptId, receiptNumber, receiptDate, partnerId, partnerName || 'عميل',
            amount, amount,
            paymentMethod,
            notes || (reference ? `رقم المرجع: ${reference}` : 'تحصيل من التطبيق'),
            salesmanId || null,
            (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'Mobile App',
            paymentMethod === 'BANK' ? (bankGLAccountId || bankAccountId) : null
        ]);
        // 2. Update partner balance (decrease debt)
        yield connection.query(`
            UPDATE partners SET balance = COALESCE(balance, 0) - ? WHERE id = ?
        `, [amount, partnerId]);
        // 3. Get treasury account for journal entry
        let treasuryAccountId = null;
        if (paymentMethod === 'BANK' && bankGLAccountId) {
            treasuryAccountId = bankGLAccountId;
        }
        else {
            // Find default cash account
            const [cashAccounts] = yield connection.query(`
                SELECT id FROM accounts WHERE code LIKE '101%' OR name LIKE '%نقدي%' OR name LIKE '%صندوق%' LIMIT 1
            `);
            treasuryAccountId = (_a = cashAccounts[0]) === null || _a === void 0 ? void 0 : _a.id;
        }
        // 4. Create journal entry
        if (treasuryAccountId) {
            const journalId = (0, uuid_1.v4)();
            yield connection.query(`
                INSERT INTO journal_entries (id, date, description, referenceId)
                VALUES (?, ?, ?, ?)
            `, [
                journalId,
                receiptDate,
                `تحصيل من ${partnerName || 'عميل'} - ${receiptNumber} - ${paymentMethod === 'BANK' ? bankName || 'تحويل بنكي' : 'نقدي'}`,
                receiptId
            ]);
            // Get receivables account
            const [receivablesAccounts] = yield connection.query(`
                SELECT id FROM accounts WHERE code LIKE '112%' OR name LIKE '%عملاء%' OR name LIKE '%ذمم%' LIMIT 1
            `);
            const receivablesAccountId = (_b = receivablesAccounts[0]) === null || _b === void 0 ? void 0 : _b.id;
            // Debit: Treasury/Bank, Credit: Receivables
            yield connection.query(`
                INSERT INTO journal_lines (journalId, accountId, debit, credit)
                VALUES (?, ?, ?, 0)
            `, [journalId, treasuryAccountId, amount]);
            if (receivablesAccountId) {
                yield connection.query(`
                    INSERT INTO journal_lines (journalId, accountId, debit, credit)
                    VALUES (?, ?, 0, ?)
                `, [journalId, receivablesAccountId, amount]);
                // Update account balances
                yield connection.query(`UPDATE accounts SET balance = COALESCE(balance, 0) + ? WHERE id = ?`, [amount, treasuryAccountId]);
                yield connection.query(`UPDATE accounts SET balance = COALESCE(balance, 0) - ? WHERE id = ?`, [amount, receivablesAccountId]);
            }
            console.log(`📝 Created journal entry: ${journalId}`);
        }
        yield connection.commit();
        // Log audit trail
        yield (0, auditController_1.logAction)((user === null || user === void 0 ? void 0 : user.name) || 'Mobile', 'RECEIPT', 'CREATE', `تحصيل من ${partnerName || 'عميل'}`, `المبلغ: ${amount}`);
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'invoices', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'Mobile' });
            io.emit('entity:changed', { entityType: 'partners', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'Mobile' });
        }
        console.log(`✅ Receipt created: ${receiptNumber}`);
        res.status(201).json({ id: receiptId, number: receiptNumber, amount, success: true });
    }
    catch (error) {
        yield connection.rollback();
        console.error('❌ Error creating receipt:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'createReceipt');
    }
    finally {
        connection.release();
    }
});
exports.createReceipt = createReceipt;
const getBanks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [rows] = yield db_1.pool.query('SELECT * FROM banks');
        res.json(rows);
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getBanks');
    }
});
exports.getBanks = getBanks;
const createBank = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        const bank = req.body;
        const id = bank.id || (0, uuid_1.v4)();
        // 1. Create Bank
        yield connection.query('INSERT INTO banks (id, name, accountNumber, currency, balance, accountId, iban, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, bank.name, bank.accountNumber, bank.currency, bank.balance, bank.accountId, bank.iban, bank.color]);
        // 2. If linked to an account and has opening balance, update the Account's opening balance
        // BUT only if the account wasn't just created with the same balance (to avoid double-counting)
        if (bank.accountId && bank.balance > 0) {
            // Check the account's current opening balance
            const [existingAccounts] = yield connection.query('SELECT openingBalance, balance FROM accounts WHERE id = ?', [bank.accountId]);
            const existingAccount = existingAccounts[0];
            // Only add if the account's opening balance doesn't already match the bank balance
            // This handles the case where the account was auto-created with the correct balance
            if (existingAccount && existingAccount.openingBalance !== Number(bank.balance)) {
                yield connection.query('UPDATE accounts SET openingBalance = openingBalance + ?, balance = balance + ? WHERE id = ?', [bank.balance, bank.balance, bank.accountId]);
            }
        }
        yield connection.commit();
        // Log audit trail
        // Log audit trail
        const user = req.body.user || 'System';
        yield (0, auditController_1.logAction)(user, 'BANK', 'CREATE', `إنشاء بنك - ${bank.name}`, `الرصيد: ${bank.balance}, العملة: ${bank.currency}`);
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'banks', updatedBy: user });
        }
        res.status(201).json(Object.assign(Object.assign({}, bank), { id }));
    }
    catch (error) {
        yield connection.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'createBank');
    }
    finally {
        connection.release();
    }
});
exports.createBank = createBank;
const updateBank = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        const { id } = req.params;
        const bank = req.body;
        // 1. Get Old Bank Data
        const [oldBanks] = yield connection.query('SELECT * FROM banks WHERE id = ?', [id]);
        const oldBank = oldBanks[0];
        if (!oldBank)
            throw new Error('Bank not found');
        // 2. Update Bank
        yield connection.query('UPDATE banks SET name=?, accountNumber=?, currency=?, balance=?, accountId=?, iban=?, color=? WHERE id=?', [bank.name, bank.accountNumber, bank.currency, bank.balance, bank.accountId, bank.iban, bank.color, id]);
        // 3. Sync Balance Change to GL Account
        // Only if accountId hasn't changed (complex to handle account switch automatically safely)
        if (bank.accountId && bank.accountId === oldBank.accountId) {
            const diff = Number(bank.balance) - Number(oldBank.balance);
            if (diff !== 0) {
                yield connection.query('UPDATE accounts SET openingBalance = openingBalance + ?, balance = balance + ? WHERE id = ?', [diff, diff, bank.accountId]);
            }
        }
        // 4. CASCADE: Update bank name in all related cheques
        // This ensures name changes are reflected everywhere in the system
        if (bank.name && bank.name !== oldBank.name) {
            try {
                yield connection.query('UPDATE cheques SET bankName = ? WHERE bankName = ?', [bank.name, oldBank.name]);
            }
            catch (e) {
                console.log('Note: Could not update cheques bankName:', e);
            }
        }
        yield connection.commit();
        // Log audit trail
        const user = req.body.user || 'System';
        yield (0, auditController_1.logAction)(user, 'BANK', 'UPDATE', `تحديث بنك - ${bank.name}`, `الرصيد الجديد: ${bank.balance}`);
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'banks', updatedBy: user });
            io.emit('entity:changed', { entityType: 'cheque', updatedBy: user }); // Cheques may have updated bank names
        }
        res.json(Object.assign(Object.assign({}, bank), { id }));
    }
    catch (error) {
        yield connection.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'updateBank');
    }
    finally {
        connection.release();
    }
});
exports.updateBank = updateBank;
const resyncBankGL = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        const { id } = req.params;
        // 1. Get Bank Data
        const [banks] = yield connection.query('SELECT * FROM banks WHERE id = ?', [id]);
        const bank = banks[0];
        if (!bank)
            throw new Error('Bank not found');
        if (!bank.accountId)
            throw new Error('Bank is not linked to any GL Account');
        // 2. Force Update Account Opening Balance
        const [accounts] = yield connection.query('SELECT * FROM accounts WHERE id = ?', [bank.accountId]);
        const account = accounts[0];
        if (!account)
            throw new Error('Linked Account not found');
        const oldOpening = Number(account.openingBalance) || 0;
        const newOpening = Number(bank.balance) || 0;
        const diff = newOpening - oldOpening;
        if (diff !== 0) {
            yield connection.query('UPDATE accounts SET openingBalance = ?, balance = balance + ? WHERE id = ?', [newOpening, diff, bank.accountId]);
        }
        yield connection.commit();
        // Log audit trail
        // Log audit trail
        const user = req.body.user || 'System';
        yield (0, auditController_1.logAction)(user, 'BANK', 'RESYNC', `مزامنة رصيد بنك - ${bank.name}`, `الفرق: ${diff}`);
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'banks', updatedBy: user });
        }
        res.json({ message: 'Synced successfully', diff });
    }
    catch (error) {
        yield connection.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'resyncBankGL');
    }
    finally {
        connection.release();
    }
});
exports.resyncBankGL = resyncBankGL;
const deleteBank = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        const { id } = req.params;
        // 1. Get bank data including linked account
        const [banks] = yield connection.query('SELECT id, name, accountId, balance FROM banks WHERE id = ?', [id]);
        const bank = banks[0];
        if (!bank) {
            connection.release();
            return res.status(404).json({
                code: 'NOT_FOUND',
                message: 'البنك غير موجود'
            });
        }
        // 2. Reverse the opening balance from linked GL account
        // This ensures account balance stays accurate after bank deletion
        if (bank.accountId && bank.balance > 0) {
            yield connection.query('UPDATE accounts SET openingBalance = openingBalance - ?, balance = balance - ? WHERE id = ?', [bank.balance, bank.balance, bank.accountId]);
            console.log(`📊 Reversed ${bank.balance} from account ${bank.accountId}`);
        }
        // 3. Delete the bank
        yield connection.query('DELETE FROM banks WHERE id = ?', [id]);
        yield connection.commit();
        // Log audit trail
        const user = (((_a = req.body) === null || _a === void 0 ? void 0 : _a.user) || req.query.user) || 'System';
        yield (0, auditController_1.logAction)(user, 'BANK', 'DELETE', `حذف بنك - ${bank.name}`, `تم حذف البنك | رقم المرجع: ${id}${bank.accountId ? ` | تم عكس الرصيد: ${bank.balance}` : ''}`);
        // Broadcast real-time deletion
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:deleted', { entityType: 'banks', entityId: id, deletedBy: user });
            if (bank.accountId) {
                io.emit('entity:changed', { entityType: 'accounts', updatedBy: user });
            }
        }
        res.json({ message: 'تم حذف البنك بنجاح' });
    }
    catch (error) {
        yield connection.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'deleteBank');
    }
    finally {
        connection.release();
    }
});
exports.deleteBank = deleteBank;
// Get cheques with pagination and filtering
const getCheques = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;
        // Filter parameters
        const status = req.query.status; // PENDING, UNDER_COLLECTION, COLLECTED, etc.
        const type = req.query.type; // RECEIVABLE, PAYABLE
        const partnerId = req.query.partnerId;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const search = req.query.search;
        // Build WHERE clause
        let whereConditions = [];
        let params = [];
        if (status) {
            whereConditions.push('status = ?');
            params.push(status);
        }
        if (type) {
            whereConditions.push('type = ?');
            params.push(type);
        }
        if (partnerId) {
            whereConditions.push('partnerId = ?');
            params.push(partnerId);
        }
        if (startDate) {
            whereConditions.push('dueDate >= ?');
            params.push(startDate);
        }
        if (endDate) {
            whereConditions.push('dueDate <= ?');
            params.push(endDate);
        }
        if (search) {
            whereConditions.push('(chequeNumber LIKE ? OR partnerName LIKE ? OR bankName LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';
        // Get total count
        const [countResult] = yield db_1.pool.query(`SELECT COUNT(*) as total FROM cheques ${whereClause}`, params);
        const total = countResult[0].total;
        // Get paginated data
        const [rows] = yield db_1.pool.query(`SELECT * FROM cheques ${whereClause} ORDER BY dueDate DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        res.json({
            cheques: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getCheques');
    }
});
exports.getCheques = getCheques;
const updateCheque = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        const { id } = req.params;
        const cheque = req.body;
        // Assuming we only update status or details, not create via this controller usually (created via transaction)
        // But for completeness:
        yield connection.query('UPDATE cheques SET status=?, collectionDate=? WHERE id=?', [cheque.status, cheque.collectionDate ? new Date(cheque.collectionDate) : null, id]);
        yield connection.commit();
        // Log audit trail
        const user = req.body.user || 'System';
        yield (0, auditController_1.logAction)(user, 'CHEQUE', 'UPDATE', `تحديث شيك - ${cheque.number || id}`, `الحالة الجديدة: ${cheque.status}`);
        res.json(Object.assign(Object.assign({}, cheque), { id }));
    }
    catch (error) {
        yield connection.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        connection.release();
    }
});
exports.updateCheque = updateCheque;
