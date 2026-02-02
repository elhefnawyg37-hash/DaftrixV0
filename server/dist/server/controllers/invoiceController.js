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
exports.updateInvoice = exports.getCustomerLastProductPrice = exports.createInvoice = exports.getInvoiceById = exports.getInvoices = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const auditController_1 = require("./auditController");
const dataFiltering_1 = require("../utils/dataFiltering");
const errorHandler_1 = require("../utils/errorHandler");
const accountBalanceUtils_1 = require("../utils/accountBalanceUtils");
const getInvoices = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const authReq = req;
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        // Performance flag: minimal mode skips fetching lines/cheques (for list views)
        const minimal = req.query.minimal === 'true';
        // Filter parameters
        const type = req.query.type;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const partnerId = req.query.partnerId;
        const search = req.query.search;
        // Build WHERE clause
        const conditions = [];
        const params = [];
        // Apply salesman data isolation filter
        if (authReq.userFilterOptions && authReq.systemConfig) {
            const salesmanFilter = (0, dataFiltering_1.buildSalesmanFilterClause)({
                userRole: authReq.userFilterOptions.userRole,
                salesmanId: authReq.userFilterOptions.salesmanId,
                systemConfig: authReq.systemConfig
            }, 'invoices', '');
            if (salesmanFilter.clause) {
                conditions.push(salesmanFilter.clause);
                params.push(...salesmanFilter.params);
            }
        }
        if (type) {
            conditions.push('type = ?');
            params.push(type);
        }
        if (startDate) {
            conditions.push('date >= ?');
            params.push(startDate);
        }
        if (endDate) {
            conditions.push('date <= ?');
            params.push(endDate);
        }
        if (partnerId) {
            conditions.push('partnerId = ?');
            params.push(partnerId);
        }
        if (search) {
            conditions.push('(partnerName LIKE ? OR id LIKE ? OR notes LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        const whereClause = conditions.length > 0
            ? 'WHERE ' + conditions.join(' AND ')
            : '';
        // Get total count for pagination
        const [countResult] = yield conn.query(`SELECT COUNT(*) as total FROM invoices ${whereClause}`, params);
        const total = countResult[0].total;
        // Get paginated invoices (select only needed columns for list view)
        const selectColumns = minimal
            ? 'id, number, date, type, partnerId, partnerName, total, status, paymentMethod, notes, salesmanId, createdBy, warehouseId'
            : '*';
        const [invoices] = yield conn.query(`SELECT ${selectColumns} FROM invoices ${whereClause} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        // Only fetch lines and cheques if NOT in minimal mode (for edit/detail views)
        if (!minimal && invoices.length > 0) {
            const invoiceIds = invoices.map(inv => inv.id);
            // 1. Fetch all lines
            const [allLines] = yield conn.query(`SELECT * FROM invoice_lines WHERE invoiceId IN (?)`, [invoiceIds]);
            // 2. Fetch all cheques
            const [allCheques] = yield conn.query(`SELECT * FROM cheques WHERE transactionId IN (?)`, [invoiceIds]);
            // 3. Build Maps for O(1) lookups (js-set-map-lookups best practice)
            const linesByInvoiceId = new Map();
            for (const line of allLines) {
                if (!linesByInvoiceId.has(line.invoiceId)) {
                    linesByInvoiceId.set(line.invoiceId, []);
                }
                linesByInvoiceId.get(line.invoiceId).push(line);
            }
            const chequesByTransactionId = new Map();
            for (const cheque of allCheques) {
                if (!chequesByTransactionId.has(cheque.transactionId)) {
                    chequesByTransactionId.set(cheque.transactionId, []);
                }
                chequesByTransactionId.get(cheque.transactionId).push(cheque);
            }
            // 4. Map back to invoices using O(1) Map lookups
            for (const inv of invoices) {
                inv.lines = linesByInvoiceId.get(inv.id) || [];
                // Parse paymentBreakdown JSON if it exists
                if (inv.paymentBreakdown) {
                    try {
                        inv.paymentBreakdown = JSON.parse(inv.paymentBreakdown);
                    }
                    catch (e) {
                        inv.paymentBreakdown = undefined;
                    }
                }
                // Parse bankTransfers JSON if it exists
                if (inv.bankTransfers) {
                    try {
                        inv.bankTransfers = JSON.parse(inv.bankTransfers);
                    }
                    catch (e) {
                        inv.bankTransfers = [];
                    }
                }
                const invCheques = chequesByTransactionId.get(inv.id) || [];
                inv.transactionCheques = invCheques.map((c) => (Object.assign(Object.assign({}, c), { dueDate: c.dueDate ? new Date(c.dueDate).toISOString().split('T')[0] : '', createdDate: c.createdDate ? new Date(c.createdDate).toISOString().split('T')[0] : '' })));
            }
        }
        else if (minimal) {
            // For minimal mode, initialize empty lines array
            for (const inv of invoices) {
                inv.lines = [];
            }
        }
        // Parse JSON fields for all invoices
        for (const inv of invoices) {
            if (inv.relatedInvoiceIds) {
                try {
                    inv.relatedInvoiceIds = JSON.parse(inv.relatedInvoiceIds);
                }
                catch (e) {
                    inv.relatedInvoiceIds = [];
                }
            }
            else {
                inv.relatedInvoiceIds = [];
            }
        }
        conn.release();
        // Return paginated response
        res.json({
            invoices,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'invoices');
    }
});
exports.getInvoices = getInvoices;
// GET /api/invoices/:id - Get single invoice with lines
const getInvoiceById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        console.log('🔍 [getInvoiceById] Fetching invoice:', id);
        const conn = yield (0, db_1.getConnection)();
        // Get invoice header
        const [invoices] = yield conn.query('SELECT * FROM invoices WHERE id = ?', [id]);
        if (invoices.length === 0) {
            console.log('❌ [getInvoiceById] Invoice not found in database:', id);
            conn.release();
            return res.status(404).json({ message: 'Invoice not found' });
        }
        const invoice = invoices[0];
        console.log('✅ [getInvoiceById] Found invoice:', invoice.number, 'Type:', invoice.type);
        // Get invoice lines
        const [lines] = yield conn.query('SELECT * FROM invoice_lines WHERE invoiceId = ?', [id]);
        console.log(`📦 [getInvoiceById] Found ${lines.length} lines for invoice ${invoice.number}`);
        if (lines.length === 0) {
            console.warn('⚠️ [getInvoiceById] Invoice exists but has NO lines! This may indicate a sync issue.');
        }
        // FILE DEBUG: Log what warehouseIds come back from DB
        const fs = require('fs');
        const debugLog = `[${new Date().toISOString()}] getInvoiceById lines from DB: ${JSON.stringify(lines.map(l => ({ productName: l.productName, warehouseId: l.warehouseId })))}\n`;
        fs.appendFileSync('warehouse_debug.log', debugLog);
        invoice.lines = lines;
        // Parse JSON fields
        if (invoice.relatedInvoiceIds) {
            try {
                invoice.relatedInvoiceIds = JSON.parse(invoice.relatedInvoiceIds);
            }
            catch (e) {
                invoice.relatedInvoiceIds = [];
            }
        }
        else {
            invoice.relatedInvoiceIds = [];
        }
        // Load payment collected - FIRST check invoice's own paidAmount field
        console.log(`💰 [getInvoiceById] Invoice paidAmount from DB: ${invoice.paidAmount}`);
        // Use the invoice's paidAmount if it exists (direct field)
        if (invoice.paidAmount && Number(invoice.paidAmount) > 0) {
            invoice.paymentCollected = Number(invoice.paidAmount);
            console.log(`✅ Loaded paidAmount directly from invoice: ${invoice.paymentCollected}`);
        }
        else {
            // Fallback: Search for linked payment/receipt invoices (legacy method)
            try {
                console.log(`🔍 [getInvoiceById] Searching for linked payment invoice: ${id} (number: ${invoice.number})`);
                // Method 1: Search by relatedInvoiceIds containing this invoice ID
                const [linkedPayments] = yield conn.query(`SELECT total FROM invoices 
                     WHERE JSON_CONTAINS(relatedInvoiceIds, ?) 
                     AND (type = 'RECEIPT' OR type = 'PAYMENT')
                     AND notes LIKE ?`, [JSON.stringify(id), '%دفعة مع الفاتورة%']);
                if (linkedPayments.length > 0) {
                    invoice.paymentCollected = Number(linkedPayments[0].total);
                    console.log(`💰 Found linked payment invoice by ID: ${invoice.paymentCollected}`);
                }
                else {
                    // Method 2: Search by invoice number in notes (fallback for legacy data)
                    const [paymentsByNumber] = yield conn.query(`SELECT total FROM invoices 
                         WHERE (type = 'RECEIPT' OR type = 'PAYMENT')
                         AND (notes LIKE ? OR notes LIKE ?)`, [`%دفعة مع الفاتورة ${invoice.number}%`, `%دفعة مع الفاتورة ${id}%`]);
                    if (paymentsByNumber.length > 0) {
                        invoice.paymentCollected = Number(paymentsByNumber[0].total);
                        console.log(`💰 Found linked payment invoice by number: ${invoice.paymentCollected}`);
                    }
                    else {
                        invoice.paymentCollected = 0;
                        console.log(`ℹ️ No payment found for invoice ${id}`);
                    }
                }
            }
            catch (e) {
                console.error('Error loading linked payments:', e);
                invoice.paymentCollected = 0;
            }
        }
        // Parse paymentBreakdown JSON if it exists
        if (invoice.paymentBreakdown) {
            try {
                invoice.paymentBreakdown = JSON.parse(invoice.paymentBreakdown);
            }
            catch (e) {
                invoice.paymentBreakdown = undefined;
            }
        }
        // Parse bankTransfers JSON if it exists
        if (invoice.bankTransfers) {
            try {
                invoice.bankTransfers = JSON.parse(invoice.bankTransfers);
                console.log(`🏦 Loaded ${invoice.bankTransfers.length} bank transfers for invoice ${id}`);
            }
            catch (e) {
                invoice.bankTransfers = [];
            }
        }
        // Lookup warehouse name if warehouseId exists (for mobile display)
        if (invoice.warehouseId) {
            try {
                const [warehouses] = yield conn.query('SELECT name FROM warehouses WHERE id = ? LIMIT 1', [invoice.warehouseId]);
                if (warehouses.length > 0) {
                    invoice.warehouseName = warehouses[0].name;
                    console.log(`🏬 Loaded warehouse name: ${invoice.warehouseName}`);
                }
            }
            catch (e) {
                console.warn('Could not load warehouse name:', e);
            }
        }
        conn.release();
        res.json(invoice);
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getInvoiceById');
    }
});
exports.getInvoiceById = getInvoiceById;
const createInvoice = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const conn = yield (0, db_1.getConnection)();
    try {
        console.log('🚀 [createInvoice] Called with body:', { id: req.body.id, type: req.body.type, paymentCollected: req.body.paymentCollected });
        console.log('🏦 [createInvoice] bankTransfers received:', req.body.bankTransfers);
        const id = req.body.id || (0, uuid_1.v4)();
        // === CHECK IF INVOICE EXISTS (UPDATE vs CREATE) ===
        if (req.body.id) {
            const [existing] = yield conn.query('SELECT id FROM invoices WHERE id = ?', [req.body.id]);
            if (existing.length > 0) {
                // Invoice exists - delegate to updateInvoice
                console.log(`📝 Invoice ${req.body.id} exists - updating instead of creating`);
                conn.release();
                req.params = { id: req.body.id };
                return (0, exports.updateInvoice)(req, res);
            }
        }
        // === INVOICE DOES NOT EXIST - PROCEED WITH CREATE ===
        yield conn.beginTransaction();
        const { date, type, partnerId, partnerName, total, status, paymentMethod, posted, notes, dueDate, taxAmount, whtAmount, shippingFee, globalDiscount, lines, salesmanId, salesmanName } = req.body;
        // === SERVER-SIDE TOTAL VALIDATION ===
        // Skip validation for RECEIPT/PAYMENT which don't have line items
        if (lines && lines.length > 0 && !['RECEIPT', 'PAYMENT'].includes(type)) {
            const validation = (0, errorHandler_1.validateInvoiceTotal)(lines, total, taxAmount || 0, globalDiscount || 0, whtAmount || 0, shippingFee || 0);
            if (!validation.valid) {
                conn.release();
                return res.status(400).json({
                    code: 'TOTAL_MISMATCH',
                    message: validation.message,
                    calculated: validation.calculated,
                    provided: total
                });
            }
            console.log(`✅ Invoice total validated: ${validation.calculated}`);
        }
        // === SERVER-SIDE INVOICE NUMBER GENERATION ===
        // Query the database for the highest existing number for this type
        let invoiceNumber = req.body.number;
        if (!invoiceNumber) {
            const prefixMap = {
                'INVOICE_SALE': 'INV-',
                'INVOICE_PURCHASE': 'PUR-',
                'RETURN_SALE': 'RET-S-',
                'RETURN_PURCHASE': 'RET-P-',
                'RECEIPT': 'REC-',
                'PAYMENT': 'PAY-',
                'QUOTATION': 'QUO-',
            };
            const prefix = prefixMap[type] || 'TRX-';
            // Fixed regex: We want a literal hyphen, so we need \\- in the string to get \- in regex
            // Fetch ALL matching numbers to find the true max and avoid SQL processing limitations
            const [rows] = yield conn.query(`SELECT number FROM invoices WHERE number LIKE ?`, [`${prefix}%`]);
            let maxNum = 0;
            const existingNumbers = new Set();
            rows.forEach((row) => {
                existingNumbers.add(row.number);
                if (row.number.startsWith(prefix)) {
                    const suffix = row.number.substring(prefix.length);
                    // Standard format: PUR-00001
                    if (/^\d+$/.test(suffix)) {
                        const num = parseInt(suffix, 10);
                        if (num > maxNum)
                            maxNum = num;
                    }
                    // Timestamp fallback format: PUR-00001-mk4...
                    else if (suffix.includes('-')) {
                        const parts = suffix.split('-');
                        if (/^\d+$/.test(parts[0])) {
                            const num = parseInt(parts[0], 10);
                            if (num > maxNum)
                                maxNum = num;
                        }
                    }
                }
            });
            let nextNum = maxNum + 1;
            let isUnique = false;
            let attempts = 0;
            // Loop to find next available number
            while (!isUnique && attempts < 100) {
                invoiceNumber = `${prefix}${String(nextNum).padStart(5, '0')}`;
                if (!existingNumbers.has(invoiceNumber)) {
                    // Double check DB for race conditions
                    const [existing] = yield conn.query('SELECT id FROM invoices WHERE number = ?', [invoiceNumber]);
                    if (existing.length === 0) {
                        isUnique = true;
                    }
                    else {
                        existingNumbers.add(invoiceNumber);
                        nextNum++;
                    }
                }
                else {
                    nextNum++;
                }
                attempts++;
            }
            // Absolute partial fallback if loop fails (should never happen with JS calculation)
            if (!isUnique) {
                console.error('Failed to generate unique invoice number after 100 attempts');
                invoiceNumber = `${prefix}${String(nextNum).padStart(5, '0')}-${Date.now().toString(36)}`;
            }
        }
        // Get createdBy from request user or body
        const authReq = req;
        const createdBy = ((_a = authReq.user) === null || _a === void 0 ? void 0 : _a.name) || ((_b = authReq.user) === null || _b === void 0 ? void 0 : _b.username) || req.body.createdBy || req.body.user || null;
        // Sanitize dates - convert empty strings to null
        const sanitizedDueDate = dueDate && dueDate !== '' ? dueDate : null;
        yield conn.query(`INSERT INTO invoices (id, number, date, type, partnerId, partnerName, total, status, paymentMethod, posted, notes, dueDate, taxAmount, whtAmount, shippingFee, globalDiscount, warehouseId, bankAccountId, bankName, paymentBreakdown, bankTransfers, salesmanId, createdBy, paidAmount) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, invoiceNumber, date, type, partnerId, partnerName, total, status, paymentMethod, posted, notes, sanitizedDueDate, taxAmount, whtAmount, shippingFee, globalDiscount, req.body.warehouseId, req.body.bankAccountId, req.body.bankName, req.body.paymentBreakdown ? JSON.stringify(req.body.paymentBreakdown) : null, req.body.bankTransfers ? JSON.stringify(req.body.bankTransfers) : null, salesmanId || null, createdBy, req.body.paidAmount || req.body.paymentCollected || null]);
        if (lines && lines.length > 0) {
            console.log('[createInvoice] Saving lines with warehouseIds:', lines.map((l) => ({ productName: l.productName, warehouseId: l.warehouseId })));
            // FILE DEBUG: Write to file since console might not show in launcher
            const fs = require('fs');
            const debugLog = `[${new Date().toISOString()}] createInvoice lines: ${JSON.stringify(lines.map((l) => ({ productName: l.productName, warehouseId: l.warehouseId })))}\n`;
            fs.appendFileSync('warehouse_debug.log', debugLog);
            for (const line of lines) {
                // Ensure strict 5-decimal precision
                const qty = Number(Number(line.quantity).toFixed(5));
                const price = Number(Number(line.price || 0).toFixed(2));
                const cost = Number(Number(line.cost || 0).toFixed(2));
                const total = Number(Number(line.total || 0).toFixed(2));
                const sqlValues = [id, line.productId, line.productName, qty, price, cost, line.discount, total, line.warehouseId || null];
                // FILE DEBUG: Log exact SQL values
                const fs2 = require('fs');
                const sqlDebug = `[${new Date().toISOString()}] createInvoice SQL values: ${JSON.stringify(sqlValues)}\n`;
                fs2.appendFileSync('warehouse_debug.log', sqlDebug);
                yield conn.query(`INSERT INTO invoice_lines (invoiceId, productId, productName, quantity, price, cost, discount, total, warehouseId)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, sqlValues);
            }
        }
        // === UPDATE STOCK FOR PURCHASE/RETURN INVOICES ===
        // INVOICE_PURCHASE: Stock IN (+)
        // RETURN_SALE: Stock IN (+)
        // INVOICE_SALE: Stock OUT (-) - Only for non-Van Sales (Van Sales handled separately)
        // RETURN_PURCHASE: Stock OUT (-)
        const stockChangeTypes = {
            'INVOICE_PURCHASE': 1, // +stock (شراء)
            'RETURN_SALE': 1, // +stock (مرتجع مبيعات)
            'INVOICE_SALE': -1, // -stock (بيع) - Skip if Van Sale
            'RETURN_PURCHASE': -1 // -stock (مرتجع مشتريات)
        };
        // Check if this is a Van Sale (handled separately in vehicleController)
        const isVanSale = req.body.isVanSale || (notes && notes.includes('بيع متنقل'));
        if (stockChangeTypes[type] !== undefined && lines && lines.length > 0) {
            // Skip stock update for Van Sales (already handled by vehicleController)
            if (type === 'INVOICE_SALE' && isVanSale) {
                console.log(`⏭️ Skipping stock update for Van Sale invoice ${invoiceNumber}`);
            }
            else {
                for (const line of lines) {
                    // Ensure precision here too
                    const qty = Number(Number(line.quantity).toFixed(5));
                    const qtyChange = Number((qty * stockChangeTypes[type]).toFixed(5));
                    const warehouseIdToUse = line.warehouseId || req.body.warehouseId;
                    // 1. Update global product stock
                    yield conn.query('UPDATE products SET stock = ROUND(stock + ?, 5) WHERE id = ?', [qtyChange, line.productId]);
                    // 2. Update warehouse-level stock (product_stocks)
                    if (warehouseIdToUse) {
                        yield conn.query(`
                            INSERT INTO product_stocks (id, productId, warehouseId, stock)
                            VALUES (UUID(), ?, ?, ?)
                            ON DUPLICATE KEY UPDATE stock = ROUND(stock + ?, 5)
                        `, [line.productId, warehouseIdToUse, qtyChange, qtyChange]);
                        console.log(`📦 Stock updated: ${line.productName} ${qtyChange > 0 ? '+' : ''}${qtyChange} in warehouse ${warehouseIdToUse}`);
                    }
                    else {
                        console.log(`📦 Stock updated (global only): ${line.productName} ${qtyChange > 0 ? '+' : ''}${qtyChange}`);
                    }
                    // 3. Record Stock Movement (Ledger)
                    // CRITICAL FIX: Ensure movement is recorded so recalculation scripts work correctly
                    let movementType = 'ADJUSTMENT';
                    if (type === 'INVOICE_PURCHASE')
                        movementType = 'PURCHASE';
                    else if (type === 'INVOICE_SALE')
                        movementType = 'SALE';
                    else if (type === 'RETURN_SALE')
                        movementType = 'RETURN_SALE';
                    else if (type === 'RETURN_PURCHASE')
                        movementType = 'RETURN_PURCHASE';
                    yield conn.query(`
                        INSERT INTO stock_movements (
                            id, product_id, warehouse_id, qty_change, movement_type, 
                            reference_type, reference_id, notes, movement_date
                        ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        line.productId,
                        warehouseIdToUse || null,
                        qtyChange,
                        movementType,
                        type,
                        id,
                        `Invoice #${invoiceNumber} - ${partnerName}`,
                        date
                    ]);
                }
            }
        }
        // Get user for audit logging
        const user = req.body.user || 'System';
        // === PAYMENT WITH INVOICE (دفعة مع الفاتورة) ===
        // If paymentCollected is provided, create a payment/receipt transaction(WITHOUT TRY-CATCH for atomicity check)
        // BUG FIX: Prevent recursive payment creation for RECEIPT/PAYMENT types
        const supportsPaymentWithInvoice = [
            'INVOICE_SALE',
            'INVOICE_PURCHASE',
            'RETURN_SALE',
            'RETURN_PURCHASE'
        ].includes(type);
        const paymentCollected = supportsPaymentWithInvoice ? Number(req.body.paymentCollected || 0) : 0;
        console.log(`🔥 DEBUG createInvoice: paymentCollected=${paymentCollected}, partnerId=${partnerId}, partialPaymentMethod=${req.body.partialPaymentMethod}`);
        if (paymentCollected > 0 && partnerId) {
            console.log(`💰 Creating payment transaction for invoice ${invoiceNumber}: ${paymentCollected}`);
            // Determine payment type based on invoice type
            const paymentType = (type === 'INVOICE_SALE' || type === 'RETURN_PURCHASE')
                ? 'RECEIPT' // مقبوض
                : 'PAYMENT'; // دفع
            // Generate payment number
            const paymentPrefix = paymentType === 'RECEIPT' ? 'REC-' : 'PAY-';
            // Fixed regex: We want a literal hyphen, so we need \\- in the string to get \- in regex
            // Robust Payment Number Generation
            const [pRows] = yield conn.query(`SELECT number FROM invoices WHERE number LIKE ?`, [`${paymentPrefix}%`]);
            let maxPaymentNum = 0;
            const existingPaymentNumbers = new Set();
            pRows.forEach((row) => {
                existingPaymentNumbers.add(row.number);
                if (row.number.startsWith(paymentPrefix)) {
                    const suffix = row.number.substring(paymentPrefix.length);
                    if (/^\d+$/.test(suffix)) {
                        const num = parseInt(suffix, 10);
                        if (num > maxPaymentNum)
                            maxPaymentNum = num;
                    }
                    else if (suffix.includes('-')) {
                        const parts = suffix.split('-');
                        if (/^\d+$/.test(parts[0])) {
                            const num = parseInt(parts[0], 10);
                            if (num > maxPaymentNum)
                                maxPaymentNum = num;
                        }
                    }
                }
            });
            let nextPaymentNum = maxPaymentNum + 1;
            let isPaymentUnique = false;
            let pAttempts = 0;
            let paymentNumber = '';
            while (!isPaymentUnique && pAttempts < 100) {
                paymentNumber = `${paymentPrefix}${String(nextPaymentNum).padStart(5, '0')}`;
                if (!existingPaymentNumbers.has(paymentNumber)) {
                    const [pExisting] = yield conn.query('SELECT id FROM invoices WHERE number = ?', [paymentNumber]);
                    if (pExisting.length === 0) {
                        isPaymentUnique = true;
                    }
                    else {
                        existingPaymentNumbers.add(paymentNumber);
                        nextPaymentNum++;
                    }
                }
                else {
                    nextPaymentNum++;
                }
                pAttempts++;
            }
            if (!isPaymentUnique) {
                paymentNumber = `${paymentPrefix}${String(nextPaymentNum).padStart(5, '0')}-${Date.now().toString(36)}`;
            }
            const paymentId = (0, uuid_1.v4)();
            // Create payment/receipt record with sourceInvoiceId for cascade delete
            yield conn.query(`INSERT INTO invoices (
                    id, number, date, type, partnerId, partnerName, 
                    total, status, paymentMethod, posted, notes, 
                    warehouseId, createdBy, sourceInvoiceId, relatedInvoiceIds
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                paymentId,
                paymentNumber,
                date,
                paymentType,
                partnerId,
                partnerName,
                paymentCollected,
                'POSTED',
                paymentMethod || 'CASH',
                1, // posted = true
                `دفعة مع الفاتورة ${invoiceNumber}`,
                req.body.warehouseId || null,
                createdBy,
                id, // sourceInvoiceId - links to parent invoice for cascade delete
                JSON.stringify([id]) // relatedInvoiceIds - legacy support
            ]);
            // Create account transaction for the payment
            yield conn.query(`INSERT INTO account_transactions (
                    id, date, type, partnerId, partnerName, 
                    debit, credit, description, invoiceId, createdBy
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                (0, uuid_1.v4)(),
                date,
                paymentType,
                partnerId,
                partnerName,
                paymentType === 'PAYMENT' ? paymentCollected : 0, // Debit for payments (we paid)
                paymentType === 'RECEIPT' ? paymentCollected : 0, // Credit for receipts (we received)
                `${paymentType === 'RECEIPT' ? 'مقبوض' : 'دفع'} مع الفاتورة ${invoiceNumber}`,
                paymentId,
                createdBy
            ]);
            // === CREATE JOURNAL ENTRY FOR TREASURY JOURNAL ===
            // This ensures the payment appears in يومية الخزينة (Treasury Journal)
            // IMPORTANT: Only create separate payment journal for CREDIT invoices with partial payment
            // For CASH/BANK invoices, the main invoice journal already debits Cash/Bank, so no separate entry needed
            const mainPaymentMethod = req.body.paymentMethod || 'CASH';
            const shouldCreatePaymentJournal = paymentCollected > 0 && mainPaymentMethod === 'CREDIT';
            if (shouldCreatePaymentJournal) {
                const journalId = (0, uuid_1.v4)();
                // Determine which account to use based on partialPaymentMethod (new field) or default to CASH
                const partialPaymentMethod = req.body.partialPaymentMethod || 'CASH';
                let paymentAccountCode = '101%'; // Default: Cash
                let paymentAccountName = 'الصندوق';
                if (partialPaymentMethod === 'BANK') {
                    // Use specific bank account if provided, otherwise default bank
                    if (req.body.partialPaymentBankId) {
                        const [bankAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE id = ? LIMIT 1`, [req.body.partialPaymentBankId]);
                        if (bankAccounts[0]) {
                            const bankAcc = bankAccounts[0];
                            paymentAccountCode = bankAcc.id; // Use ID directly
                            paymentAccountName = bankAcc.name;
                        }
                    }
                    else {
                        paymentAccountCode = '102%'; // Default bank
                        paymentAccountName = 'البنك';
                    }
                }
                else if (partialPaymentMethod === 'CHEQUE') {
                    paymentAccountCode = paymentType === 'RECEIPT' ? '106%' : '203%'; // Notes Receivable / Notes Payable
                    paymentAccountName = paymentType === 'RECEIPT' ? 'أوراق قبض' : 'أوراق دفع';
                }
                // Get the payment account
                let paymentAccount;
                if (partialPaymentMethod === 'BANK' && req.body.partialPaymentBankId) {
                    // Already fetched above
                    paymentAccount = { id: req.body.partialPaymentBankId, name: paymentAccountName };
                }
                else {
                    let [paymentAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE code LIKE ? LIMIT 1`, [paymentAccountCode]);
                    // Fallback: Try finding by name (Cash/Bank)
                    if (paymentAccounts.length === 0) {
                        const searchName = partialPaymentMethod === 'CASH' ? '%خزينة%' : '%بنك%';
                        console.log(`⚠️ Account ${paymentAccountCode} not found, trying name: ${searchName}`);
                        [paymentAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE name LIKE ? LIMIT 1`, [searchName]);
                    }
                    paymentAccount = paymentAccounts[0];
                }
                // Get partner account (Receivables for RECEIPT, Payables for PAYMENT)
                // Account codes: 104 = AR (العملاء), 201 = AP (الموردين)
                const partnerAccountCode = paymentType === 'RECEIPT' ? '104%' : '201%';
                let [partnerAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE code LIKE ? LIMIT 1`, [partnerAccountCode]);
                // Fallback: Try finding by name (Customers/Suppliers)
                if (partnerAccounts.length === 0) {
                    const searchName = paymentType === 'RECEIPT' ? '%عملاء%' : '%موردين%';
                    console.log(`⚠️ Account ${partnerAccountCode} not found, trying name: ${searchName}`);
                    [partnerAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE name LIKE ? LIMIT 1`, [searchName]);
                }
                const partnerAccount = partnerAccounts[0];
                if (!paymentAccount)
                    console.warn(`❌ Could not find PAYMENT account for journal entry`);
                if (!partnerAccount)
                    console.warn(`❌ Could not find PARTNER account for journal entry`);
                console.log(`🔍 DEBUG: Looking for payment account with code LIKE '${paymentAccountCode}'`);
                console.log(`🔍 DEBUG: Found paymentAccount:`, paymentAccount);
                console.log(`🔍 DEBUG: Found partnerAccount:`, partnerAccount);
                if (paymentAccount && partnerAccount) {
                    // Create journal entry header
                    const methodLabel = partialPaymentMethod === 'CASH' ? 'نقدي' :
                        partialPaymentMethod === 'BANK' ? 'تحويل بنكي' : 'شيك';
                    yield conn.query(`INSERT INTO journal_entries (id, date, description, referenceId, createdBy) 
                         VALUES (?, ?, ?, ?, ?)`, [
                        journalId,
                        date,
                        `${paymentType === 'RECEIPT' ? 'سند قبض' : 'سند صرف'} #${paymentNumber} - ${partnerName} - دفعة مع الفاتورة ${invoiceNumber} (${methodLabel})`,
                        paymentNumber,
                        createdBy
                    ]);
                    // Create journal lines - Double-entry bookkeeping
                    if (paymentType === 'RECEIPT') {
                        // Receipt: Debit Cash/Bank, Credit Receivables
                        yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) 
                             VALUES (?, ?, ?, ?, ?)`, [journalId, paymentAccount.id, paymentAccount.name, paymentCollected, 0]);
                        yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) 
                             VALUES (?, ?, ?, ?, ?)`, [journalId, partnerAccount.id, partnerAccount.name, 0, paymentCollected]);
                    }
                    else {
                        // Payment: Debit Payables, Credit Cash/Bank
                        yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) 
                             VALUES (?, ?, ?, ?, ?)`, [journalId, partnerAccount.id, partnerAccount.name, paymentCollected, 0]);
                        yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) 
                             VALUES (?, ?, ?, ?, ?)`, [journalId, paymentAccount.id, paymentAccount.name, 0, paymentCollected]);
                    }
                    console.log(`📒 Journal entry ${journalId} created for Treasury Journal (${methodLabel})`);
                }
                else {
                    console.warn('⚠️ Could not find payment/partner accounts for journal entry');
                }
            }
            console.log(`✅ Payment ${paymentNumber} created and linked to invoice ${invoiceNumber}`);
            // Log audit trail for payment
            yield (0, auditController_1.logAction)(user, paymentType, 'CREATE', `Created ${paymentType} #${paymentNumber} with Invoice ${invoiceNumber}`, `Partner: ${partnerName}, Amount: ${paymentCollected}`);
        }
        // === PROCESS BANK TRANSFERS (تحويلات بنكية) ===
        // Create payment vouchers for each bank transfer
        const bankTransfers = req.body.bankTransfers;
        if (bankTransfers && Array.isArray(bankTransfers) && bankTransfers.length > 0 && partnerId) {
            console.log(`🏦 Processing ${bankTransfers.length} bank transfers for invoice ${invoiceNumber}`);
            for (const transfer of bankTransfers) {
                if (!transfer.amount || transfer.amount <= 0)
                    continue;
                // Determine payment type based on invoice type
                const transferPaymentType = (type === 'INVOICE_SALE' || type === 'RETURN_PURCHASE')
                    ? 'RECEIPT' // مقبوض
                    : 'PAYMENT'; // سند صرف
                // Generate payment number for the transfer
                const transferPrefix = transferPaymentType === 'RECEIPT' ? 'REC-' : 'PAY-';
                const [tRows] = yield conn.query(`SELECT number FROM invoices WHERE number LIKE ?`, [`${transferPrefix}%`]);
                let maxTransferNum = 0;
                tRows.forEach((row) => {
                    if (row.number.startsWith(transferPrefix)) {
                        const suffix = row.number.substring(transferPrefix.length);
                        if (/^\d+$/.test(suffix)) {
                            const num = parseInt(suffix, 10);
                            if (num > maxTransferNum)
                                maxTransferNum = num;
                        }
                    }
                });
                const transferNumber = `${transferPrefix}${String(maxTransferNum + 1).padStart(5, '0')}`;
                const transferPaymentId = (0, uuid_1.v4)();
                // Create payment/receipt record for bank transfer with sourceInvoiceId for cascade delete
                yield conn.query(`INSERT INTO invoices (
                        id, number, date, type, partnerId, partnerName, 
                        total, status, paymentMethod, posted, notes, 
                        warehouseId, createdBy, bankName, sourceInvoiceId, relatedInvoiceIds
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    transferPaymentId,
                    transferNumber,
                    date,
                    transferPaymentType,
                    partnerId,
                    partnerName,
                    transfer.amount,
                    'POSTED',
                    'BANK',
                    1, // posted = true
                    `تحويل بنكي مع الفاتورة ${invoiceNumber} - مرجع: ${transfer.reference || '-'}`,
                    req.body.warehouseId || null,
                    createdBy,
                    transfer.bankName || null,
                    id, // sourceInvoiceId - for cascade delete
                    JSON.stringify([id])
                ]);
                // Create account transaction for the bank transfer
                yield conn.query(`INSERT INTO account_transactions (
                        id, date, type, partnerId, partnerName, 
                        debit, credit, description, invoiceId, createdBy
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    (0, uuid_1.v4)(),
                    date,
                    transferPaymentType,
                    partnerId,
                    partnerName,
                    transferPaymentType === 'PAYMENT' ? transfer.amount : 0,
                    transferPaymentType === 'RECEIPT' ? transfer.amount : 0,
                    `تحويل بنكي مع الفاتورة ${invoiceNumber} - بنك: ${transfer.bankName || '-'}`,
                    transferPaymentId,
                    createdBy
                ]);
                // === CREATE JOURNAL ENTRY FOR BANK TRANSFER ===
                const transferJournalId = (0, uuid_1.v4)();
                // Get bank account
                let bankAccountId = null;
                let bankAccountName = 'البنوك';
                // Try to find bank account by name from the transfer
                if (transfer.bankName) {
                    const [bankAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE name LIKE ? LIMIT 1`, [`%${transfer.bankName}%`]);
                    if (bankAccounts[0]) {
                        bankAccountId = bankAccounts[0].id;
                        bankAccountName = bankAccounts[0].name;
                    }
                }
                // Fallback to generic bank account
                if (!bankAccountId) {
                    const [bankAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE code LIKE '102%' OR name LIKE '%بنك%' LIMIT 1`, []);
                    if (bankAccounts[0]) {
                        bankAccountId = bankAccounts[0].id;
                        bankAccountName = bankAccounts[0].name;
                    }
                }
                // Get partner account (Receivables for RECEIPT, Payables for PAYMENT)
                // Account codes: 104 = AR (العملاء), 201 = AP (الموردين)
                const transferPartnerAccountCode = transferPaymentType === 'RECEIPT' ? '104%' : '201%';
                let [transferPartnerAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE code LIKE ? LIMIT 1`, [transferPartnerAccountCode]);
                // Fallback: search by name
                if (transferPartnerAccounts.length === 0) {
                    const searchName = transferPaymentType === 'RECEIPT' ? '%عملاء%' : '%موردين%';
                    [transferPartnerAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE name LIKE ? LIMIT 1`, [searchName]);
                }
                const transferPartnerAccount = transferPartnerAccounts[0];
                if (bankAccountId && transferPartnerAccount) {
                    // Create journal entry header
                    yield conn.query(`INSERT INTO journal_entries (id, date, description, referenceId, createdBy) 
                         VALUES (?, ?, ?, ?, ?)`, [
                        transferJournalId,
                        date,
                        `${transferPaymentType === 'RECEIPT' ? 'سند قبض' : 'سند صرف'} #${transferNumber} - ${partnerName} - تحويل بنكي مع الفاتورة ${invoiceNumber}`,
                        transferNumber,
                        createdBy
                    ]);
                    // Create journal lines - Double-entry bookkeeping
                    if (transferPaymentType === 'RECEIPT') {
                        // Receipt: Debit Bank, Credit Receivables
                        yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) 
                             VALUES (?, ?, ?, ?, ?)`, [transferJournalId, bankAccountId, bankAccountName, transfer.amount, 0]);
                        yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) 
                             VALUES (?, ?, ?, ?, ?)`, [transferJournalId, transferPartnerAccount.id, transferPartnerAccount.name, 0, transfer.amount]);
                    }
                    else {
                        // Payment: Debit Payables, Credit Bank
                        yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) 
                             VALUES (?, ?, ?, ?, ?)`, [transferJournalId, transferPartnerAccount.id, transferPartnerAccount.name, transfer.amount, 0]);
                        yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) 
                             VALUES (?, ?, ?, ?, ?)`, [transferJournalId, bankAccountId, bankAccountName, 0, transfer.amount]);
                    }
                    console.log(`📒 Bank transfer journal entry ${transferJournalId} created`);
                }
                // Update bank balance if we have bankId
                if (transfer.bankId) {
                    const balanceChange = transferPaymentType === 'RECEIPT' ? transfer.amount : -transfer.amount;
                    yield conn.query(`UPDATE banks SET balance = balance + ? WHERE id = ?`, [balanceChange, transfer.bankId]);
                    console.log(`🏦 Updated bank ${transfer.bankId} balance by ${balanceChange}`);
                }
                console.log(`✅ Bank transfer payment ${transferNumber} created for ${transfer.amount}`);
                // Log audit trail for bank transfer
                yield (0, auditController_1.logAction)(user, transferPaymentType, 'CREATE', `Created bank transfer ${transferPaymentType} #${transferNumber} with Invoice ${invoiceNumber}`, `Partner: ${partnerName}, Amount: ${transfer.amount}, Bank: ${transfer.bankName || '-'}`);
            }
        }
        // === UPDATE SALESMAN TARGET ACHIEVEMENTS ===
        // DEPRECATED: Targets are now calculated dynamically on read (see salesmanTargetController.ts)
        // No need to update 'achievedQuantity' or 'achievedAmount' physically anymore.
        // Log audit trail
        yield (0, auditController_1.logAction)(user, 'INVOICE', 'CREATE', `Created ${type} Invoice #${invoiceNumber}`, `Partner: ${partnerName}, Amount: ${total}, Payment: ${paymentMethod}`);
        // =====================================================
        // AUTO-UPDATE ACCOUNT BALANCES FROM JOURNAL ENTRIES
        // This is the PERMANENT FIX for treasury balance mismatches
        // Collect all account IDs that were affected by payment journal entries
        // =====================================================
        const affectedAccountIds = [];
        // Note: Journal lines were inserted in the payment processing above
        // We need to recalculate affected accounts. For invoices with payments,
        // the affected accounts are typically: Cash (101), Bank (102), AR (104), AP (201)
        // This is handled when journals are synced via syncController.
        // For direct invoice creation with journal entries, we add the accounts.
        if (paymentCollected > 0 && partnerId) {
            // Get all unique account IDs that might have been affected
            const [journalAccountRows] = yield conn.query(`SELECT DISTINCT jl.accountId FROM journal_lines jl
                 JOIN journal_entries je ON jl.journalId = je.id
                 WHERE je.createdBy = ? AND je.date = ?
                 ORDER BY je.id DESC LIMIT 10`, [createdBy, date]);
            for (const row of journalAccountRows) {
                if (row.accountId)
                    affectedAccountIds.push(row.accountId);
            }
        }
        if (affectedAccountIds.length > 0) {
            const balanceResult = yield (0, accountBalanceUtils_1.updateAccountBalancesFromJournal)(conn, affectedAccountIds);
            if (balanceResult.updatedCount > 0) {
                console.log(`✅ [createInvoice] Auto-updated ${balanceResult.updatedCount} account balances`);
            }
        }
        yield conn.commit();
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'invoice', updatedBy: user });
        }
        res.status(201).json(Object.assign({ id, number: invoiceNumber }, req.body));
    }
    catch (error) {
        yield conn.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'createInvoice');
    }
    finally {
        conn.release();
    }
    // Note: To fully fix atomicity in createInvoice, we need to restructure the whole function to commit at the VERY end.
    // I will do a separate pass for that if requested, as it involves moving a large block of code.
    // For now, I'm fixing the regex at line 319.
});
exports.createInvoice = createInvoice;
// Get the last price a customer paid for a specific product
// آخر سعر اشترى به العميل هذا المنتج
const getCustomerLastProductPrice = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { partnerId, productId } = req.params;
        if (!partnerId || !productId) {
            return res.status(400).json({ message: 'Partner ID and Product ID are required' });
        }
        const conn = yield (0, db_1.getConnection)();
        // Query to get the last price for this product sold to this customer
        // We look at INVOICE_SALE type only (when the customer bought from us)
        const [rows] = yield conn.query(`
            SELECT 
                il.price,
                il.quantity,
                il.discount,
                il.total,
                il.unitName,
                i.id as invoiceId,
                i.date as invoiceDate
            FROM invoice_lines il
            INNER JOIN invoices i ON il.invoiceId = i.id
            WHERE i.partnerId = ?
              AND il.productId = ?
              AND i.type = 'INVOICE_SALE'
              AND i.status != 'VOID'
            ORDER BY i.date DESC, i.id DESC
            LIMIT 1
        `, [partnerId, productId]);
        conn.release();
        if (rows.length === 0) {
            return res.json({
                found: false,
                message: 'لا يوجد سجل مبيعات سابق لهذا العميل مع هذا المنتج'
            });
        }
        const lastPurchase = rows[0];
        res.json({
            found: true,
            price: lastPurchase.price,
            quantity: lastPurchase.quantity,
            discount: lastPurchase.discount,
            total: lastPurchase.total,
            unitName: lastPurchase.unitName,
            invoiceId: lastPurchase.invoiceId,
            invoiceDate: lastPurchase.invoiceDate
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getCustomerLastProductPrice');
    }
});
exports.getCustomerLastProductPrice = getCustomerLastProductPrice;
/**
 * PUT /api/invoices/:id - Update invoice with payment handling
 */
