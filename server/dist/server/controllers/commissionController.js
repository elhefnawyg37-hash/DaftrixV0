"use strict";
/**
 * Commission Controller (مراقب العمولات)
 * Handles tiered commissions, commission records, and approval workflow
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
exports.getSalesmanCommissionReport = exports.getUnassignedCustomers = exports.unassignCustomer = exports.bulkAssignCustomers = exports.assignCustomer = exports.getSalesmanCustomers = exports.getCommissionSummary = exports.markCommissionPaid = exports.rejectCommission = exports.approveCommission = exports.calculateCommission = exports.getCommissionRecords = exports.deleteCommissionTier = exports.updateCommissionTier = exports.createCommissionTier = exports.getCommissionTiers = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../db");
const errorHandler_1 = require("../utils/errorHandler");
// =================== COMMISSION TIERS ===================
// Get all commission tiers
const getCommissionTiers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const salesmanId = req.query.salesmanId;
        let query = `
            SELECT ct.*, s.name as salesmanName 
            FROM commission_tiers ct
            LEFT JOIN salesmen s ON ct.salesmanId = s.id
            WHERE ct.isActive = TRUE
        `;
        const params = [];
        if (salesmanId) {
            query += ' AND (ct.salesmanId = ? OR ct.isGlobal = TRUE)';
            params.push(salesmanId);
        }
        query += ' ORDER BY ct.minAmount ASC';
        const [tiers] = yield conn.query(query, params);
        conn.release();
        res.json(tiers);
    }
    catch (error) {
        console.error('Error fetching commission tiers:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch commission tiers');
    }
});
exports.getCommissionTiers = getCommissionTiers;
// Create commission tier
const createCommissionTier = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const { salesmanId, tierName, minAmount, maxAmount, commissionRate, isGlobal } = req.body;
        const id = (0, uuid_1.v4)();
        yield conn.query(`
            INSERT INTO commission_tiers (id, salesmanId, tierName, minAmount, maxAmount, commissionRate, isGlobal)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [id, isGlobal ? null : salesmanId, tierName, minAmount, maxAmount || null, commissionRate, isGlobal || false]);
        conn.release();
        res.status(201).json({ id, message: 'Commission tier created successfully' });
    }
    catch (error) {
        console.error('Error creating commission tier:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create commission tier');
    }
});
exports.createCommissionTier = createCommissionTier;
// Update commission tier
const updateCommissionTier = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const { id } = req.params;
        const { salesmanId, tierName, minAmount, maxAmount, commissionRate, isGlobal, isActive } = req.body;
        yield conn.query(`
            UPDATE commission_tiers 
            SET salesmanId = ?, tierName = ?, minAmount = ?, maxAmount = ?, 
                commissionRate = ?, isGlobal = ?, isActive = ?
            WHERE id = ?
        `, [isGlobal ? null : salesmanId, tierName, minAmount, maxAmount || null, commissionRate, isGlobal || false, isActive !== false, id]);
        conn.release();
        res.json({ message: 'Commission tier updated successfully' });
    }
    catch (error) {
        console.error('Error updating commission tier:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update commission tier');
    }
});
exports.updateCommissionTier = updateCommissionTier;
// Delete commission tier
const deleteCommissionTier = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const { id } = req.params;
        yield conn.query('UPDATE commission_tiers SET isActive = FALSE WHERE id = ?', [id]);
        conn.release();
        res.json({ message: 'Commission tier deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting commission tier:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete commission tier');
    }
});
exports.deleteCommissionTier = deleteCommissionTier;
// =================== COMMISSION RECORDS ===================
// Get commission records
const getCommissionRecords = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const { salesmanId, status, startDate, endDate } = req.query;
        let query = `
            SELECT cr.*, 
                   s.name as salesmanName,
                   u.username as approvedByName
            FROM commission_records cr
            LEFT JOIN salesmen s ON cr.salesmanId = s.id
            LEFT JOIN users u ON cr.approvedBy = u.id
            WHERE 1=1
        `;
        const params = [];
        if (salesmanId) {
            query += ' AND cr.salesmanId = ?';
            params.push(salesmanId);
        }
        if (status) {
            query += ' AND cr.status = ?';
            params.push(status);
        }
        if (startDate) {
            query += ' AND cr.periodStart >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND cr.periodEnd <= ?';
            params.push(endDate);
        }
        query += ' ORDER BY cr.periodEnd DESC, s.name ASC';
        const [records] = yield conn.query(query, params);
        conn.release();
        res.json(records);
    }
    catch (error) {
        console.error('Error fetching commission records:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch commission records');
    }
});
exports.getCommissionRecords = getCommissionRecords;
// Calculate and create commission record for a period
const calculateCommission = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const { salesmanId, periodStart, periodEnd, bonusAmount, deductions, notes } = req.body;
        // Get salesman info
        const [salesmanResult] = yield conn.query('SELECT * FROM salesmen WHERE id = ?', [salesmanId]);
        const salesman = salesmanResult[0];
        if (!salesman) {
            conn.release();
            return res.status(404).json({ error: 'Salesman not found' });
        }
        // Calculate sales for the period
        const [salesResult] = yield conn.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN type IN ('INVOICE_SALE', 'SALE_INVOICE') THEN total ELSE 0 END), 0) as totalSales,
                COALESCE(SUM(CASE WHEN type = 'RETURN_SALE' THEN total ELSE 0 END), 0) as totalReturns
            FROM invoices
            WHERE salesmanId = ?
              AND date >= ?
              AND date <= ?
              AND status = 'POSTED'
        `, [salesmanId, periodStart, periodEnd]);
        const { totalSales, totalReturns } = salesResult[0];
        const netSales = totalSales - totalReturns;
        // Get commission rate (check tiers first, then fallback to salesman default)
        let commissionRate = salesman.commissionRate || 0;
        // Check for tiered commission
        const [tierResult] = yield conn.query(`
            SELECT commissionRate FROM commission_tiers
            WHERE (salesmanId = ? OR isGlobal = TRUE)
              AND isActive = TRUE
              AND minAmount <= ?
              AND (maxAmount IS NULL OR maxAmount >= ?)
            ORDER BY isGlobal ASC, commissionRate DESC
            LIMIT 1
        `, [salesmanId, netSales, netSales]);
        if (tierResult.length > 0) {
            commissionRate = tierResult[0].commissionRate;
        }
        // Calculate commission
        const commissionAmount = (netSales * commissionRate) / 100;
        const finalAmount = commissionAmount + (bonusAmount || 0) - (deductions || 0);
        // Create record
        const id = (0, uuid_1.v4)();
        yield conn.query(`
            INSERT INTO commission_records 
            (id, salesmanId, periodStart, periodEnd, totalSales, totalReturns, netSales, 
             commissionRate, commissionAmount, bonusAmount, deductions, finalAmount, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, salesmanId, periodStart, periodEnd, totalSales, totalReturns, netSales,
            commissionRate, commissionAmount, bonusAmount || 0, deductions || 0, finalAmount, notes || null]);
        conn.release();
        res.status(201).json({
            id,
            salesmanId,
            totalSales,
            totalReturns,
            netSales,
            commissionRate,
            commissionAmount,
            bonusAmount: bonusAmount || 0,
            deductions: deductions || 0,
            finalAmount,
            status: 'PENDING',
            message: 'Commission calculated successfully'
        });
    }
    catch (error) {
        console.error('Error calculating commission:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'calculate commission');
    }
});
exports.calculateCommission = calculateCommission;
// Approve commission record
const approveCommission = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const conn = yield (0, db_1.getConnection)();
        const authReq = req;
        const { id } = req.params;
        const userId = (_a = authReq.user) === null || _a === void 0 ? void 0 : _a.id;
        yield conn.query(`
            UPDATE commission_records 
            SET status = 'APPROVED', approvedBy = ?, approvedAt = NOW()
            WHERE id = ? AND status = 'PENDING'
        `, [userId, id]);
        conn.release();
        res.json({ message: 'Commission approved successfully' });
    }
    catch (error) {
        console.error('Error approving commission:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'approve commission');
    }
});
exports.approveCommission = approveCommission;
// Reject commission record
const rejectCommission = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const conn = yield (0, db_1.getConnection)();
        const authReq = req;
        const { id } = req.params;
        const { notes } = req.body;
        const userId = (_a = authReq.user) === null || _a === void 0 ? void 0 : _a.id;
        yield conn.query(`
            UPDATE commission_records 
            SET status = 'REJECTED', approvedBy = ?, approvedAt = NOW(), notes = CONCAT(COALESCE(notes, ''), '\nسبب الرفض: ', ?)
            WHERE id = ? AND status = 'PENDING'
        `, [userId, notes || 'لم يحدد', id]);
        conn.release();
        res.json({ message: 'Commission rejected' });
    }
    catch (error) {
        console.error('Error rejecting commission:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'reject commission');
    }
});
exports.rejectCommission = rejectCommission;
// Mark commission as paid (with treasury transaction)
const markCommissionPaid = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const conn = yield (0, db_1.getConnection)();
    try {
        // =====================================================
        // CRITICAL: Use transaction for all financial operations
        // This ensures atomicity - all succeed or all rollback
        // =====================================================
        yield conn.beginTransaction();
        const authReq = req;
        const { id } = req.params;
        const { treasuryAccountId, notes } = req.body;
        const userId = (_a = authReq.user) === null || _a === void 0 ? void 0 : _a.id;
        // Get commission record details
        const [recordResult] = yield conn.query(`SELECT cr.*, s.name as salesmanName 
             FROM commission_records cr 
             LEFT JOIN salesmen s ON cr.salesmanId = s.id 
             WHERE cr.id = ? AND cr.status = 'APPROVED'`, [id]);
        const record = recordResult[0];
        if (!record) {
            yield conn.rollback();
            conn.release();
            return res.status(404).json({ error: 'Commission record not found or not approved' });
        }
        // Verify treasury account exists
        if (treasuryAccountId) {
            const [accountResult] = yield conn.query('SELECT * FROM accounts WHERE id = ?', [treasuryAccountId]);
            const account = accountResult[0];
            if (!account) {
                yield conn.rollback();
                conn.release();
                return res.status(404).json({ error: 'Treasury account not found' });
            }
            // Create journal entry for the payment
            const journalId = (0, uuid_1.v4)();
            const journalNumber = `COM-${Date.now()}`;
            const description = `صرف عمولة للمندوب ${record.salesmanName} - فترة ${(_b = record.periodStart) === null || _b === void 0 ? void 0 : _b.split('T')[0]} إلى ${(_c = record.periodEnd) === null || _c === void 0 ? void 0 : _c.split('T')[0]}`;
            yield conn.query(`
                INSERT INTO journal_entries (id, number, date, description, createdBy, type)
                VALUES (?, ?, NOW(), ?, ?, 'COMMISSION_PAYMENT')
            `, [journalId, journalNumber, description, userId]);
            // Create journal lines (debit: commission expense, credit: treasury)
            const entryId1 = (0, uuid_1.v4)();
            const entryId2 = (0, uuid_1.v4)();
            // Debit - Commission Expense (we'll use a generic expense account or create the entry)
            yield conn.query(`
                INSERT INTO journal_entry_lines (id, journalEntryId, accountId, debit, credit, description)
                VALUES (?, ?, ?, ?, 0, ?)
            `, [entryId1, journalId, treasuryAccountId, 0, record.finalAmount, `عمولة ${record.salesmanName}`]);
            // Credit - Treasury Account (reduce treasury)
            yield conn.query(`
                INSERT INTO journal_entry_lines (id, journalEntryId, accountId, debit, credit, description)
                VALUES (?, ?, ?, 0, ?, ?)
            `, [entryId2, journalId, treasuryAccountId, record.finalAmount, `صرف عمولة ${record.salesmanName}`]);
            // Update treasury account balance
            yield conn.query(`
                UPDATE accounts SET balance = balance - ? WHERE id = ?
            `, [record.finalAmount, treasuryAccountId]);
            // Update commission record with payment details
            yield conn.query(`
                UPDATE commission_records 
                SET status = 'PAID', paidAt = NOW(), notes = CONCAT(COALESCE(notes, ''), ?)
                WHERE id = ?
            `, [notes ? `\nملاحظات الدفع: ${notes}` : '', id]);
        }
        else {
            // No treasury account - just mark as paid
            yield conn.query(`
                UPDATE commission_records 
                SET status = 'PAID', paidAt = NOW()
                WHERE id = ? AND status = 'APPROVED'
            `, [id]);
        }
        // All operations successful - commit the transaction
        yield conn.commit();
        conn.release();
        console.log(`✅ Commission ${id} marked as paid (transaction committed)`);
        res.json({ message: 'Commission marked as paid', treasuryAccountId });
    }
    catch (error) {
        // Rollback on any error to maintain data integrity
        yield conn.rollback();
        conn.release();
        console.error('❌ Error marking commission as paid (transaction rolled back):', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'mark commission as paid');
    }
});
exports.markCommissionPaid = markCommissionPaid;
// Get commission summary for dashboard
const getCommissionSummary = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const [summary] = yield conn.query(`
            SELECT 
                COUNT(*) as totalRecords,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingCount,
                SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approvedCount,
                SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paidCount,
                SUM(CASE WHEN status = 'PENDING' THEN finalAmount ELSE 0 END) as pendingAmount,
                SUM(CASE WHEN status = 'APPROVED' THEN finalAmount ELSE 0 END) as approvedAmount,
                SUM(CASE WHEN status = 'PAID' THEN finalAmount ELSE 0 END) as paidAmount
            FROM commission_records
        `);
        conn.release();
        res.json(summary[0]);
    }
    catch (error) {
        console.error('Error fetching commission summary:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch commission summary');
    }
});
exports.getCommissionSummary = getCommissionSummary;
// =================== SALESMAN CUSTOMERS ===================
// Get all customer assignments
const getSalesmanCustomers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const salesmanId = req.query.salesmanId;
        let query = `
            SELECT sc.*, 
                   s.name as salesmanName,
                   p.name as partnerName,
                   p.phone as partnerPhone,
                   p.address as partnerAddress
            FROM salesman_customers sc
            JOIN salesmen s ON sc.salesmanId = s.id
            JOIN partners p ON sc.partnerId = p.id
            WHERE 1=1
        `;
        const params = [];
        if (salesmanId) {
            query += ' AND sc.salesmanId = ?';
            params.push(salesmanId);
        }
        query += ' ORDER BY s.name, p.name';
        const [assignments] = yield conn.query(query, params);
        conn.release();
        res.json(assignments);
    }
    catch (error) {
        console.error('Error fetching customer assignments:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch customer assignment');
    }
});
exports.getSalesmanCustomers = getSalesmanCustomers;
// Assign customer to salesman
const assignCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const { salesmanId, partnerId, notes } = req.body;
        const id = (0, uuid_1.v4)();
        // Check if already assigned
        const [existing] = yield conn.query('SELECT id FROM salesman_customers WHERE salesmanId = ? AND partnerId = ?', [salesmanId, partnerId]);
        if (existing.length > 0) {
            conn.release();
            return res.status(400).json({ error: 'Customer already assigned to this salesman' });
        }
        yield conn.query(`
            INSERT INTO salesman_customers (id, salesmanId, partnerId, notes)
            VALUES (?, ?, ?, ?)
        `, [id, salesmanId, partnerId, notes || null]);
        conn.release();
        res.status(201).json({ id, message: 'Customer assigned successfully' });
    }
    catch (error) {
        console.error('Error assigning customer:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'assign customer');
    }
});
exports.assignCustomer = assignCustomer;
// Bulk assign customers
const bulkAssignCustomers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const { salesmanId, partnerIds, notes } = req.body;
        let assignedCount = 0;
        for (const partnerId of partnerIds) {
            const id = (0, uuid_1.v4)();
            try {
                yield conn.query(`
                    INSERT IGNORE INTO salesman_customers (id, salesmanId, partnerId, notes)
                    VALUES (?, ?, ?, ?)
                `, [id, salesmanId, partnerId, notes || null]);
                assignedCount++;
            }
            catch (e) {
                // Skip duplicates
            }
        }
        conn.release();
        res.status(201).json({
            assignedCount,
            message: `${assignedCount} customers assigned successfully`
        });
    }
    catch (error) {
        console.error('Error bulk assigning customers:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'assign customers');
    }
});
exports.bulkAssignCustomers = bulkAssignCustomers;
// Remove customer assignment
const unassignCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const { id } = req.params;
        yield conn.query('DELETE FROM salesman_customers WHERE id = ?', [id]);
        conn.release();
        res.json({ message: 'Customer unassigned successfully' });
    }
    catch (error) {
        console.error('Error unassigning customer:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'unassign customer');
    }
});
exports.unassignCustomer = unassignCustomer;
// Get unassigned customers
const getUnassignedCustomers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const [customers] = yield conn.query(`
            SELECT p.id, p.name, p.phone, p.address, p.type
            FROM partners p
            WHERE p.type = 'CUSTOMER'
              AND p.id NOT IN (SELECT partnerId FROM salesman_customers)
            ORDER BY p.name
        `);
        conn.release();
        res.json(customers);
    }
    catch (error) {
        console.error('Error fetching unassigned customers:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch unassigned customer');
    }
});
exports.getUnassignedCustomers = getUnassignedCustomers;
// =================== SALESMAN COMMISSION REPORT ===================
// Get detailed salesman commission report with product breakdown
const getSalesmanCommissionReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const { salesmanId, startDate, endDate } = req.query;
        if (!salesmanId || !startDate || !endDate) {
            return res.status(400).json({ error: 'salesmanId, startDate, and endDate are required' });
        }
        // Get salesman info
        const [salesmanResult] = yield conn.query('SELECT * FROM salesmen WHERE id = ?', [salesmanId]);
        const salesman = salesmanResult[0];
        if (!salesman) {
            conn.release();
            return res.status(404).json({ error: 'Salesman not found' });
        }
        // Get product-level sales data for the period
        const [productSales] = yield conn.query(`
            SELECT 
                il.productId,
                p.name as productName,
                p.sku,
                p.cost,
                p.price as basePrice,
                SUM(CASE WHEN i.type IN ('INVOICE_SALE', 'SALE_INVOICE') THEN il.quantity ELSE 0 END) as salesQuantity,
                SUM(CASE WHEN i.type = 'RETURN_SALE' THEN il.quantity ELSE 0 END) as returnQuantity,
                SUM(CASE WHEN i.type IN ('INVOICE_SALE', 'SALE_INVOICE') THEN il.total ELSE 0 END) as salesAmount,
                SUM(CASE WHEN i.type = 'RETURN_SALE' THEN il.total ELSE 0 END) as returnAmount,
                AVG(il.price) as avgPrice,
                COUNT(DISTINCT i.id) as invoiceCount
            FROM invoice_lines il
            JOIN invoices i ON il.invoiceId = i.id
            JOIN products p ON il.productId = p.id
            WHERE i.salesmanId = ?
              AND i.date >= ?
              AND i.date <= ?
              AND i.status = 'POSTED'
            GROUP BY il.productId, p.name, p.sku, p.cost, p.price
            ORDER BY salesAmount DESC
        `, [salesmanId, startDate, endDate]);
        // Calculate net quantities and totals
        const productData = productSales.map(item => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            cost: item.cost || 0,
            basePrice: item.basePrice || 0,
            quantity: (item.salesQuantity || 0) - (item.returnQuantity || 0),
            salesAmount: (item.salesAmount || 0) - (item.returnAmount || 0),
            avgPrice: item.avgPrice || 0,
            invoiceCount: item.invoiceCount || 0
        })).filter(item => item.quantity > 0 || item.salesAmount > 0);
        // Get totals summary
        const [totalsResult] = yield conn.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN type IN ('INVOICE_SALE', 'SALE_INVOICE') THEN total ELSE 0 END), 0) as totalSales,
                COALESCE(SUM(CASE WHEN type = 'RETURN_SALE' THEN total ELSE 0 END), 0) as totalReturns,
                COUNT(DISTINCT CASE WHEN type IN ('INVOICE_SALE', 'SALE_INVOICE') THEN id END) as salesInvoiceCount,
                COUNT(DISTINCT CASE WHEN type = 'RETURN_SALE' THEN id END) as returnInvoiceCount
            FROM invoices
            WHERE salesmanId = ?
              AND date >= ?
              AND date <= ?
              AND status = 'POSTED'
        `, [salesmanId, startDate, endDate]);
        const totals = totalsResult[0];
        conn.release();
        res.json({
            salesman: {
                id: salesman.id,
                name: salesman.name,
                phone: salesman.phone,
                commissionRate: salesman.commissionRate || 0
            },
            period: {
                startDate,
                endDate
            },
            productSales: productData,
            summary: {
                totalSales: totals.totalSales || 0,
                totalReturns: totals.totalReturns || 0,
                netSales: (totals.totalSales || 0) - (totals.totalReturns || 0),
                salesInvoiceCount: totals.salesInvoiceCount || 0,
                returnInvoiceCount: totals.returnInvoiceCount || 0,
                productCount: productData.length
            }
        });
    }
    catch (error) {
        console.error('Error generating salesman commission report:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'generate commission repor');
    }
});
exports.getSalesmanCommissionReport = getSalesmanCommissionReport;
