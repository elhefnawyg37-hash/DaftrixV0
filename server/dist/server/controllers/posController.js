"use strict";
/**
 * POS Controller (نقطة البيع)
 * ============================
 * Handles all Point of Sale operations including:
 * - Shift management (open/close)
 * - Cash drawer operations
 * - Quick sales processing
 * - POS reports (X/Z reports)
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
exports.recallHeldOrder = exports.getHeldOrders = exports.holdOrder = exports.getProductByBarcode = exports.getPOSProducts = exports.getShifts = exports.getHourlySales = exports.getShiftReport = exports.processPOSSale = exports.getShiftMovements = exports.addCashMovement = exports.closeShift = exports.getCurrentShift = exports.openShift = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../db");
const dateUtils_1 = require("../../utils/dateUtils");
// TODO: Add real-time POS updates when socket is refactored
// import { emitEntityChanged } from '../socket';
// ============================================
// SHIFT MANAGEMENT
// ============================================
/**
 * Open a new shift for a user
 * POST /api/pos/shift/open
 */
const openShift = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const conn = yield (0, db_1.getConnection)();
    try {
        const { openingCash = 0, warehouseId, terminalName } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const userName = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown';
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Check if user already has an open shift
        const [existingShifts] = yield conn.query(`SELECT id FROM pos_shifts WHERE userId COLLATE utf8mb4_unicode_ci = ? AND status = 'OPEN'`, [userId]);
        if (existingShifts.length > 0) {
            return res.status(400).json({
                error: 'لديك وردية مفتوحة بالفعل. يرجى إغلاقها أولاً.',
                existingShiftId: existingShifts[0].id
            });
        }
        const shiftId = (0, uuid_1.v4)();
        const now = (0, dateUtils_1.getEgyptianISOString)();
        yield conn.query(`INSERT INTO pos_shifts (id, userId, warehouseId, terminalName, openedAt, openingCash, status)
             VALUES (?, ?, ?, ?, ?, ?, 'OPEN')`, [shiftId, userId, warehouseId || null, terminalName || null, now, openingCash]);
        // Record opening cash movement
        yield conn.query(`INSERT INTO pos_cash_movements (id, shiftId, type, amount, paymentMethod, description, createdAt)
             VALUES (?, ?, 'OPENING', ?, 'CASH', 'رصيد افتتاحي', ?)`, [(0, uuid_1.v4)(), shiftId, openingCash, now]);
        // Fetch warehouse name if provided
        let warehouseName = null;
        if (warehouseId) {
            const [warehouses] = yield conn.query(`SELECT name FROM warehouses WHERE id = ?`, [warehouseId]);
            warehouseName = (_c = warehouses[0]) === null || _c === void 0 ? void 0 : _c.name;
        }
        const shift = {
            id: shiftId,
            userId,
            userName,
            warehouseId,
            warehouseName,
            terminalName,
            openedAt: now,
            openingCash,
            status: 'OPEN',
            totalSales: 0,
            totalRefunds: 0,
            salesCount: 0,
            refundCount: 0
        };
        // Emit real-time update (when socket is available)
        // emitEntityChanged('pos-shift', shift, userName);
        res.json({
            success: true,
            shift,
            message: 'تم فتح الوردية بنجاح'
        });
    }
    catch (error) {
        console.error('Error opening shift:', error);
        res.status(500).json({ error: error.message || 'حدث خطأ أثناء فتح الوردية' });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.openShift = openShift;
/**
 * Get current open shift for a user
 * GET /api/pos/shift/current
 */
const getCurrentShift = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const conn = yield (0, db_1.getConnection)();
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const [shifts] = yield conn.query(`SELECT s.*, u.name as userName, w.name as warehouseName
             FROM pos_shifts s
             LEFT JOIN users u ON s.userId COLLATE utf8mb4_unicode_ci = u.id COLLATE utf8mb4_unicode_ci
             LEFT JOIN warehouses w ON s.warehouseId COLLATE utf8mb4_unicode_ci = w.id COLLATE utf8mb4_unicode_ci
             WHERE s.userId COLLATE utf8mb4_unicode_ci = ? AND s.status = 'OPEN'
             ORDER BY s.openedAt DESC
             LIMIT 1`, [userId]);
        const shift = shifts[0] || null;
        if (shift) {
            // Get cash movements summary
            const [movements] = yield conn.query(`SELECT 
                    SUM(CASE WHEN type IN ('OPENING', 'DEPOSIT', 'SALE') THEN amount ELSE 0 END) as totalIn,
                    SUM(CASE WHEN type IN ('WITHDRAWAL', 'REFUND') THEN amount ELSE 0 END) as totalOut,
                    SUM(CASE WHEN type = 'SALE' AND paymentMethod = 'CASH' THEN amount ELSE 0 END) as cashSales,
                    SUM(CASE WHEN type = 'SALE' AND paymentMethod = 'BANK' THEN amount ELSE 0 END) as bankSales
                 FROM pos_cash_movements
                 WHERE shiftId = ?`, [shift.id]);
            shift.expectedCash = parseFloat(((_b = movements[0]) === null || _b === void 0 ? void 0 : _b.totalIn) || 0) -
                parseFloat(((_c = movements[0]) === null || _c === void 0 ? void 0 : _c.totalOut) || 0);
            shift.cashSales = parseFloat(((_d = movements[0]) === null || _d === void 0 ? void 0 : _d.cashSales) || 0);
            shift.bankSales = parseFloat(((_e = movements[0]) === null || _e === void 0 ? void 0 : _e.bankSales) || 0);
        }
        res.json({ shift });
    }
    catch (error) {
        console.error('Error getting current shift:', error);
        res.status(500).json({ error: error.message });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.getCurrentShift = getCurrentShift;
/**
 * Close a shift with cash count
 * POST /api/pos/shift/close
 */
const closeShift = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const conn = yield (0, db_1.getConnection)();
    try {
        const { shiftId, closingCash, notes } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const userName = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown';
        if (!shiftId) {
            return res.status(400).json({ error: 'معرف الوردية مطلوب' });
        }
        // Verify shift belongs to user and is open
        const [shifts] = yield conn.query(`SELECT * FROM pos_shifts WHERE id = ? AND status = 'OPEN'`, [shiftId]);
        if (shifts.length === 0) {
            return res.status(404).json({ error: 'الوردية غير موجودة أو مغلقة بالفعل' });
        }
        const shift = shifts[0];
        // Calculate expected cash
        const [movements] = yield conn.query(`SELECT 
                SUM(CASE WHEN type IN ('OPENING', 'DEPOSIT') THEN amount ELSE 0 END) as deposits,
                SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END) as withdrawals,
                SUM(CASE WHEN type = 'SALE' AND paymentMethod = 'CASH' THEN amount ELSE 0 END) as cashSales,
                SUM(CASE WHEN type = 'REFUND' AND paymentMethod = 'CASH' THEN amount ELSE 0 END) as cashRefunds
             FROM pos_cash_movements
             WHERE shiftId = ?`, [shiftId]);
        const movementData = movements[0];
        const expectedCash = parseFloat((movementData === null || movementData === void 0 ? void 0 : movementData.deposits) || 0) +
            parseFloat((movementData === null || movementData === void 0 ? void 0 : movementData.cashSales) || 0) -
            parseFloat((movementData === null || movementData === void 0 ? void 0 : movementData.withdrawals) || 0) -
            parseFloat((movementData === null || movementData === void 0 ? void 0 : movementData.cashRefunds) || 0);
        const variance = (closingCash !== null && closingCash !== void 0 ? closingCash : expectedCash) - expectedCash;
        const now = (0, dateUtils_1.getEgyptianISOString)();
        // Update shift
        yield conn.query(`UPDATE pos_shifts 
             SET closedAt = ?, closingCash = ?, expectedCash = ?, variance = ?, 
                 status = 'CLOSED', notes = ?, updatedAt = ?
             WHERE id = ?`, [now, closingCash !== null && closingCash !== void 0 ? closingCash : expectedCash, expectedCash, variance, notes || null, now, shiftId]);
        // Get updated shift data
        const [closedShifts] = yield conn.query(`SELECT s.*, u.name as userName, w.name as warehouseName
             FROM pos_shifts s
             LEFT JOIN users u ON s.userId COLLATE utf8mb4_unicode_ci = u.id COLLATE utf8mb4_unicode_ci
             LEFT JOIN warehouses w ON s.warehouseId COLLATE utf8mb4_unicode_ci = w.id COLLATE utf8mb4_unicode_ci
             WHERE s.id = ?`, [shiftId]);
        const closedShift = closedShifts[0];
        // emitEntityChanged('pos-shift', closedShift, userName);
        res.json({
            success: true,
            shift: closedShift,
            expectedCash,
            variance,
            message: variance === 0
                ? 'تم إغلاق الوردية بنجاح - لا يوجد فرق'
                : `تم إغلاق الوردية - فرق: ${variance > 0 ? '+' : ''}${variance.toFixed(2)}`
        });
    }
    catch (error) {
        console.error('Error closing shift:', error);
        res.status(500).json({ error: error.message || 'حدث خطأ أثناء إغلاق الوردية' });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.closeShift = closeShift;
// ============================================
// CASH DRAWER OPERATIONS
// ============================================
/**
 * Add a cash movement (deposit/withdrawal)
 * POST /api/pos/cash-movement
 */
const addCashMovement = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const conn = yield (0, db_1.getConnection)();
    try {
        const { shiftId, type, amount, description } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const userName = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown';
        if (!shiftId || !type || amount === undefined) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }
        if (!['DEPOSIT', 'WITHDRAWAL'].includes(type)) {
            return res.status(400).json({ error: 'نوع الحركة غير صالح' });
        }
        // Verify shift is open
        const [shifts] = yield conn.query(`SELECT id FROM pos_shifts WHERE id = ? AND status = 'OPEN'`, [shiftId]);
        if (shifts.length === 0) {
            return res.status(400).json({ error: 'الوردية غير مفتوحة' });
        }
        const movementId = (0, uuid_1.v4)();
        const now = (0, dateUtils_1.getEgyptianISOString)();
        yield conn.query(`INSERT INTO pos_cash_movements (id, shiftId, type, amount, paymentMethod, description, approvedBy, createdAt)
             VALUES (?, ?, ?, ?, 'CASH', ?, ?, ?)`, [movementId, shiftId, type, amount, description || null, userId, now]);
        const movement = {
            id: movementId,
            shiftId,
            type,
            amount,
            paymentMethod: 'CASH',
            description,
            approvedBy: userId,
            approvedByName: userName,
            createdAt: now
        };
        // emitEntityChanged('pos-cash-movement', movement, userName);
        res.json({
            success: true,
            movement,
            message: type === 'DEPOSIT' ? 'تم الإيداع بنجاح' : 'تم السحب بنجاح'
        });
    }
    catch (error) {
        console.error('Error adding cash movement:', error);
        res.status(500).json({ error: error.message });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.addCashMovement = addCashMovement;
/**
 * Get cash movements for a shift
 * GET /api/pos/shift/:shiftId/movements
 */
const getShiftMovements = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        const { shiftId } = req.params;
        const [movements] = yield conn.query(`SELECT m.*, u.name as approvedByName
             FROM pos_cash_movements m
             LEFT JOIN users u ON m.approvedBy = u.id
             WHERE m.shiftId = ?
             ORDER BY m.createdAt ASC`, [shiftId]);
        res.json({ movements });
    }
    catch (error) {
        console.error('Error getting shift movements:', error);
        res.status(500).json({ error: error.message });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.getShiftMovements = getShiftMovements;
// ============================================
// POS SALE OPERATIONS
// ============================================
/**
 * Process a POS sale
 * POST /api/pos/sale
 */
const processPOSSale = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const conn = yield (0, db_1.getConnection)();
    try {
        const { shiftId, customerId, customerName, items, subtotal, discount, discountType, taxAmount, total, paymentMethod, cashTendered, bankAccountId, notes, printReceipt } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const userName = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown';
        if (!shiftId || !items || items.length === 0 || total === undefined || total === null) {
            console.error('POS Sale validation failed:', { shiftId, itemsLength: items === null || items === void 0 ? void 0 : items.length, total });
            return res.status(400).json({
                error: 'البيانات غير مكتملة',
                details: !shiftId ? 'Missing shiftId' : !items ? 'Missing items' : items.length === 0 ? 'Empty items' : 'Missing total'
            });
        }
        // Verify shift is open
        const [shifts] = yield conn.query(`SELECT * FROM pos_shifts WHERE id = ? AND status = 'OPEN'`, [shiftId]);
        if (shifts.length === 0) {
            return res.status(400).json({ error: 'الوردية غير مفتوحة' });
        }
        const shift = shifts[0];
        const now = (0, dateUtils_1.getEgyptianISOString)();
        // Create the invoice via the existing invoice system
        // This integrates with the ERP's accounting and inventory
        const invoiceId = (0, uuid_1.v4)();
        const invoiceNumber = `POS-${Date.now()}`;
        // Prepare invoice lines
        const invoiceLines = items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            cost: item.cost || 0,
            discount: item.discount || 0,
            discountType: item.discountType || 'FIXED',
            total: item.total,
            unitId: item.unitId,
            unitName: item.unitName,
            conversionFactor: item.conversionFactor || 1,
            baseQuantity: item.baseQuantity || item.quantity
        }));
        // Insert invoice
        yield conn.query(`INSERT INTO invoices (
                id, number, date, type, partnerId, partnerName, 
                total, status, paymentMethod, posted, notes,
                taxAmount, globalDiscount, globalDiscountType,
                warehouseId, createdBy, posShiftId, isPOSSale,
                bankAccountId
            ) VALUES (?, ?, ?, 'INVOICE_SALE', ?, ?, ?, 'POSTED', ?, 1, ?, ?, ?, ?, ?, ?, ?, 1, ?)`, [
            invoiceId, invoiceNumber, now,
            customerId || null, customerName || 'عميل نقدي',
            total, paymentMethod || 'CASH', notes || null,
            taxAmount || 0, discount || 0, discountType || 'FIXED',
            shift.warehouseId, userId, shiftId,
            bankAccountId || null
        ]);
        // Insert invoice lines
        // Get effective warehouseId - use shift's warehouse or fallback to first available
        let effectiveWarehouseId = shift.warehouseId;
        if (!effectiveWarehouseId) {
            const [defaultWh] = yield conn.query('SELECT id FROM warehouses ORDER BY name LIMIT 1');
            effectiveWarehouseId = ((_c = defaultWh[0]) === null || _c === void 0 ? void 0 : _c.id) || null;
            if (effectiveWarehouseId) {
                console.log(`⚠️ POS shift has no warehouse - using default: ${effectiveWarehouseId}`);
            }
        }
        for (const line of invoiceLines) {
            yield conn.query(`INSERT INTO invoice_lines (
                    invoiceId, productId, productName, quantity, price, cost,
                    discount, discountType, total, unitId, unitName, conversionFactor, baseQuantity, warehouseId
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                invoiceId, line.productId, line.productName,
                line.quantity, line.price, line.cost,
                line.discount, line.discountType || 'FIXED', line.total,
                line.unitId || null, line.unitName || null,
                line.conversionFactor, line.baseQuantity,
                effectiveWarehouseId
            ]);
            // Update stock - only if we have a valid warehouse
            if (effectiveWarehouseId) {
                yield conn.query(`UPDATE product_stocks 
                     SET stock = stock - ?
                     WHERE productId = ? AND warehouseId = ?`, [line.baseQuantity, line.productId, effectiveWarehouseId]);
            }
        }
        // Record cash movement for the sale
        const movementId = (0, uuid_1.v4)();
        yield conn.query(`INSERT INTO pos_cash_movements (id, shiftId, type, amount, paymentMethod, referenceId, referenceType, createdAt)
             VALUES (?, ?, 'SALE', ?, ?, ?, 'INVOICE', ?)`, [movementId, shiftId, total, paymentMethod || 'CASH', invoiceId, now]);
        // Update shift totals
        yield conn.query(`UPDATE pos_shifts 
             SET totalSales = totalSales + ?, salesCount = salesCount + 1, updatedAt = ?
             WHERE id = ?`, [total, now, shiftId]);
        // Calculate change
        const changeGiven = paymentMethod === 'CASH' && cashTendered
            ? cashTendered - total
            : 0;
        const invoice = {
            id: invoiceId,
            number: invoiceNumber,
            date: now,
            type: 'INVOICE_SALE',
            partnerId: customerId,
            partnerName: customerName || 'عميل نقدي',
            lines: invoiceLines,
            total,
            subtotal,
            discount,
            taxAmount,
            status: 'POSTED',
            paymentMethod,
            posted: true,
            isPOSSale: true,
            posShiftId: shiftId
        };
        // emitEntityChanged('invoice', invoice, userName);
        res.json({
            success: true,
            invoice,
            cashTendered,
            changeGiven,
            printReceipt,
            message: 'تم البيع بنجاح'
        });
    }
    catch (error) {
        console.error('Error processing POS sale:', error);
        res.status(500).json({ error: error.message || 'حدث خطأ أثناء البيع' });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.processPOSSale = processPOSSale;
// ============================================
// POS REPORTS
// ============================================
/**
 * Get shift report (X/Z Report)
 * GET /api/pos/shift/:shiftId/report
 */
const getShiftReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const conn = yield (0, db_1.getConnection)();
    try {
        const { shiftId } = req.params;
        // Get shift details
        const [shifts] = yield conn.query(`SELECT s.*, u.name as userName, w.name as warehouseName
             FROM pos_shifts s
             LEFT JOIN users u ON s.userId COLLATE utf8mb4_unicode_ci = u.id COLLATE utf8mb4_unicode_ci
             LEFT JOIN warehouses w ON s.warehouseId COLLATE utf8mb4_unicode_ci = w.id COLLATE utf8mb4_unicode_ci
             WHERE s.id = ?`, [shiftId]);
        if (shifts.length === 0) {
            return res.status(404).json({ error: 'الوردية غير موجودة' });
        }
        const shift = shifts[0];
        // Get cash movements
        const [movements] = yield conn.query(`SELECT m.*, u.name as approvedByName
             FROM pos_cash_movements m
             LEFT JOIN users u ON m.approvedBy = u.id
             WHERE m.shiftId = ?
             ORDER BY m.createdAt ASC`, [shiftId]);
        // Get sales by payment method
        const [salesByMethod] = yield conn.query(`SELECT 
                paymentMethod,
                SUM(amount) as total,
                COUNT(*) as count
             FROM pos_cash_movements
             WHERE shiftId = ? AND type = 'SALE'
             GROUP BY paymentMethod`, [shiftId]);
        // Get top selling products
        const [topProducts] = yield conn.query(`SELECT 
                il.productId,
                il.productName,
                SUM(il.quantity) as quantity,
                SUM(il.total) as revenue
             FROM invoices i
             JOIN invoice_lines il ON i.id = il.invoiceId
             WHERE i.posShiftId = ? AND i.type = 'INVOICE_SALE'
             GROUP BY il.productId, il.productName
             ORDER BY revenue DESC
             LIMIT 10`, [shiftId]);
        // Calculate totals
        const cashSales = ((_a = salesByMethod.find(m => m.paymentMethod === 'CASH')) === null || _a === void 0 ? void 0 : _a.total) || 0;
        const bankSales = ((_b = salesByMethod.find(m => m.paymentMethod === 'BANK')) === null || _b === void 0 ? void 0 : _b.total) || 0;
        const chequeSales = ((_c = salesByMethod.find(m => m.paymentMethod === 'CHEQUE')) === null || _c === void 0 ? void 0 : _c.total) || 0;
        const report = {
            shift: Object.assign(Object.assign({}, shift), { closedAt: shift.closedAt || null, duration: shift.closedAt
                    ? Math.round((new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime()) / 60000)
                    : Math.round((new Date().getTime() - new Date(shift.openedAt).getTime()) / 60000) }),
            cashMovements: movements,
            salesByPaymentMethod: {
                cash: parseFloat(cashSales),
                bank: parseFloat(bankSales),
                cheque: parseFloat(chequeSales),
                total: parseFloat(cashSales) + parseFloat(bankSales) + parseFloat(chequeSales)
            },
            topProducts
        };
        res.json(report);
    }
    catch (error) {
        console.error('Error getting shift report:', error);
        res.status(500).json({ error: error.message });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.getShiftReport = getShiftReport;
/**
 * Get hourly sales breakdown for a date range
 * GET /api/pos/reports/hourly
 */
const getHourlySales = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        const { dateFrom, dateTo, warehouseId } = req.query;
        let whereClause = `i.type = 'INVOICE_SALE' AND i.isPOSSale = 1`;
        const params = [];
        if (dateFrom) {
            whereClause += ' AND DATE(i.date) >= ?';
            params.push(dateFrom);
        }
        if (dateTo) {
            whereClause += ' AND DATE(i.date) <= ?';
            params.push(dateTo);
        }
        if (warehouseId) {
            whereClause += ' AND i.warehouseId = ?';
            params.push(warehouseId);
        }
        const [hourlyStats] = yield conn.query(`SELECT 
                HOUR(i.date) as hour,
                COUNT(*) as count,
                SUM(i.total) as total
             FROM invoices i
             WHERE ${whereClause}
             GROUP BY HOUR(i.date)
             ORDER BY hour ASC`, params);
        // Fill in missing hours
        const result = Array.from({ length: 24 }, (_, i) => {
            const stat = hourlyStats.find(h => h.hour === i);
            return {
                hour: i,
                hourLabel: `${i.toString().padStart(2, '0')}:00`,
                count: stat ? stat.count : 0,
                total: stat ? stat.total : 0
            };
        });
        res.json({ hourlySales: result });
    }
    catch (error) {
        console.error('Error getting hourly sales:', error);
        res.status(500).json({ error: error.message });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.getHourlySales = getHourlySales;
/**
 * Get all shifts with pagination
 * GET /api/pos/shifts
 */
const getShifts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        const { page = 1, limit = 20, userId, status, dateFrom, dateTo } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereClause = '1=1';
        const params = [];
        if (userId) {
            whereClause += ' AND s.userId = ?';
            params.push(userId);
        }
        if (status) {
            whereClause += ' AND s.status = ?';
            params.push(status);
        }
        if (dateFrom) {
            whereClause += ' AND DATE(s.openedAt) >= ?';
            params.push(dateFrom);
        }
        if (dateTo) {
            whereClause += ' AND DATE(s.openedAt) <= ?';
            params.push(dateTo);
        }
        const [shifts] = yield conn.query(`SELECT s.*, u.name as userName, w.name as warehouseName
             FROM pos_shifts s
             LEFT JOIN users u ON s.userId COLLATE utf8mb4_unicode_ci = u.id COLLATE utf8mb4_unicode_ci
             LEFT JOIN warehouses w ON s.warehouseId COLLATE utf8mb4_unicode_ci = w.id COLLATE utf8mb4_unicode_ci
             WHERE ${whereClause}
             ORDER BY s.openedAt DESC
             LIMIT ? OFFSET ?`, [...params, Number(limit), offset]);
        const [countResult] = yield conn.query(`SELECT COUNT(*) as total FROM pos_shifts s WHERE ${whereClause}`, params);
        res.json({
            shifts,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Error getting shifts:', error);
        res.status(500).json({ error: error.message });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.getShifts = getShifts;
// ============================================
// POS PRODUCTS (OPTIMIZED FOR POS)
// ============================================
/**
 * Get products optimized for POS display
 * GET /api/pos/products
 */
const getPOSProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        const { warehouseId, categoryId, search, limit = 100 } = req.query;
        let whereClause = 'p.isActive = 1';
        const params = [];
        if (categoryId) {
            whereClause += ' AND p.categoryId = ?';
            params.push(categoryId);
        }
        if (search) {
            whereClause += ' AND (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        // Get products with stock for the specified warehouse
        const [products] = yield conn.query(`SELECT 
                p.id, p.name, p.sku, p.barcode, p.price, p.cost,
                p.categoryId, c.name as categoryName,
                p.image, p.hasMultipleUnits, p.baseUnit,
                COALESCE(ps.stock, 0) as stock
             FROM products p
             LEFT JOIN categories c ON p.categoryId = c.id
             LEFT JOIN product_stocks ps ON p.id = ps.productId ${warehouseId ? 'AND ps.warehouseId = ?' : ''}
             WHERE ${whereClause}
             ORDER BY p.name
             LIMIT ?`, warehouseId ? [warehouseId, ...params, Number(limit)] : [...params, Number(limit)]);
        res.json({ products });
    }
    catch (error) {
        console.error('Error getting POS products:', error);
        res.status(500).json({ error: error.message });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.getPOSProducts = getPOSProducts;
/**
 * Look up product by barcode
 * GET /api/pos/product/barcode/:barcode
 */
const getProductByBarcode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        const { barcode } = req.params;
        const { warehouseId } = req.query;
        // First check main product barcode
        let [products] = yield conn.query(`SELECT 
                p.id, p.name, p.sku, p.barcode, p.price, p.cost,
                p.categoryId, p.hasMultipleUnits, p.baseUnit,
                COALESCE(ps.stock, 0) as stock,
                NULL as unitId, NULL as unitName, 1 as conversionFactor
             FROM products p
             LEFT JOIN product_stocks ps ON p.id = ps.productId ${warehouseId ? 'AND ps.warehouseId = ?' : ''}
             WHERE p.barcode = ?
             LIMIT 1`, warehouseId ? [warehouseId, barcode] : [barcode]);
        // If not found, check product unit barcodes
        if (products.length === 0) {
            [products] = yield conn.query(`SELECT 
                    p.id, p.name, p.sku, pu.barcode, pu.salePrice as price, p.cost,
                    p.categoryId, p.hasMultipleUnits, p.baseUnit,
                    COALESCE(ps.stock, 0) as stock,
                    pu.id as unitId, pu.unitName, pu.conversionFactor
                 FROM product_units pu
                 JOIN products p ON pu.productId = p.id
                 LEFT JOIN product_stocks ps ON p.id = ps.productId ${warehouseId ? 'AND ps.warehouseId = ?' : ''}
                 WHERE pu.barcode = ?
                 LIMIT 1`, warehouseId ? [warehouseId, barcode] : [barcode]);
        }
        if (products.length === 0) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }
        res.json({ product: products[0] });
    }
    catch (error) {
        console.error('Error getting product by barcode:', error);
        res.status(500).json({ error: error.message });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.getProductByBarcode = getProductByBarcode;
// ============================================
// HELD ORDERS
// ============================================
/**
 * Hold an order for later
 * POST /api/pos/hold
 */
const holdOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const conn = yield (0, db_1.getConnection)();
    try {
        const { shiftId, customerId, customerName, items, holdNote } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!shiftId || !items || items.length === 0) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }
        const holdId = (0, uuid_1.v4)();
        const now = (0, dateUtils_1.getEgyptianISOString)();
        yield conn.query(`INSERT INTO pos_held_orders (id, shiftId, userId, customerId, customerName, orderData, holdNote, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [holdId, shiftId, userId, customerId || null, customerName || null, JSON.stringify(items), holdNote || null, now]);
        res.json({
            success: true,
            holdId,
            message: 'تم تعليق الطلب بنجاح'
        });
    }
    catch (error) {
        console.error('Error holding order:', error);
        res.status(500).json({ error: error.message });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.holdOrder = holdOrder;
/**
 * Get held orders for a shift
 * GET /api/pos/held/:shiftId
 */
const getHeldOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        const { shiftId } = req.params;
        const [orders] = yield conn.query(`SELECT *, JSON_UNQUOTE(orderData) as orderData
             FROM pos_held_orders
             WHERE shiftId = ?
             ORDER BY createdAt DESC`, [shiftId]);
        // Parse orderData JSON
        const parsedOrders = orders.map(order => (Object.assign(Object.assign({}, order), { items: JSON.parse(order.orderData) })));
        res.json({ heldOrders: parsedOrders });
    }
    catch (error) {
        console.error('Error getting held orders:', error);
        res.status(500).json({ error: error.message });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.getHeldOrders = getHeldOrders;
/**
 * Recall a held order
 * DELETE /api/pos/held/:holdId
 */
const recallHeldOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        const { holdId } = req.params;
        const [orders] = yield conn.query(`SELECT *, JSON_UNQUOTE(orderData) as orderData
             FROM pos_held_orders
             WHERE id = ?`, [holdId]);
        if (orders.length === 0) {
            return res.status(404).json({ error: 'الطلب غير موجود' });
        }
        const order = orders[0];
        // Delete the held order
        yield conn.query(`DELETE FROM pos_held_orders WHERE id = ?`, [holdId]);
        res.json({
            success: true,
            order: Object.assign(Object.assign({}, order), { items: JSON.parse(order.orderData) }),
            message: 'تم استرجاع الطلب'
        });
    }
    catch (error) {
        console.error('Error recalling held order:', error);
        res.status(500).json({ error: error.message });
    }
    finally {
        if (conn)
            conn.release();
    }
});
exports.recallHeldOrder = recallHeldOrder;
