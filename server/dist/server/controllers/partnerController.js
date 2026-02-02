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
exports.deletePartner = exports.updatePartner = exports.createPartner = exports.getPartnerById = exports.getPartners = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const auditController_1 = require("./auditController");
const dataFiltering_1 = require("../utils/dataFiltering");
const errorHandler_1 = require("../utils/errorHandler");
const getPartners = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const authReq = req;
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        // Filter parameters
        const type = req.query.type; // 'CUSTOMER' or 'SUPPLIER'
        const search = req.query.search;
        const isCustomer = req.query.isCustomer;
        const isSupplier = req.query.isSupplier;
        const balanceStatus = req.query.balanceStatus;
        // Build WHERE clause
        const conditions = [];
        const params = [];
        // Apply salesman data isolation filter
        if (authReq.userFilterOptions && authReq.systemConfig) {
            const salesmanFilter = (0, dataFiltering_1.buildSalesmanFilterClause)({
                userRole: authReq.userFilterOptions.userRole,
                salesmanId: authReq.userFilterOptions.salesmanId,
                systemConfig: authReq.systemConfig
            }, 'partners', 'p');
            if (salesmanFilter.clause) {
                conditions.push(salesmanFilter.clause);
                params.push(...salesmanFilter.params);
            }
        }
        if (type) {
            conditions.push('p.type = ?');
            params.push(type);
        }
        if (isCustomer !== undefined) {
            conditions.push('p.isCustomer = ?');
            params.push(isCustomer === 'true' ? 1 : 0);
        }
        if (isSupplier !== undefined) {
            conditions.push('p.isSupplier = ?');
            params.push(isSupplier === 'true' ? 1 : 0);
        }
        if (search) {
            conditions.push('(p.name LIKE ? OR p.phone LIKE ? OR p.email LIKE ? OR p.taxId LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        const whereClause = conditions.length > 0
            ? 'WHERE ' + conditions.join(' AND ')
            : '';
        // =====================================================
        // REAL-TIME BALANCE CALCULATION USING EFFICIENT SQL
        // This replaces the stale 'balance' column with dynamic calculation
        // =====================================================
        // Skip real-time calculation if explicitly disabled (for performance in rare cases)
        const skipRealBalance = req.query.skipRealBalance === 'true';
        let balanceSelect;
        if (skipRealBalance) {
            // Use stored balance (legacy behavior)
            balanceSelect = 'p.balance as calculatedBalance';
        }
        else {
            // Calculate real-time balance using SQL subqueries
            // This is MORE EFFICIENT than the previous N+1 query approach
            balanceSelect = `
                (
                    COALESCE(p.openingBalance, 0) +
                    -- Customer balance calculation (for isCustomer = 1 OR not exclusively supplier)
                    CASE WHEN p.isSupplier = 0 OR p.isCustomer = 1 THEN
                        COALESCE((
                            SELECT SUM(
                                CASE 
                                    WHEN i.type = 'INVOICE_SALE' THEN (i.total - COALESCE(i.whtAmount, 0))
                                    WHEN i.type = 'RETURN_SALE' THEN -i.total
                                    WHEN i.type = 'RECEIPT' THEN -i.total
                                    WHEN i.type = 'DISCOUNT_ALLOWED' THEN -i.total
                                    WHEN i.type = 'CHEQUE_DEPOSIT' THEN -i.total
                                    WHEN i.type = 'CHEQUE_COLLECT' THEN -i.total
                                    WHEN i.type = 'CHEQUE_BOUNCE' AND p.isSupplier = 0 THEN i.total
                                    ELSE 0
                                END
                            )
                            FROM invoices i 
                            WHERE i.partnerId = p.id 
                              AND i.status = 'POSTED'
                              AND i.type IN ('INVOICE_SALE', 'RETURN_SALE', 'RECEIPT', 'DISCOUNT_ALLOWED', 'CHEQUE_DEPOSIT', 'CHEQUE_COLLECT', 'CHEQUE_BOUNCE')
                        ), 0)
                    ELSE 0 END
                    +
                    -- Supplier balance calculation (for isSupplier = 1)
                    CASE WHEN p.isSupplier = 1 THEN
                        COALESCE((
                            SELECT SUM(
                                CASE 
                                    WHEN i.type = 'INVOICE_PURCHASE' THEN -i.total
                                    WHEN i.type = 'RETURN_PURCHASE' THEN i.total
                                    WHEN i.type = 'PAYMENT' THEN i.total
                                    WHEN i.type = 'DISCOUNT_EARNED' THEN i.total
                                    WHEN i.type = 'CHEQUE_CASHED' THEN i.total
                                    WHEN i.type = 'CHEQUE_BOUNCE' AND p.isSupplier = 1 THEN -i.total
                                    ELSE 0
                                END
                            )
                            FROM invoices i 
                            WHERE i.partnerId = p.id 
                              AND i.status = 'POSTED'
                              AND i.type IN ('INVOICE_PURCHASE', 'RETURN_PURCHASE', 'PAYMENT', 'DISCOUNT_EARNED', 'CHEQUE_CASHED', 'CHEQUE_BOUNCE')
                        ), 0)
                    ELSE 0 END
                ) as calculatedBalance
            `;
        }
        // Apply HAVING clause for balance filtering (DB level)
        let havingClause = '';
        if (balanceStatus === 'DEBIT') {
            havingClause = 'HAVING calculatedBalance > 0';
        }
        else if (balanceStatus === 'CREDIT') {
            havingClause = 'HAVING calculatedBalance < 0';
        }
        else if (balanceStatus === 'ZERO') {
            havingClause = 'HAVING calculatedBalance = 0';
        }
        // Get paginated partners with real-time balances
        // We use the HAVING clause to filter by the calculated alias
        const [rows] = yield conn.query(`SELECT p.*, ${balanceSelect}
             FROM partners p 
             ${whereClause} 
             ${havingClause}
             ORDER BY p.name 
             LIMIT ? OFFSET ?`, [...params, limit, offset] // Note: HAVING uses alias, so no extra params needed usually unless parameterized
        );
        // Map calculatedBalance to balance for response
        const partnersWithBalance = rows.map(partner => (Object.assign(Object.assign({}, partner), { balance: partner.calculatedBalance !== undefined ? Math.round(partner.calculatedBalance * 100) / 100 : partner.balance })));
        // Get total count (Modified to respect HAVING clause)
        let total = 0;
        if (havingClause) {
            // Need a subquery to count rows after HAVING
            const [countResult] = yield conn.query(`SELECT COUNT(*) as total FROM (
                    SELECT p.id, ${balanceSelect}
                    FROM partners p
                    ${whereClause}
                    ${havingClause}
                ) as filtered_count`, params);
            total = countResult[0].total;
        }
        else {
            // Standard count
            const [countResult] = yield conn.query(`SELECT COUNT(*) as total FROM partners p ${whereClause}`, params);
            total = countResult[0].total;
        }
        // Calculate stats based on real-time balances (for the full filtered set)
        // Note: Global stats (netBalance) usually reflect the search items, not necessarily the specific 'Debit/Credit' filter of the view
        // But for consistency with the list, we generally keep the global search scope stats.
        const [statsResult] = yield conn.query(`SELECT 
                SUM(${skipRealBalance ? 'p.balance' : `(
                    COALESCE(p.openingBalance, 0) +
                    CASE WHEN p.isSupplier = 0 OR p.isCustomer = 1 THEN
                        COALESCE((SELECT SUM(CASE 
                            WHEN i.type = 'INVOICE_SALE' THEN (i.total - COALESCE(i.whtAmount, 0))
                            WHEN i.type IN ('RETURN_SALE', 'RECEIPT', 'DISCOUNT_ALLOWED', 'CHEQUE_DEPOSIT', 'CHEQUE_COLLECT') THEN -i.total
                            WHEN i.type = 'CHEQUE_BOUNCE' AND p.isSupplier = 0 THEN i.total
                            ELSE 0 END) FROM invoices i WHERE i.partnerId = p.id AND i.status = 'POSTED' AND i.type IN ('INVOICE_SALE', 'RETURN_SALE', 'RECEIPT', 'DISCOUNT_ALLOWED', 'CHEQUE_DEPOSIT', 'CHEQUE_COLLECT', 'CHEQUE_BOUNCE')), 0)
                    ELSE 0 END +
                    CASE WHEN p.isSupplier = 1 THEN
                        COALESCE((SELECT SUM(CASE 
                            WHEN i.type = 'INVOICE_PURCHASE' THEN -i.total
                            WHEN i.type IN ('RETURN_PURCHASE', 'PAYMENT', 'DISCOUNT_EARNED', 'CHEQUE_CASHED') THEN i.total
                            WHEN i.type = 'CHEQUE_BOUNCE' AND p.isSupplier = 1 THEN -i.total
                            ELSE 0 END) FROM invoices i WHERE i.partnerId = p.id AND i.status = 'POSTED' AND i.type IN ('INVOICE_PURCHASE', 'RETURN_PURCHASE', 'PAYMENT', 'DISCOUNT_EARNED', 'CHEQUE_CASHED', 'CHEQUE_BOUNCE')), 0)
                    ELSE 0 END
                )`}) as netBalance
             FROM partners p 
             ${whereClause}`, params);
        const netBalance = statsResult[0].netBalance || 0;
        // Calculate assets and liabilities from the CURRENT PAGE partners
        // (This is consistent with previous behavior, though limiting it to the page is an approximation)
        const totalAssets = partnersWithBalance.reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);
        const totalLiabilities = partnersWithBalance.reduce((sum, p) => sum + (p.balance < 0 ? Math.abs(p.balance) : 0), 0);
        conn.release();
        console.log(`📊 Returned ${partnersWithBalance.length} partners with real-time balances (page ${page})`);
        // Return paginated response
        res.json({
            partners: partnersWithBalance,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            stats: {
                netBalance: Math.round(netBalance * 100) / 100,
                totalLiabilities: Math.round(totalLiabilities * 100) / 100,
                totalAssets: Math.round(totalAssets * 100) / 100
            }
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getPartners');
    }
});
exports.getPartners = getPartners;
// Get single partner by ID with REAL-TIME balance calculated from transactions
// This MUST match the calculation in PartnerStatement.tsx partnersWithCalculatedBalance
const getPartnerById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const { id } = req.params;
        // Get partner basic info
        const [partners] = yield conn.query('SELECT * FROM partners WHERE id = ?', [id]);
        if (!partners.length) {
            conn.release();
            return res.status(404).json({ message: 'Partner not found' });
        }
        const partner = partners[0];
        const isSupplier = partner.isSupplier == 1 || partner.type === 'SUPPLIER';
        // Define transaction types based on partner type - matches PartnerStatement.tsx
        let targetTypes;
        if (isSupplier) {
            targetTypes = ['INVOICE_PURCHASE', 'RETURN_PURCHASE', 'PAYMENT', 'DISCOUNT_EARNED', 'CHEQUE_BOUNCE', 'CHEQUE_CASHED'];
        }
        else {
            targetTypes = ['INVOICE_SALE', 'RETURN_SALE', 'RECEIPT', 'DISCOUNT_ALLOWED', 'CHEQUE_BOUNCE', 'CHEQUE_COLLECT', 'CHEQUE_DEPOSIT'];
        }
        // Get all POSTED transactions for this partner (from invoices table, same as statement)
        const [transactions] = yield conn.query(`SELECT type, total, whtAmount FROM invoices 
             WHERE partnerId = ? AND status = 'POSTED' AND type IN (?)`, [id, targetTypes]);
        // Start with opening balance - exactly as statement does
        let balance = parseFloat(String(partner.openingBalance || 0));
        // Calculate balance from transactions - matching PartnerStatement.tsx logic exactly
        for (const t of transactions) {
            const amount = Number(t.total) || 0;
            const whtAmount = Number(t.whtAmount) || 0;
            const netAmount = amount - whtAmount;
            switch (t.type) {
                // Customer transactions
                case 'INVOICE_SALE':
                    balance += netAmount;
                    break;
                case 'RETURN_SALE':
                    balance -= amount;
                    break;
                case 'RECEIPT':
                    balance -= amount;
                    break;
                case 'DISCOUNT_ALLOWED':
                    balance -= amount;
                    break;
                case 'CHEQUE_DEPOSIT':
                    balance -= amount;
                    break;
                case 'CHEQUE_COLLECT':
                    balance -= amount;
                    break;
                // Supplier transactions
                case 'INVOICE_PURCHASE':
                    balance -= amount;
                    break;
                case 'RETURN_PURCHASE':
                    balance += amount;
                    break;
                case 'PAYMENT':
                    balance += amount;
                    break;
                case 'DISCOUNT_EARNED':
                    balance += amount;
                    break;
                case 'CHEQUE_CASHED':
                    balance += amount;
                    break;
                // Cheque bounce - simplified (matches isSupplier fallback in statement)
                case 'CHEQUE_BOUNCE':
                    balance += isSupplier ? -amount : amount;
                    break;
            }
        }
        // Round to 2 decimal places
        balance = Math.round(balance * 100) / 100;
        console.log(`📊 Partner ${partner.name} (${isSupplier ? 'Supplier' : 'Customer'}): Opening=${partner.openingBalance}, Transactions=${transactions.length}, Balance=${balance}`);
        conn.release();
        res.json(Object.assign(Object.assign({}, partner), { balance: balance, calculatedBalance: balance }));
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getPartnerById');
    }
});
exports.getPartnerById = getPartnerById;
const createPartner = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        yield conn.beginTransaction();
        const { name, phone, email, taxId, address, contactPerson, paymentTerms, openingBalance, creditLimit, classification, status, groupId, commercialRegister, salesmanId } = req.body;
        // Default values for mobile app compatibility
        let { type, isCustomer, isSupplier } = req.body;
        console.log('DEBUG CREATE PARTNER - RAW:', { type, isCustomer, isSupplier, body: req.body });
        // Auto-set type based on isCustomer/isSupplier flags, or correct invalid 'BOTH' type
        if (!type || type === 'BOTH') {
            if (req.body.isCustomer && req.body.isSupplier) {
                type = 'CUSTOMER'; // Use CUSTOMER as primary type for mixed partners
            }
            else if (req.body.isSupplier) {
                type = 'SUPPLIER';
            }
            else {
                type = 'CUSTOMER'; // Default to customer
            }
        }
        console.log('DEBUG CREATE PARTNER - PROCESSED TYPE:', type);
        // Ensure isCustomer/isSupplier are set based on type
        if (isCustomer === undefined && isSupplier === undefined) {
            if (type === 'CUSTOMER') {
                isCustomer = true;
                isSupplier = false;
            }
            else if (type === 'SUPPLIER') {
                isCustomer = false;
                isSupplier = true;
            }
            else {
                isCustomer = true;
                isSupplier = true;
            }
        }
        // Validation: At least one type must be selected
        if (!isCustomer && !isSupplier) {
            yield conn.rollback();
            return res.status(400).json({ message: 'Partner must be either a customer, supplier, or both' });
        }
        const id = req.body.id || (0, uuid_1.v4)(); // Accept client-provided ID for offline sync
        const salesmanValue = salesmanId === '' ? null : (salesmanId || null);
        yield conn.query('INSERT INTO partners (id, name, type, isCustomer, isSupplier, phone, email, taxId, address, contactPerson, paymentTerms, openingBalance, balance, creditLimit, classification, status, groupId, commercialRegister, salesmanId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, name, type, isCustomer ? 1 : 0, isSupplier ? 1 : 0, phone, email, taxId, address, contactPerson, paymentTerms, openingBalance || 0, openingBalance || 0, creditLimit || 0, classification, status || 'ACTIVE', groupId, commercialRegister, salesmanValue]);
        yield conn.commit();
        // Log audit trail
        const user = req.body.user || 'System';
        const partnerType = isCustomer && isSupplier ? 'Customer & Supplier' : isCustomer ? 'Customer' : 'Supplier';
        yield (0, auditController_1.logAction)(user, 'PARTNER', 'CREATE', `Created ${partnerType}: ${name}`, `Opening Balance: ${openingBalance || 0}`);
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'partner', updatedBy: user });
        }
        res.status(201).json(Object.assign(Object.assign({}, req.body), { id, balance: openingBalance || 0, isCustomer, isSupplier }));
    }
    catch (error) {
        yield conn.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'creating partner');
    }
    finally {
        conn.release();
    }
});
exports.createPartner = createPartner;
const updatePartner = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        yield conn.beginTransaction();
        const { id } = req.params;
        const { name, type, phone, email, taxId, address, contactPerson, paymentTerms, isCustomer, isSupplier, creditLimit, classification, status, groupId, commercialRegister, openingBalance, balance, salesmanId } = req.body;
        // Validation: At least one type must be selected
        if (isCustomer !== undefined || isSupplier !== undefined) {
            if (!isCustomer && !isSupplier) {
                yield conn.rollback();
                return res.status(400).json({ message: 'Partner must be either a customer, supplier, or both' });
            }
        }
        // Update partner record
        const salesmanValue = salesmanId === '' ? null : (salesmanId || null);
        yield conn.query('UPDATE partners SET name = ?, type = ?, isCustomer = ?, isSupplier = ?, phone = ?, email = ?, taxId = ?, address = ?, contactPerson = ?, paymentTerms = ?, creditLimit = ?, classification = ?, status = ?, groupId = ?, commercialRegister = ?, openingBalance = ?, balance = ?, salesmanId = ? WHERE id = ?', [name, type, isCustomer ? 1 : 0, isSupplier ? 1 : 0, phone, email, taxId, address, contactPerson, paymentTerms, creditLimit || 0, classification, status, groupId, commercialRegister, openingBalance, balance, salesmanValue, id]);
        // CASCADE: Update partner name in all related records
        // This ensures name changes are reflected everywhere in the system
        if (name) {
            // Update invoices
            yield conn.query('UPDATE invoices SET partnerName = ? WHERE partnerId = ?', [name, id]);
            // Update cheques
            yield conn.query('UPDATE cheques SET partnerName = ? WHERE partnerId = ?', [name, id]);
            // Update transactions (if the table has partnerName field)
            try {
                yield conn.query('UPDATE transactions SET partnerName = ? WHERE partnerId = ?', [name, id]);
            }
            catch (e) {
                // Ignore if transactions table doesn't have partnerName column
            }
        }
        yield conn.commit();
        // Log audit trail
        const user = req.body.user || 'System';
        const partnerType = isCustomer && isSupplier ? 'Customer & Supplier' : isCustomer ? 'Customer' : 'Supplier';
        yield (0, auditController_1.logAction)(user, 'PARTNER', 'UPDATE', `Updated ${partnerType}: ${name}`, `ID: ${id}`);
        // Broadcast real-time update to all clients
        const io = req.app.get('io');
        if (io) {
            // Broadcast partner change
            io.emit('entity:changed', { entityType: 'partner', updatedBy: user });
            // Also broadcast invoice/cheque changes since names were updated
            io.emit('entity:changed', { entityType: 'invoice', updatedBy: user });
            io.emit('entity:changed', { entityType: 'cheque', updatedBy: user });
        }
        res.json(Object.assign({ id }, req.body));
    }
    catch (error) {
        yield conn.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'updating partner');
    }
    finally {
        conn.release();
    }
});
exports.updatePartner = updatePartner;
const deletePartner = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const conn = yield (0, db_1.getConnection)();
    try {
        yield conn.beginTransaction();
        const { id } = req.params;
        // Get partner name before deletion
        const [partners] = yield conn.query('SELECT name, type FROM partners WHERE id = ?', [id]);
        const partnerName = ((_a = partners[0]) === null || _a === void 0 ? void 0 : _a.name) || id;
        const partnerType = ((_b = partners[0]) === null || _b === void 0 ? void 0 : _b.type) || 'PARTNER';
        yield conn.query('DELETE FROM partners WHERE id = ?', [id]);
        yield conn.commit();
        // Log audit trail
        const user = (((_c = req.body) === null || _c === void 0 ? void 0 : _c.user) || req.query.user) || 'System';
        const typeArabic = partnerType === 'CUSTOMER' ? 'عميل' : partnerType === 'SUPPLIER' ? 'مورد' : 'شريك';
        yield (0, auditController_1.logAction)(user, 'PARTNER', 'DELETE', `حذف ${typeArabic} - ${partnerName}`, `تم حذف ${typeArabic} | رقم المرجع: ${id}`);
        // Broadcast real-time deletion
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:deleted', { entityType: 'partner', entityId: id, deletedBy: user });
        }
        res.json({ message: 'Partner deleted' });
    }
    catch (error) {
        yield conn.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'deleting partner');
    }
    finally {
        conn.release();
    }
});
exports.deletePartner = deletePartner;