const updateInvoice = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const conn = yield (0, db_1.getConnection)();
    try {
        const invoiceId = req.params.id;
        console.log('🚀 [updateInvoice] Called for ID:', invoiceId);
        console.log('🏦 [updateInvoice] bankTransfers received:', req.body.bankTransfers);
        const authReq = req;
        const user = authReq.user;
        const createdBy = (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || req.body.user || 'System';
        // Get existing invoice
        const [existing] = yield conn.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        const existingInvoice = existing[0];
        const invoiceNumber = existingInvoice.number || req.body.number || invoiceId; // Fallback to ID if number is null
        yield conn.beginTransaction();
        const { date, type, partnerId, partnerName, total, status, paymentMethod, posted, notes, dueDate, taxAmount, whtAmount, shippingFee, globalDiscount, lines, salesmanId, number } = req.body;
        // === SERVER-SIDE TOTAL VALIDATION ===
        // Skip validation for RECEIPT/PAYMENT which don't have line items
        if (lines && lines.length > 0 && !['RECEIPT', 'PAYMENT'].includes(type)) {
            const validation = (0, errorHandler_1.validateInvoiceTotal)(lines, total, taxAmount || 0, globalDiscount || 0, whtAmount || 0, shippingFee || 0);
            if (!validation.valid) {
                conn.release();
                return res.status(400).json({
                    code: 'TOTAL_MISMATCH',
                    message: validation.message,
                    calculated: validation.calculated,
                    provided: total
                });
            }
            console.log(`✅ Invoice update total validated: ${validation.calculated}`);
        }
        // Sanitize dates - convert empty strings to null
        const sanitizedDueDate = dueDate && dueDate !== '' ? dueDate : null;
        // Update invoice (including paidAmount for inline payments)
        yield conn.query(`UPDATE invoices SET
                date = ?, type = ?, partnerId = ?, partnerName = ?,
                total = ?, status = ?, paymentMethod = ?, posted = ?,
                notes = ?, dueDate = ?, taxAmount = ?, whtAmount = ?,
                shippingFee = ?, globalDiscount = ?, warehouseId = ?,
                bankAccountId = ?, bankName = ?, salesmanId = ?, paidAmount = ?,
                paymentBreakdown = ?, bankTransfers = ?
            WHERE id = ?`, [
            date, type, partnerId, partnerName, total, status, paymentMethod, posted,
            notes, sanitizedDueDate, taxAmount, whtAmount, shippingFee, globalDiscount,
            req.body.warehouseId, req.body.bankAccountId, req.body.bankName, salesmanId,
            req.body.paidAmount || req.body.paymentCollected || null,
            req.body.paymentBreakdown ? JSON.stringify(req.body.paymentBreakdown) : null,
            req.body.bankTransfers ? JSON.stringify(req.body.bankTransfers) : null,
            invoiceId
        ]);
        // Update lines - delete and re-insert
        yield conn.query('DELETE FROM invoice_lines WHERE invoiceId = ?', [invoiceId]);
        if (lines && lines.length > 0) {
            console.log('[updateInvoice] Saving lines with warehouseIds:', lines.map((l) => ({ productName: l.productName, warehouseId: l.warehouseId })));
            // FILE DEBUG: Write to file since console might not show in launcher
            const fs = require('fs');
            const debugLog = `[${new Date().toISOString()}] updateInvoice lines: ${JSON.stringify(lines.map((l) => ({ productName: l.productName, warehouseId: l.warehouseId })))}\n`;
            fs.appendFileSync('warehouse_debug.log', debugLog);
            for (const line of lines) {
                const sqlValues = [invoiceId, line.productId, line.productName, line.quantity, line.price, line.cost, line.discount, line.total, line.warehouseId || null];
                // FILE DEBUG: Log exact SQL values
                const fs2 = require('fs');
                const sqlDebug = `[${new Date().toISOString()}] updateInvoice SQL values: ${JSON.stringify(sqlValues)}\n`;
                fs2.appendFileSync('warehouse_debug.log', sqlDebug);
                yield conn.query(`INSERT INTO invoice_lines (invoiceId, productId, productName, quantity, price, cost, discount, total, warehouseId)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, sqlValues);
            }
        }
        // === PAYMENT WITH INVOICE UPDATE LOGIC ===
        // For CASH payments (نقدي), auto-sync payment amount to invoice total
        // For CREDIT (آجل) or partial payments, use the explicit paymentCollected value
        let paymentCollected = Number(req.body.paymentCollected || 0);
        // Auto-sync for CASH: if paymentMethod is CASH and not explicitly آجل, payment = total
        const isCashPayment = paymentMethod === 'CASH' && !req.body.isCredit;
        const invoiceTotal = Number(total || 0);
        if (isCashPayment && paymentCollected !== invoiceTotal) {
            console.log(`💵 CASH payment auto-sync: ${paymentCollected} → ${invoiceTotal}`);
            paymentCollected = invoiceTotal;
        }
        if (partnerId) {
            // Find existing payment linked to this invoice - TRUST THE ID LINK
            const [existingPayments] = yield conn.query(`SELECT * FROM invoices 
                 WHERE JSON_CONTAINS(relatedInvoiceIds, ?) 
                 AND (type = 'RECEIPT' OR type = 'PAYMENT')
                 ORDER BY id DESC LIMIT 1`, [JSON.stringify(invoiceId)]);
            const existingPayment = existingPayments.length > 0 ? existingPayments[0] : null;
            const existingAmount = existingPayment ? Number(existingPayment.total) : 0;
            console.log(`💰 Payment Update: Old=${existingAmount}, New=${paymentCollected}`);
            // Check if partner changed - need to sync to payment
            const partnerChanged = existingPayment && (existingPayment.partnerId !== partnerId || existingPayment.partnerName !== partnerName);
            if (partnerChanged) {
                console.log(`👤 Partner changed: "${existingPayment.partnerName}" → "${partnerName}"`);
            }
            if (existingAmount === paymentCollected && !partnerChanged) {
                console.log('✓ Payment unchanged');
            }
            else if (paymentCollected === 0 && existingPayment) {
                // DELETE payment
                console.log(`🗑️ Deleting payment ${existingPayment.number}`);
                // Also delete journal entries linked to this payment
                yield conn.query('DELETE FROM journal_lines WHERE journalId IN (SELECT id FROM journal_entries WHERE referenceId = ?)', [existingPayment.number]);
                yield conn.query('DELETE FROM journal_entries WHERE referenceId = ?', [existingPayment.number]);
                yield conn.query('DELETE FROM account_transactions WHERE invoiceId = ?', [existingPayment.id]);
                yield conn.query('DELETE FROM invoices WHERE id = ?', [existingPayment.id]);
                console.log('✅ Payment deleted');
            }
            else if (paymentCollected > 0 && existingPayment) {
                // UPDATE payment - sync amount, partner info, and related records
                console.log(`✏️ Updating payment ${existingPayment.number} - Amount: ${paymentCollected}, Partner: ${partnerName}`);
                // Update the payment invoice record with new partner and amount
                yield conn.query(`UPDATE invoices SET total = ?, partnerId = ?, partnerName = ?, notes = ? WHERE id = ?`, [paymentCollected, partnerId, partnerName, `دفعة مع الفاتورة ${invoiceNumber}`, existingPayment.id]);
                // Update account transactions with new partner info and amount
                yield conn.query(`UPDATE account_transactions SET 
                        partnerId = ?, 
                        partnerName = ?, 
                        debit = ?, 
                        credit = ?,
                        description = ?
                    WHERE invoiceId = ?`, [
                    partnerId,
                    partnerName,
                    existingPayment.type === 'PAYMENT' ? paymentCollected : 0,
                    existingPayment.type === 'RECEIPT' ? paymentCollected : 0,
                    `${existingPayment.type === 'RECEIPT' ? 'مقبوض' : 'دفع'} مع الفاتورة ${invoiceNumber} - ${partnerName}`,
                    existingPayment.id
                ]);
                // Update journal entry description with new partner name
                yield conn.query(`UPDATE journal_entries SET description = ? WHERE referenceId = ?`, [`${existingPayment.type === 'RECEIPT' ? 'سند قبض' : 'سند صرف'} #${existingPayment.number} - ${partnerName} - دفعة مع الفاتورة ${invoiceNumber}`, existingPayment.number]);
                // Update journal lines with new amounts
                yield conn.query(`UPDATE journal_lines SET debit = ?, credit = ? 
                     WHERE journalId IN (SELECT id FROM journal_entries WHERE referenceId = ?)`, [
                    existingPayment.type === 'RECEIPT' ? paymentCollected : 0,
                    existingPayment.type === 'RECEIPT' ? 0 : paymentCollected,
                    existingPayment.number
                ]);
                // Fix: Update both lines correctly (one debit, one credit)
                // The first line is the cash/bank account, second is the partner account
                // This is a simplified approach - in reality we'd need to identify which line is which
                console.log('✅ Payment updated with partner sync');
            }
            else if (paymentCollected > 0 && !existingPayment) {
                // CREATE new payment
                console.log(`💰 Creating new payment: ${paymentCollected}`);
                const paymentType = (type === 'INVOICE_SALE' || type === 'RETURN_PURCHASE') ? 'RECEIPT' : 'PAYMENT';
                const paymentPrefix = paymentType === 'RECEIPT' ? 'REC-' : 'PAY-';
                // Fixed regex: We want a literal hyphen, so we need \\- in the string to get \- in regex
                const [maxResult] = yield conn.query(`SELECT MAX(CAST(SUBSTRING(number, ?) AS UNSIGNED)) as maxNum 
                     FROM invoices WHERE number LIKE ? AND number REGEXP ?`, [paymentPrefix.length + 1, `${paymentPrefix}%`, `^${paymentPrefix.replace('-', '\\\\-')}[0-9]+$`]);
                const maxNum = ((_a = maxResult[0]) === null || _a === void 0 ? void 0 : _a.maxNum) || 0;
                const paymentNumber = `${paymentPrefix}${String(maxNum + 1).padStart(5, '0')}`;
                const paymentId = (0, uuid_1.v4)();
                yield conn.query(`INSERT INTO invoices (
                        id, number, date, type, partnerId, partnerName, 
                        total, status, paymentMethod, posted, notes, warehouseId, createdBy
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    paymentId, paymentNumber, date, paymentType, partnerId, partnerName,
                    paymentCollected, 'POSTED', paymentMethod || 'CASH', 1,
                    `دفعة مع الفاتورة ${invoiceNumber}`, req.body.warehouseId, createdBy
                ]);
                yield conn.query('UPDATE invoices SET relatedInvoiceIds = ? WHERE id = ?', [JSON.stringify([invoiceId]), paymentId]);
                yield conn.query(`INSERT INTO account_transactions (
                        id, date, type, partnerId, partnerName, debit, credit, description, invoiceId, createdBy
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    (0, uuid_1.v4)(), date, paymentType, partnerId, partnerName,
                    paymentType === 'PAYMENT' ? paymentCollected : 0,
                    paymentType === 'RECEIPT' ? paymentCollected : 0,
                    `${paymentType === 'RECEIPT' ? 'مقبوض' : 'دفع'} مع الفاتورة ${invoiceNumber}`,
                    paymentId, createdBy
                ]);
                // === CREATE JOURNAL ENTRY FOR TREASURY JOURNAL ===
                // This ensures the payment appears in يومية الخزينة (Treasury Journal)
                // IMPORTANT: Always create journal entry for any payment collected, regardless of main invoice payment method
                if (paymentCollected > 0) {
                    const journalId = (0, uuid_1.v4)();
                    // Determine which account to use based on partialPaymentMethod (new field) or default to CASH
                    const partialPaymentMethod = req.body.partialPaymentMethod || 'CASH';
                    let paymentAccountCode = '101%'; // Default: Cash
                    let paymentAccountName = 'الصندوق';
                    if (partialPaymentMethod === 'BANK') {
                        if (req.body.partialPaymentBankId) {
                            const [bankAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE id = ? LIMIT 1`, [req.body.partialPaymentBankId]);
                            if (bankAccounts[0]) {
                                const bankAcc = bankAccounts[0];
                                paymentAccountCode = bankAcc.id;
                                paymentAccountName = bankAcc.name;
                            }
                        }
                        else {
                            paymentAccountCode = '102%';
                            paymentAccountName = 'البنك';
                        }
                    }
                    else if (partialPaymentMethod === 'CHEQUE') {
                        paymentAccountCode = paymentType === 'RECEIPT' ? '106%' : '203%';
                        paymentAccountName = paymentType === 'RECEIPT' ? 'أوراق قبض' : 'أوراق دفع';
                    }
                    // Get the payment account
                    let paymentAccount;
                    if (partialPaymentMethod === 'BANK' && req.body.partialPaymentBankId) {
                        paymentAccount = { id: req.body.partialPaymentBankId, name: paymentAccountName };
                    }
                    else {
                        let [paymentAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE code LIKE ? LIMIT 1`, [paymentAccountCode]);
                        if (paymentAccounts.length === 0) {
                            const searchName = partialPaymentMethod === 'CASH' ? '%خزينة%' : '%بنك%';
                            [paymentAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE name LIKE ? LIMIT 1`, [searchName]);
                        }
                        paymentAccount = paymentAccounts[0];
                    }
                    // Get partner account (Account codes: 104 = AR, 201 = AP)
                    const partnerAccountCode = paymentType === 'RECEIPT' ? '104%' : '201%';
                    let [partnerAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE code LIKE ? LIMIT 1`, [partnerAccountCode]);
                    if (partnerAccounts.length === 0) {
                        const searchName = paymentType === 'RECEIPT' ? '%عملاء%' : '%موردين%';
                        [partnerAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE name LIKE ? LIMIT 1`, [searchName]);
                    }
                    const partnerAccount = partnerAccounts[0];
                    if (paymentAccount && partnerAccount) {
                        const methodLabel = partialPaymentMethod === 'CASH' ? 'نقدي' :
                            partialPaymentMethod === 'BANK' ? 'تحويل بنكي' : 'شيك';
                        yield conn.query(`INSERT INTO journal_entries (id, date, description, referenceId, createdBy) 
                             VALUES (?, ?, ?, ?, ?)`, [
                            journalId,
                            date,
                            `${paymentType === 'RECEIPT' ? 'سند قبض' : 'سند صرف'} #${paymentNumber} - ${partnerName} - دفعة مع الفاتورة ${invoiceNumber} (${methodLabel})`,
                            paymentNumber,
                            createdBy
                        ]);
                        // Create journal lines - Double-entry bookkeeping
                        if (paymentType === 'RECEIPT') {
                            yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) 
                                 VALUES (?, ?, ?, ?, ?)`, [journalId, paymentAccount.id, paymentAccount.name, paymentCollected, 0]);
                            yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) 
                                 VALUES (?, ?, ?, ?, ?)`, [journalId, partnerAccount.id, partnerAccount.name, 0, paymentCollected]);
                        }
                        else {
                            yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) 
                                 VALUES (?, ?, ?, ?, ?)`, [journalId, partnerAccount.id, partnerAccount.name, paymentCollected, 0]);
                            yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) 
                                 VALUES (?, ?, ?, ?, ?)`, [journalId, paymentAccount.id, paymentAccount.name, 0, paymentCollected]);
                        }
                        console.log(`📒 Journal entry ${journalId} created for Treasury Journal (${methodLabel})`);
                    }
                }
                console.log(`✅ Payment ${paymentNumber} created`);
                yield (0, auditController_1.logAction)(createdBy, paymentType, 'CREATE', `Created ${paymentType} #${paymentNumber} with Invoice ${invoiceNumber}`, `Partner: ${partnerName}, Amount: ${paymentCollected}`);
            }
        }
        yield conn.commit();
        // Log audit trail
        yield (0, auditController_1.logAction)(createdBy, 'INVOICE', 'UPDATE', `Updated ${type} Invoice #${invoiceNumber}`, `Partner: ${partnerName}, Amount: ${total}`);
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'invoice', updatedBy: createdBy });
        }
        res.json(Object.assign(Object.assign({ id: invoiceId, number: invoiceNumber }, req.body), { message: 'Invoice updated successfully' }));
    }
    catch (error) {
        yield conn.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'updateInvoice');
    }
    finally {
        conn.release();
    }
});
exports.updateInvoice = updateInvoice;
