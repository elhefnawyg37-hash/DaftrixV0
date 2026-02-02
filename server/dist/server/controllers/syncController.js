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
exports.syncTransaction = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const salesmanTargetController_1 = require("./salesmanTargetController");
const errorHandler_1 = require("../utils/errorHandler");
const auditController_1 = require("./auditController");
const accountBalanceUtils_1 = require("../utils/accountBalanceUtils");
const invoiceCascadeDelete_1 = require("../utils/invoiceCascadeDelete");
const policyEnforcement_1 = require("../utils/policyEnforcement");
// Helper function to convert ISO datetime to MySQL format
const toMySQLDateTime = (isoDate) => {
    if (!isoDate)
        return null;
    try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
            return isoDate;
        }
        return new Date(isoDate).toISOString().slice(0, 19).replace('T', ' ');
    }
    catch (_a) {
        return null;
    }
};
// Helper function to resolve salesmanId from a potentially incorrect userId
// Mobile apps sometimes send userId instead of salesmanId - this fixes that
const resolveSalesmanId = (conn, providedId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!providedId)
        return null;
    // First, check if it's a valid salesman ID
    const [salesmanExists] = yield conn.query('SELECT id FROM salesmen WHERE id = ?', [providedId]);
    if (salesmanExists.length > 0) {
        return providedId; // It's a valid salesman ID
    }
    // If not a salesman, check if it's a user ID with a linked salesmanId
    const [userWithSalesman] = yield conn.query('SELECT salesmanId FROM users WHERE id = ? AND salesmanId IS NOT NULL', [providedId]);
    if (userWithSalesman.length > 0 && userWithSalesman[0].salesmanId) {
        console.log(`🔄 Resolved userId ${providedId.substring(0, 8)} to salesmanId ${userWithSalesman[0].salesmanId.substring(0, 8)}`);
        return userWithSalesman[0].salesmanId;
    }
    // Return null if we can't resolve it (orphan ID)
    console.warn(`⚠️ Could not resolve salesmanId: ${providedId} (not found in salesmen or users)`);
    return null;
});
// Helper to check permissions
const checkPermissions = (user, body) => {
    // Admins bypass all permission checks
    if (user.role === 'ADMIN' || user.role === 'admin')
        return;
    // Allow SALES/SALESMAN roles to sync sales invoices (mobile salesmen)
    const isSalesRole = user.role === 'SALES' || user.role === 'SALESMAN' || user.role === 'salesman';
    const hasSalesInvoices = [...(body.invoices || []), body.invoice].filter(Boolean).some((inv) => { var _a, _b; return ((_a = inv === null || inv === void 0 ? void 0 : inv.type) === null || _a === void 0 ? void 0 : _a.includes('SALE')) || ((_b = inv === null || inv === void 0 ? void 0 : inv.type) === null || _b === void 0 ? void 0 : _b.includes('RECEIPT')); });
    // If it's a sales user syncing only sales data, allow it
    if (isSalesRole && hasSalesInvoices) {
        console.log('✅ Sales user syncing sales data - allowed');
        return; // Allow sales users to sync their sales
    }
    // Parse permissions if string
    let perms = [];
    if (Array.isArray(user.permissions)) {
        perms = user.permissions;
    }
    else if (typeof user.permissions === 'string') {
        try {
            perms = JSON.parse(user.permissions);
        }
        catch (_a) {
            perms = [];
        }
    }
    const has = (p) => perms.includes(p) || perms.includes('all');
    const hasAny = (ps) => ps.some(p => has(p));
    // 1. Invoices
    const invoices = [...(body.invoices || [])];
    if (body.invoice)
        invoices.push(body.invoice);
    for (const inv of invoices) {
        // Sale invoices (both naming conventions) and receipts
        if (inv.type === 'SALE_INVOICE' || inv.type === 'INVOICE_SALE' || inv.type === 'SALE_RETURN' || inv.type === 'RECEIPT') {
            // Allow vansales/mobile_sales permission for mobile salesmen to create sales
            if (!has('sales.create_invoice') && !has('sales.manage') && !has('vansales') && !has('mobile_sales') && !has('salesman')) {
                throw new Error('Permission denied: sales.create_invoice');
            }
        }
        else if (inv.type === 'PURCHASE_INVOICE' || inv.type === 'INVOICE_PURCHASE' || inv.type === 'PURCHASE_RETURN' || inv.type === 'PAYMENT') {
            if (!has('purchase.create_invoice') && !has('purchase.manage'))
                throw new Error('Permission denied: purchase.create_invoice');
        }
    }
    // 2. Journals
    if (body.journal || (body.journals && body.journals.length > 0)) {
        if (!has('accounting.journal_entry') && !has('accounting.manage'))
            throw new Error('Permission denied: accounting.journal_entry');
    }
    // 3. Products / Stocks
    if ((body.products && body.products.length > 0) || (body.productStocks && body.productStocks.length > 0)) {
        if (!has('inventory.manage'))
            throw new Error('Permission denied: inventory.manage');
    }
    // 4. Partners
    if (body.partners && body.partners.length > 0) {
        if (!hasAny(['partners.manage_customers', 'partners.manage_suppliers', 'sales.manage', 'purchase.manage'])) {
            throw new Error('Permission denied: partners.manage');
        }
    }
    // 5. Cheques
    if (body.cheques && body.cheques.length > 0) {
        if (!has('treasury.manage'))
            throw new Error('Permission denied: treasury.manage');
    }
    // 6. Fixed Assets
    if (body.fixedAssets && body.fixedAssets.length > 0) {
        if (!has('accounting.manage'))
            throw new Error('Permission denied: accounting.manage');
    }
    // 7. Deletions
    if (body.deletedInvoiceId) {
        if (!hasAny(['sales.manage', 'purchase.manage', 'inventory.manage']))
            throw new Error('Permission denied: delete invoice');
    }
    if (body.deletedJournalId) {
        if (!has('accounting.manage'))
            throw new Error('Permission denied: delete journal');
    }
};
const syncTransaction = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    const conn = yield (0, db_1.getConnection)();
    const authReq = req;
    try {
        // Permission Check
        // @ts-ignore
        if (req.user) {
            // @ts-ignore
            checkPermissions(req.user, req.body);
        }
        const { invoice, invoices, journal, products, partners, accounts, cheques, productStocks, allocations, deletedInvoiceId, deletedJournalId } = req.body;
        // Use authenticated user from token if available, otherwise fallback to body (for legacy/migration)
        // @ts-ignore
        const currentUser = req.user ? req.user.name : (req.body.user || 'System');
        // @ts-ignore
        const currentUserRole = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) || 'SALES';
        // ============================================
        // POLICY ENFORCEMENT - Before any DB changes
        // ============================================
        const systemConfig = authReq.systemConfig;
        if (systemConfig) {
            // Validate all invoices
            const invoicesToValidate = [...(invoices || [])];
            if (invoice)
                invoicesToValidate.push(invoice);
            for (const inv of invoicesToValidate) {
                // Check if editing a posted invoice
                const [existingInv] = yield conn.query('SELECT posted, status, createdBy FROM invoices WHERE id = ?', [inv.id]);
                const existingData = existingInv[0];
                if (existingData) {
                    // Validate edit of posted invoice
                    const isPosted = existingData.posted || existingData.status === 'POSTED';
                    const editResult = (0, policyEnforcement_1.validateEditPostedInvoice)(isPosted, systemConfig);
                    if (!editResult.valid) {
                        conn.release();
                        return res.status(403).json({ message: editResult.error, errorCode: editResult.errorCode });
                    }
                }
                // Build context for full validation
                const context = {
                    type: inv.type,
                    date: inv.date,
                    total: inv.total,
                    partnerId: inv.partnerId,
                    notes: inv.notes,
                    costCenterId: inv.costCenterId,
                    warehouseId: inv.warehouseId,
                    posted: inv.posted,
                    createdBy: existingData === null || existingData === void 0 ? void 0 : existingData.createdBy,
                    currentUser,
                    currentUserRole,
                    lines: (_b = inv.lines) === null || _b === void 0 ? void 0 : _b.map((l) => ({
                        productId: l.productId,
                        quantity: l.quantity,
                        cost: l.cost
                    }))
                };
                // Run full validation (sync + async)
                const validationResult = yield (0, policyEnforcement_1.validateTransactionFull)(context, systemConfig);
                if (!validationResult.valid) {
                    conn.release();
                    return res.status(403).json({ message: validationResult.error, errorCode: validationResult.errorCode });
                }
            }
            // Validate invoice deletion
            if (deletedInvoiceId) {
                const [invToDelete] = yield conn.query('SELECT posted, status FROM invoices WHERE id = ?', [deletedInvoiceId]);
                const invData = invToDelete[0];
                if (invData) {
                    const isPosted = invData.posted || invData.status === 'POSTED';
                    const deleteResult = (0, policyEnforcement_1.validateDeletePostedInvoice)(isPosted, systemConfig);
                    if (!deleteResult.valid) {
                        conn.release();
                        return res.status(403).json({ message: deleteResult.error, errorCode: deleteResult.errorCode });
                    }
                }
            }
            // Validate journal entries
            const journalsToValidate = req.body.journals || (journal ? [journal] : []);
            for (const j of journalsToValidate) {
                const [existingJ] = yield conn.query('SELECT createdBy FROM journal_entries WHERE id = ?', [j.id]);
                const existingJData = existingJ[0];
                const context = {
                    type: 'JOURNAL',
                    date: j.date,
                    notes: j.description,
                    costCenterId: (_d = (_c = j.lines) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.costCenterId,
                    createdBy: existingJData === null || existingJData === void 0 ? void 0 : existingJData.createdBy,
                    currentUser,
                    currentUserRole
                };
                const validationResult = yield (0, policyEnforcement_1.validateTransactionFull)(context, systemConfig);
                if (!validationResult.valid) {
                    conn.release();
                    return res.status(403).json({ message: validationResult.error, errorCode: validationResult.errorCode });
                }
            }
        }
        // ============================================
        // END POLICY ENFORCEMENT
        // ============================================
        yield conn.beginTransaction();
        // 1. Handle Invoices (Upsert) - Support both single 'invoice' and array 'invoices'
        // FIX: Ensure we process 'invoice' even if 'invoices' is an empty array
        const invoicesToProcess = [...(invoices || [])];
        if (invoice) {
            // Add main invoice if not already in the list
            if (!invoicesToProcess.find((i) => i.id === invoice.id)) {
                invoicesToProcess.push(invoice);
            }
        }
        // Track skipped invoices to prevent journal creation for duplicates
        const skippedInvoiceIds = new Set();
        if (invoicesToProcess.length > 0) {
            for (const inv of invoicesToProcess) {
                // =================================================
                // SERVER-SIDE PROTECTION: Auto-generate ID if missing
                // =================================================
                if (!inv.id) {
                    inv.id = `INV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    console.warn(`⚠️ Generated server-side ID for invoice: ${inv.id}`);
                }
                // =================================================
                // RESOLVE SALESMAN ID: Convert userId to salesmanId
                // Mobile apps sometimes send userId instead of salesmanId
                // =================================================
                const resolvedSalesmanId = yield resolveSalesmanId(conn, inv.salesmanId);
                // =====================================================
                // SERVER-SIDE TOTAL VALIDATION FOR SYNCED INVOICES
                // Prevents accepting invoices with manipulated totals
                // =====================================================
                if (inv.lines && inv.lines.length > 0 && !['RECEIPT', 'PAYMENT'].includes(inv.type)) {
                    const validation = (0, errorHandler_1.validateInvoiceTotal)(inv.lines, inv.total, inv.taxAmount || 0, inv.globalDiscount || 0, inv.whtAmount || 0, inv.shippingFee || 0);
                    if (!validation.valid) {
                        yield conn.rollback();
                        conn.release();
                        console.error(`❌ Sync rejected: Invoice ${inv.id} total mismatch. ${validation.message}`);
                        return res.status(400).json({
                            code: 'TOTAL_MISMATCH',
                            message: validation.message,
                            invoiceId: inv.id,
                            calculated: validation.calculated,
                            provided: inv.total
                        });
                    }
                    console.log(`✅ Sync: Invoice ${inv.id} total validated (${validation.calculated})`);
                }
                // Check if exists
                const [existing] = yield conn.query('SELECT id, status FROM invoices WHERE id = ?', [inv.id]);
                const wasPosted = ((_e = existing[0]) === null || _e === void 0 ? void 0 : _e.status) === 'POSTED';
                const isNowPosted = inv.status === 'POSTED';
                if (existing.length > 0) {
                    // Update
                    yield conn.query(`UPDATE invoices SET 
                date=?, type=?, partnerId=?, partnerName=?, total=?, status=?, paymentMethod=?, 
                posted=?, notes=?, dueDate=?, taxAmount=?, whtAmount=?, shippingFee=?, globalDiscount=?, warehouseId=?, costCenterId=?, paidAmount=?,
                bankAccountId=?, bankName=?, paymentBreakdown=?, createdBy=?, salesmanId=?
               WHERE id=?`, [
                        toMySQLDateTime(inv.date), inv.type, inv.partnerId, inv.partnerName, inv.total, inv.status, inv.paymentMethod,
                        inv.posted, inv.notes, toMySQLDateTime(inv.dueDate), inv.taxAmount, inv.whtAmount, inv.shippingFee, inv.globalDiscount || inv.discount || 0,
                        inv.warehouseId, inv.costCenterId, inv.paidAmount || 0,
                        inv.bankAccountId || null, inv.bankName || null,
                        inv.paymentBreakdown ? JSON.stringify(inv.paymentBreakdown) : null,
                        inv.createdBy || currentUser,
                        resolvedSalesmanId,
                        inv.id
                    ]);
                    // Delete lines and re-insert (only if lines are provided)
                    // SAFEGUARD: Only update lines if explicitly provided and not empty for existing invoices
                    if (inv.lines !== undefined && inv.lines !== null) {
                        // Warn if trying to set lines to empty array for existing invoice
                        if (inv.lines.length === 0) {
                            console.warn(`⚠️ Warning: Attempting to clear all lines for existing invoice ${inv.id}. This will delete all products!`);
                        }
                        yield conn.query('DELETE FROM invoice_lines WHERE invoiceId = ?', [inv.id]);
                        if (inv.lines.length > 0) {
                            // Batch insert for better performance - includes multi-unit fields
                            const values = inv.lines.map((line) => {
                                // Calculate baseQuantity if unitId is provided
                                const conversionFactor = line.conversionFactor || 1;
                                const baseQuantity = line.baseQuantity || (line.quantity * conversionFactor);
                                return [
                                    inv.id, line.productId, line.productName, line.quantity, line.price, line.cost, line.discount, line.total,
                                    line.unitId || null, line.unitName || null, conversionFactor, baseQuantity,
                                    line.warehouseId || null
                                ];
                            });
                            yield conn.query(`INSERT INTO invoice_lines (invoiceId, productId, productName, quantity, price, cost, discount, total, unitId, unitName, conversionFactor, baseQuantity, warehouseId) VALUES ?`, [values]);
                        }
                    }
                    else {
                        console.log(`ℹ️ Skipping line update for invoice ${inv.id} - lines not provided in update`);
                    }
                    // Update stock if invoice is newly posted (wasn't posted before)
                    if (isNowPosted && !wasPosted && inv.lines && inv.lines.length > 0) {
                        for (const line of inv.lines) {
                            if (line.productId) {
                                // Purchase invoices ADD to stock, Sale invoices SUBTRACT from stock
                                const isPurchase = inv.type === 'PURCHASE_INVOICE' || inv.type === 'PURCHASE_RETURN';
                                const isSale = inv.type === 'SALE_INVOICE' || inv.type === 'SALE_RETURN';
                                const isReturn = inv.type === 'SALE_RETURN' || inv.type === 'PURCHASE_RETURN';
                                // Multi-Unit Support: Use baseQuantity or convert using conversionFactor
                                const conversionFactor = parseFloat(line.conversionFactor) || 1;
                                const baseQty = line.baseQuantity ? parseFloat(line.baseQuantity) : (parseFloat(line.quantity) * conversionFactor);
                                let stockChange = 0;
                                if (isPurchase) {
                                    stockChange = isReturn ? -baseQty : baseQty;
                                }
                                else if (isSale) {
                                    stockChange = isReturn ? baseQty : -baseQty;
                                }
                                if (stockChange !== 0) {
                                    yield conn.query('UPDATE products SET stock = COALESCE(stock, 0) + ? WHERE id = ?', [stockChange, line.productId]);
                                    // Also update warehouse-level product_stocks
                                    const whId = inv.warehouseId || ((_g = (_f = (yield conn.query('SELECT id FROM warehouses LIMIT 1'))[0]) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.id);
                                    if (whId) {
                                        yield conn.query(`
                                            INSERT INTO product_stocks (id, productId, warehouseId, stock)
                                            VALUES (UUID(), ?, ?, ?)
                                            ON DUPLICATE KEY UPDATE stock = stock + ?
                                        `, [line.productId, whId, stockChange, stockChange]);
                                        console.log(`📦 product_stocks updated: ${line.productId} in ${whId} ${stockChange > 0 ? '+' : ''}${stockChange}`);
                                    }
                                    const unitInfo = line.unitName ? ` (${line.quantity} ${line.unitName})` : '';
                                    console.log(`📦 Stock updated: Product ${line.productId} ${stockChange > 0 ? '+' : ''}${stockChange} base units${unitInfo}`);
                                }
                            }
                        }
                    }
                }
                else {
                    // === DUPLICATE DETECTION FOR RECEIPTS ===
                    // Before inserting a new RECEIPT, check if the same partner + amount was recorded within the last 60 seconds
                    // OR if a receipt already exists for the same Reference Invoice (to prevent double-sync of payments)
                    if (inv.type === 'RECEIPT' && inv.total > 0) {
                        let duplicateQuery = `
                            SELECT id, number FROM invoices 
                            WHERE type = 'RECEIPT' 
                            AND (
                                (partnerId = ? AND ABS(total - ?) < 0.01 AND date >= DATE_SUB(NOW(), INTERVAL 5 MINUTE))
                        `;
                        const queryParams = [inv.partnerId, inv.total];
                        // If this receipt is linked to an invoice, check if a receipt with SAME AMOUNT handles that invoice
                        // This allows multiple partial payments, but blocks exact duplicates of the initial payment
                        if (inv.referenceInvoiceId) {
                            duplicateQuery += ` OR (referenceInvoiceId = ? AND ABS(total - ?) < 0.01) `;
                            queryParams.push(inv.referenceInvoiceId, inv.total);
                        }
                        duplicateQuery += ` ) LIMIT 1`;
                        const [duplicateCheck] = yield conn.query(duplicateQuery, queryParams);
                        if (duplicateCheck.length > 0) {
                            const existingReceipt = duplicateCheck[0];
                            console.log(`⚠️ SKIP: Duplicate RECEIPT detected - existing: ${existingReceipt.number} for invoice ${inv.referenceInvoiceId || 'N/A'}`);
                            skippedInvoiceIds.add(inv.id); // Track skipped ID to prevent journal creation
                            continue; // Skip this invoice, don't insert duplicate
                        }
                    }
                    // Insert
                    yield conn.query(`INSERT INTO invoices (id, date, type, partnerId, partnerName, total, status, paymentMethod, posted, notes, dueDate, taxAmount, whtAmount, shippingFee, globalDiscount, warehouseId, costCenterId, paidAmount, bankAccountId, bankName, paymentBreakdown, createdBy, salesmanId) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        inv.id, toMySQLDateTime(inv.date), inv.type, inv.partnerId, inv.partnerName, inv.total, inv.status, inv.paymentMethod,
                        inv.posted, inv.notes, toMySQLDateTime(inv.dueDate), inv.taxAmount, inv.whtAmount, inv.shippingFee, inv.globalDiscount || inv.discount || 0,
                        inv.warehouseId, inv.costCenterId, inv.paidAmount || 0,
                        inv.bankAccountId || null, inv.bankName || null,
                        inv.paymentBreakdown ? JSON.stringify(inv.paymentBreakdown) : null,
                        inv.createdBy || currentUser,
                        resolvedSalesmanId
                    ]);
                    // Insert Lines using batch insert for better performance - includes multi-unit fields
                    if (inv.lines && inv.lines.length > 0) {
                        const values = inv.lines.map((line) => {
                            // Calculate baseQuantity if unitId is provided
                            const conversionFactor = line.conversionFactor || 1;
                            const baseQuantity = line.baseQuantity || (line.quantity * conversionFactor);
                            return [
                                inv.id, line.productId, line.productName, line.quantity, line.price, line.cost, line.discount, line.total,
                                line.unitId || null, line.unitName || null, conversionFactor, baseQuantity,
                                line.warehouseId || null
                            ];
                        });
                        yield conn.query(`INSERT INTO invoice_lines (invoiceId, productId, productName, quantity, price, cost, discount, total, unitId, unitName, conversionFactor, baseQuantity, warehouseId) VALUES ?`, [values]);
                    }
                    // Update stock for new POSTED invoices
                    if (isNowPosted && inv.lines && inv.lines.length > 0) {
                        for (const line of inv.lines) {
                            if (line.productId) {
                                const isPurchase = inv.type === 'PURCHASE_INVOICE' || inv.type === 'PURCHASE_RETURN';
                                const isSale = inv.type === 'SALE_INVOICE' || inv.type === 'SALE_RETURN';
                                const isReturn = inv.type === 'SALE_RETURN' || inv.type === 'PURCHASE_RETURN';
                                // Multi-Unit Support: Use baseQuantity or convert using conversionFactor
                                const convFactorNew = parseFloat(line.conversionFactor) || 1;
                                const baseQtyNew = line.baseQuantity ? parseFloat(line.baseQuantity) : (parseFloat(line.quantity) * convFactorNew);
                                let stockChange = 0;
                                if (isPurchase) {
                                    stockChange = isReturn ? -baseQtyNew : baseQtyNew;
                                }
                                else if (isSale) {
                                    stockChange = isReturn ? baseQtyNew : -baseQtyNew;
                                }
                                if (stockChange !== 0) {
                                    yield conn.query('UPDATE products SET stock = COALESCE(stock, 0) + ? WHERE id = ?', [stockChange, line.productId]);
                                    // Also update warehouse-level product_stocks
                                    const whIdNew = inv.warehouseId || ((_j = (_h = (yield conn.query('SELECT id FROM warehouses LIMIT 1'))[0]) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.id);
                                    if (whIdNew) {
                                        yield conn.query(`
                                            INSERT INTO product_stocks (id, productId, warehouseId, stock)
                                            VALUES (UUID(), ?, ?, ?)
                                            ON DUPLICATE KEY UPDATE stock = stock + ?
                                        `, [line.productId, whIdNew, stockChange, stockChange]);
                                        console.log(`📦 product_stocks updated: ${line.productId} in ${whIdNew} ${stockChange > 0 ? '+' : ''}${stockChange}`);
                                    }
                                    const unitInfoNew = line.unitName ? ` (${line.quantity} ${line.unitName})` : '';
                                    console.log(`📦 Stock updated: Product ${line.productId} ${stockChange > 0 ? '+' : ''}${stockChange} base units${unitInfoNew}`);
                                }
                            }
                        }
                    }
                }
            }
        }
        // === UPDATE SALESMAN TARGET ACHIEVEMENTS ===
        // After all invoices are processed, update targets for sales invoices
        if (invoicesToProcess.length > 0) {
            for (const inv of invoicesToProcess) {
                // Only track SALE_INVOICE / INVOICE_SALE with salesmanId
                const isSaleInvoice = inv.type === 'SALE_INVOICE' || inv.type === 'INVOICE_SALE';
                if (isSaleInvoice && inv.salesmanId && inv.lines && inv.lines.length > 0) {
                    console.log(`📊 Updating salesman targets for ${inv.salesmanId} (${inv.lines.length} lines)`);
                    for (const line of inv.lines) {
                        try {
                            // Get product's categoryId
                            const [productRows] = yield conn.query('SELECT categoryId FROM products WHERE id = ?', [line.productId]);
                            const categoryId = ((_k = productRows[0]) === null || _k === void 0 ? void 0 : _k.categoryId) || null;
                            // Update achievement for this product/category
                            yield (0, salesmanTargetController_1.updateTargetAchievement)(inv.salesmanId, line.productId, categoryId, parseFloat(line.quantity) || 0, parseFloat(line.total) || 0);
                            console.log(`  ✓ Updated target: ${line.productName} (qty: ${line.quantity}, amount: ${line.total})`);
                        }
                        catch (targetError) {
                            // Log but don't fail the sync
                            console.error('Error updating salesman target:', targetError);
                        }
                    }
                }
            }
        }
        // === CREATE TREASURY RECEIPT FOR PAID INVOICES ===
        // For sale invoices with paidAmount > 0, create a treasury receipt (سند قبض)
        // This ensures collected cash from mobile/quick sales goes to the treasury
        // NOTE: vehicleController.createVanSaleVisit() already creates receipts for van sales
        // with number pattern 'RCV-VAN%', so we must check for those to avoid duplicates
        for (const inv of invoicesToProcess) {
            const isSaleInvoice = inv.type === 'SALE_INVOICE' || inv.type === 'INVOICE_SALE';
            const paidAmount = parseFloat(inv.paidAmount) || 0;
            if (isSaleInvoice && paidAmount > 0 && inv.partnerId) {
                try {
                    console.log(`🔍 [syncController] Checking for existing receipt for invoice ${inv.id} (partner: ${inv.partnerId}, amount: ${paidAmount})`);
                    // Check if a receipt for this invoice already exists (avoid duplicates)
                    // Check multiple ways since different controllers use different linking methods:
                    // 1. referenceInvoiceId (syncController's method & vehicleController's method)
                    // 2. relatedInvoiceIds JSON array (invoiceController's method)
                    // 3. notes containing invoice reference
                    // 4. Same partner + same amount created within 5 minutes (catch-all for van sales)
                    // 5. Receipt number pattern 'RCV-VAN%' with matching invoice number in notes
                    const [existingReceipt] = yield conn.query(`SELECT id, number, notes FROM invoices 
                         WHERE type = 'RECEIPT'
                         AND (
                            referenceInvoiceId = ? 
                            OR relatedInvoiceIds LIKE ?
                            OR notes LIKE ?
                            OR notes LIKE ?
                            OR (partnerId = ? AND ABS(total - ?) < 0.01 AND date > DATE_SUB(NOW(), INTERVAL 5 MINUTE))
                         )`, [inv.id, `%${inv.id}%`, `%${inv.id.substring(0, 8)}%`, `%تحصيل بيع متنقل%`, inv.partnerId, paidAmount]);
                    if (existingReceipt.length > 0) {
                        const existing = existingReceipt[0];
                        console.log(`⏭️ [syncController] SKIP: Receipt already exists for invoice ${inv.id} → ${existing.number} (${existing.id})`);
                        continue; // Skip creating duplicate receipt
                    }
                    console.log(`💰 [syncController] No existing receipt found, creating new one for invoice ${inv.id}`);
                    const receiptId = (0, uuid_1.v4)();
                    const receiptNumber = `RCP-${Date.now()}`;
                    // Create treasury receipt
                    yield conn.query(`
                            INSERT INTO invoices (id, date, type, partnerId, partnerName, total, status, 
                                paymentMethod, notes, referenceInvoiceId, createdBy, salesmanId)
                            VALUES (?, ?, 'RECEIPT', ?, ?, ?, 'POSTED', ?, ?, ?, ?, ?)`, [
                        receiptId,
                        toMySQLDateTime(inv.date),
                        inv.partnerId,
                        inv.partnerName,
                        paidAmount,
                        inv.paymentMethod || 'CASH',
                        `مقبوضات فاتورة بيع متنقل ${inv.id.substring(0, 8)}`,
                        inv.id,
                        inv.createdBy || currentUser,
                        yield resolveSalesmanId(conn, inv.salesmanId)
                    ]);
                    // Update partner balance (reduce by paid amount)
                    yield conn.query('UPDATE partners SET balance = COALESCE(balance, 0) - ? WHERE id = ?', [paidAmount, inv.partnerId]);
                    console.log(`💰 Treasury receipt created: ${receiptId} for ${paidAmount} from invoice ${inv.id}`);
                }
                catch (receiptError) {
                    // Log but don't fail the sync
                    console.error('Error creating treasury receipt:', receiptError);
                }
            }
        }
        // === CREATE JOURNAL ENTRIES FOR RECEIPT INVOICES ===
        // Direct RECEIPT invoices (cash receipts from mobile) need journal entries for treasury/bank
        for (const inv of invoicesToProcess) {
            // Skip journal creation for invoices that were detected as duplicates
            if (skippedInvoiceIds.has(inv.id)) {
                console.log(`⏭️ SKIP: Not creating journal for skipped duplicate invoice ${inv.id}`);
                continue;
            }
            if (inv.type === 'RECEIPT' && inv.total > 0) {
                // BUG FIX: Check if a journal for this receipt is already provided in the request payload
                // If so, skip auto-creation to avoid duplicates (one auto-generated, one from frontend)
                const providedJournals = req.body.journals || (req.body.journal ? [req.body.journal] : []);
                const hasProvidedJournal = providedJournals.some((j) => j.referenceId === inv.id);
                if (hasProvidedJournal) {
                    console.log(`ℹ️ [syncController] Skipping auto-journal creation for RECEIPT ${inv.id} - Journal provided in payload`);
                    continue;
                }
                try {
                    // Check if journal entry already exists for this receipt
                    const [existingJournal] = yield conn.query('SELECT id FROM journal_entries WHERE referenceId = ?', [inv.id]);
                    if (existingJournal.length === 0) {
                        const journalId = (0, uuid_1.v4)();
                        // Determine debit account based on payment method
                        let debitAccountId = null;
                        let debitAccountName = 'الخزينة';
                        if (inv.paymentMethod === 'BANK' && inv.bankAccountId) {
                            // BANK PAYMENT: Get the bank's GL account
                            console.log(`🏦 Receipt is bank transfer. Bank ID: ${inv.bankAccountId}`);
                            const [bankAccounts] = yield conn.query(`SELECT b.accountId, b.name FROM banks b WHERE b.id = ? OR b.accountId = ? LIMIT 1`, [inv.bankAccountId, inv.bankAccountId]);
                            if ((_l = bankAccounts[0]) === null || _l === void 0 ? void 0 : _l.accountId) {
                                debitAccountId = bankAccounts[0].accountId;
                                debitAccountName = inv.bankName || bankAccounts[0].name || 'البنك';
                                console.log(`🏦 Using bank GL account: ${debitAccountId} (${debitAccountName})`);
                            }
                        }
                        // Fallback to cash/treasury if not a bank payment or bank not found
                        if (!debitAccountId) {
                            const [cashAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE name LIKE '%خزينة%' OR name LIKE '%نقدية%' OR name LIKE '%صندوق%' OR name LIKE '%Cash%' LIMIT 1`);
                            debitAccountId = (_m = cashAccounts[0]) === null || _m === void 0 ? void 0 : _m.id;
                            debitAccountName = 'الخزينة';
                            // Fallback: get any asset account
                            if (!debitAccountId) {
                                const [fallbackAccounts] = yield conn.query(`SELECT id FROM accounts WHERE code LIKE '1%' AND (isLeaf = 1 OR isLeaf IS NULL) LIMIT 1`);
                                debitAccountId = (_o = fallbackAccounts[0]) === null || _o === void 0 ? void 0 : _o.id;
                            }
                        }
                        // Get customer receivables account - try multiple patterns
                        let [receivableAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE name LIKE '%عملاء%' OR name LIKE '%مدينون%' OR name LIKE '%Receivable%' LIMIT 1`);
                        let receivableAccountId = (_p = receivableAccounts[0]) === null || _p === void 0 ? void 0 : _p.id;
                        // Fallback: get any asset account different from debit account
                        if (!receivableAccountId && debitAccountId) {
                            [receivableAccounts] = yield conn.query(`SELECT id FROM accounts WHERE code LIKE '1%' AND (isLeaf = 1 OR isLeaf IS NULL) AND id != ? LIMIT 1`, [debitAccountId]);
                            receivableAccountId = (_q = receivableAccounts[0]) === null || _q === void 0 ? void 0 : _q.id;
                        }
                        if (debitAccountId && receivableAccountId) {
                            // Create journal entry header
                            yield conn.query(`INSERT INTO journal_entries (id, date, description, referenceId, createdBy) VALUES (?, ?, ?, ?, ?)`, [journalId, toMySQLDateTime(inv.date), `سند قبض - ${inv.partnerName}${inv.paymentMethod === 'BANK' ? ' - تحويل بنكي' : ''}`, inv.id, inv.createdBy || currentUser]);
                            // Create journal lines: Debit Cash/Bank, Credit Customer
                            // Line 1: Debit Cash or Bank (increase treasury/bank balance)
                            yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) VALUES (?, ?, ?, ?, ?)`, [journalId, debitAccountId, debitAccountName, inv.total, 0]);
                            // Line 2: Credit Customer (reduce receivable)
                            yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit) VALUES (?, ?, ?, ?, ?)`, [journalId, receivableAccountId, inv.partnerName || 'العملاء', 0, inv.total]);
                            // Update partner balance (reduce by receipt amount)
                            if (inv.partnerId) {
                                yield conn.query('UPDATE partners SET balance = COALESCE(balance, 0) - ? WHERE id = ?', [inv.total, inv.partnerId]);
                            }
                            console.log(`📗 Journal entry created for RECEIPT: ${journalId} - ${inv.total} from ${inv.partnerName} (${inv.paymentMethod === 'BANK' ? 'BANK' : 'CASH'})`);
                        }
                        else {
                            console.warn('⚠️ Could not find debit or receivable accounts for journal entry');
                        }
                    }
                }
                catch (journalError) {
                    console.error('Error creating journal for receipt:', journalError);
                }
            }
        }
        // 1b. Handle Allocations
        if (allocations && allocations.length > 0) {
            for (const alloc of allocations) {
                // Delete existing allocation for this pair if exists (to avoid duplicates or update amount)
                yield conn.query('DELETE FROM payment_allocations WHERE paymentId = ? AND invoiceId = ?', [alloc.paymentId, alloc.invoiceId]);
                yield conn.query(`INSERT INTO payment_allocations (id, paymentId, invoiceId, amount) VALUES (?, ?, ?, ?)`, [alloc.id || (0, uuid_1.v4)(), alloc.paymentId, alloc.invoiceId, alloc.amount]);
            }
        }
        // 2. Handle Journals (Upsert)
        const journals = req.body.journals || (journal ? [journal] : []);
        const processedJournals = [];
        if (journals.length > 0) {
            for (const j of journals) {
                // Validation: Don't update if lines are missing/empty (unless it's a delete, handled separately)
                if (!j.lines || j.lines.length === 0) {
                    console.warn(`Skipping journal update for ${j.id} due to missing lines`);
                    continue;
                }
                const [existingJ] = yield conn.query('SELECT id FROM journal_entries WHERE id = ?', [j.id]);
                if (existingJ.length > 0) {
                    // Update Header
                    yield conn.query('UPDATE journal_entries SET date=?, description=?, referenceId=?, createdBy=? WHERE id=?', [toMySQLDateTime(j.date), j.description, j.referenceId, j.createdBy || currentUser, j.id]);
                    // Replace Lines
                    yield conn.query('DELETE FROM journal_lines WHERE journalId = ?', [j.id]);
                }
                else {
                    // Insert Header
                    yield conn.query('INSERT INTO journal_entries (id, date, description, referenceId, createdBy) VALUES (?, ?, ?, ?, ?)', [j.id, toMySQLDateTime(j.date), j.description, j.referenceId, j.createdBy || currentUser]);
                }
                // Insert Lines using batch insert for better performance
                // First validate all lines have accountId
                for (const line of j.lines) {
                    if (!line.accountId) {
                        throw new Error(`Missing accountId for journal line in entry ${j.id}`);
                    }
                }
                const values = j.lines.map((line) => [
                    j.id, line.accountId, line.accountName, line.debit, line.credit, line.costCenterId
                ]);
                yield conn.query(`INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit, costCenterId) VALUES ?`, [values]);
                processedJournals.push(j);
            }
            // =====================================================
            // AUTO-UPDATE ACCOUNT BALANCES FROM JOURNAL ENTRIES
            // This is the PERMANENT FIX for treasury balance mismatches
            // =====================================================
            const affectedAccountIds = new Set();
            for (const j of processedJournals) {
                for (const line of j.lines) {
                    if (line.accountId) {
                        affectedAccountIds.add(line.accountId);
                    }
                }
            }
            if (affectedAccountIds.size > 0) {
                const balanceResult = yield (0, accountBalanceUtils_1.updateAccountBalancesFromJournal)(conn, Array.from(affectedAccountIds));
                if (balanceResult.updatedCount > 0) {
                    console.log(`✅ Auto-updated ${balanceResult.updatedCount} account balances from journal entries`);
                }
            }
        }
        // 3. Update Products (Cost)
        if (products && products.length > 0) {
            for (const p of products) {
                yield conn.query('UPDATE products SET cost = ? WHERE id = ?', [parseFloat(p.cost) || 0, p.id]);
            }
        }
        // 3b. Update Product Stocks
        if (productStocks && productStocks.length > 0) {
            console.log('Syncing product stocks:', productStocks.length);
            for (const ps of productStocks) {
                // Check if record exists
                const [existing] = yield conn.query('SELECT id FROM product_stocks WHERE productId = ? AND warehouseId = ?', [ps.productId, ps.warehouseId]);
                if (existing.length > 0) {
                    yield conn.query('UPDATE product_stocks SET stock = ? WHERE productId = ? AND warehouseId = ?', [parseFloat(ps.stock) || 0, ps.productId, ps.warehouseId]);
                }
                else {
                    yield conn.query('INSERT INTO product_stocks (id, productId, warehouseId, stock) VALUES (?, ?, ?, ?)', [(0, uuid_1.v4)(), ps.productId, ps.warehouseId, parseFloat(ps.stock) || 0]);
                }
            }
        }
        // 4. Update Partners (Balance)
        // 4. Update Partners (Upsert)
        if (partners && partners.length > 0) {
            for (const p of partners) {
                const [existing] = yield conn.query('SELECT id FROM partners WHERE id = ?', [p.id]);
                if (existing.length > 0) {
                    // Update existing partner
                    // We only update balance and basic info if provided, to avoid overwriting full details with partial data if that's the case
                    // But for sync, we usually trust the incoming data.
                    // However, the original code ONLY updated balance. Let's update more fields if they exist, but prioritize balance as that's the main sync target usually.
                    // Given the context of "Quick Add", we need to insert.
                    yield conn.query(`UPDATE partners SET 
                        balance = ?, 
                        name = COALESCE(?, name),
                        phone = COALESCE(?, phone),
                        address = COALESCE(?, address)
                        WHERE id = ?`, [parseFloat(p.balance) || 0, p.name, p.phone, p.address, p.id]);
                }
                else {
                    // Insert new partner
                    // Sanitize type - database ENUM only accepts CUSTOMER or SUPPLIER
                    let partnerType = p.type || 'CUSTOMER';
                    if (partnerType === 'BOTH')
                        partnerType = 'CUSTOMER';
                    yield conn.query(`INSERT INTO partners (id, name, type, balance, phone, address, isCustomer, isSupplier)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                        p.id,
                        p.name,
                        partnerType,
                        parseFloat(p.balance) || 0,
                        p.phone || null,
                        p.address || null,
                        (_r = p.isCustomer) !== null && _r !== void 0 ? _r : (partnerType === 'CUSTOMER' || p.type === 'BOTH'),
                        (_s = p.isSupplier) !== null && _s !== void 0 ? _s : (partnerType === 'SUPPLIER' || p.type === 'BOTH')
                    ]);
                }
            }
        }
        // 5. Update Accounts (Balance)
        if (accounts && accounts.length > 0) {
            for (const a of accounts) {
                yield conn.query('UPDATE accounts SET balance = ? WHERE id = ?', [parseFloat(a.balance) || 0, a.id]);
            }
        }
        // 6. Handle Cheques (Upsert)
        if (cheques && cheques.length > 0) {
            for (const c of cheques) {
                // Check if cheque already exists
                const [existingCheque] = yield conn.query('SELECT id FROM cheques WHERE id = ?', [c.id]);
                if (existingCheque.length > 0) {
                    // Update existing cheque
                    yield conn.query(`UPDATE cheques SET 
                        number = ?, bankName = ?, amount = ?, dueDate = ?, status = ?, type = ?, 
                        partnerId = ?, partnerName = ?, description = ?, createdDate = ?, 
                        bankAccountId = ?, bounceReason = ?, transactionId = ?, createdBy = ?
                        WHERE id = ?`, [
                        c.number, c.bankName, c.amount, toMySQLDateTime(c.dueDate), c.status, c.type,
                        c.partnerId, c.partnerName, c.description, toMySQLDateTime(c.createdDate),
                        c.bankAccountId, c.bounceReason, c.transactionId, c.createdBy || currentUser,
                        c.id
                    ]);
                }
                else {
                    // Insert new cheque
                    yield conn.query(`INSERT INTO cheques (id, number, bankName, amount, dueDate, status, type, partnerId, partnerName, description, createdDate, bankAccountId, bounceReason, transactionId, createdBy)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        c.id, c.number, c.bankName, c.amount, toMySQLDateTime(c.dueDate), c.status, c.type,
                        c.partnerId, c.partnerName, c.description, toMySQLDateTime(c.createdDate),
                        c.bankAccountId, c.bounceReason, c.transactionId, c.createdBy || currentUser
                    ]);
                }
            }
        }
        // 7. Handle Fixed Assets (Upsert)
        const assets = req.body.fixedAssets;
        if (assets && assets.length > 0) {
            for (const a of assets) {
                const [existingA] = yield conn.query('SELECT id FROM fixed_assets WHERE id = ?', [a.id]);
                if (existingA.length > 0) {
                    yield conn.query(`UPDATE fixed_assets SET 
                        name=?, purchaseDate=?, purchaseCost=?, salvageValue=?, lifeYears=?, 
                        assetAccountId=?, accumulatedDepreciationAccountId=?, expenseAccountId=?, 
                        status=?, lastDepreciationDate=?
                        WHERE id=?`, [
                        a.name, toMySQLDateTime(a.purchaseDate), a.purchaseCost, a.salvageValue, a.lifeYears,
                        a.assetAccountId, a.accumulatedDepreciationAccountId, a.expenseAccountId,
                        a.status, toMySQLDateTime(a.lastDepreciationDate),
                        a.id
                    ]);
                }
                else {
                    yield conn.query(`INSERT INTO fixed_assets (id, name, purchaseDate, purchaseCost, salvageValue, lifeYears, assetAccountId, accumulatedDepreciationAccountId, expenseAccountId, status, lastDepreciationDate)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        a.id, a.name, toMySQLDateTime(a.purchaseDate), a.purchaseCost, a.salvageValue, a.lifeYears,
                        a.assetAccountId, a.accumulatedDepreciationAccountId, a.expenseAccountId,
                        a.status || 'ACTIVE', toMySQLDateTime(a.lastDepreciationDate)
                    ]);
                }
            }
        }
        // 6. Handle Deletions - Use CASCADE DELETE to also remove linked سند قبض / سند صرف
        if (deletedInvoiceId) {
            // Use cascade delete to remove invoice + all related treasury documents
            const cascadeResult = yield (0, invoiceCascadeDelete_1.deleteInvoiceWithCascade)(conn, deletedInvoiceId, currentUser);
            if (cascadeResult.success) {
                console.log(`🗑️ [Sync] Cascade deleted invoice ${deletedInvoiceId}:`, {
                    receipts: cascadeResult.deletedReceipts,
                    payments: cascadeResult.deletedPayments,
                    journals: cascadeResult.deletedJournals
                });
            }
            else {
                console.error(`❌ [Sync] Failed to cascade delete invoice ${deletedInvoiceId}:`, cascadeResult.error);
            }
        }
        if (deletedJournalId) {
            yield conn.query('DELETE FROM journal_entries WHERE id = ?', [deletedJournalId]);
        }
        // 7. Log Audit - Create individual audit logs for each operation
        // Log invoice creations/updates
        if (invoicesToProcess.length > 0) {
            for (const inv of invoicesToProcess) {
                // Translate invoice types to readable Arabic
                const typeMap = {
                    'SALE_INVOICE': 'فاتورة بيع',
                    'PURCHASE_INVOICE': 'فاتورة شراء',
                    'SALE_RETURN': 'مرتجع مبيعات',
                    'PURCHASE_RETURN': 'مرتجع مشتريات',
                    'RECEIPT': 'سند قبض',
                    'PAYMENT': 'سند صرف',
                    'OPENING_BALANCE': 'رصيد افتتاحي'
                };
                const invoiceTypeArabic = typeMap[inv.type] || inv.type;
                const partnerName = inv.partnerName || 'بدون عميل';
                // Build detailed description
                let details = `النوع: ${invoiceTypeArabic}`;
                if (inv.partnerName)
                    details += ` | العميل/المورد: ${inv.partnerName}`;
                details += ` | المبلغ: ${Number(inv.total).toLocaleString('ar-EG')} ج.م`;
                details += ` | الحالة: ${inv.status === 'PAID' ? 'مدفوع' : inv.status === 'PENDING' ? 'معلق' : inv.status}`;
                if (inv.paymentMethod) {
                    const paymentMap = {
                        'CASH': 'نقداً',
                        'CARD': 'بطاقة',
                        'BANK': 'تحويل بنكي',
                        'CHEQUE': 'شيك',
                        'CREDIT': 'آجل'
                    };
                    details += ` | طريقة الدفع: ${paymentMap[inv.paymentMethod] || inv.paymentMethod}`;
                }
                if (inv.notes) {
                    details += ` | ملاحظات: ${inv.notes.substring(0, 50)}${inv.notes.length > 50 ? '...' : ''}`;
                }
                details += ` | رقم المرجع: ${inv.id.substring(0, 8)}`;
                yield (0, auditController_1.logAction)(currentUser, 'INVOICE', 'SAVE', `${invoiceTypeArabic} - ${partnerName}`, details);
            }
        }
        if (deletedInvoiceId) {
            yield (0, auditController_1.logAction)(currentUser, 'INVOICE', 'DELETE', `حذف فاتورة`, `تم حذف الفاتورة | رقم المرجع: ${deletedInvoiceId.substring(0, 8)}`);
        }
        // Log journal entries
        if (processedJournals.length > 0) {
            for (const j of processedJournals) {
                // Calculate totals
                const totalDebit = j.lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
                const totalCredit = j.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
                let details = `الوصف: ${j.description || 'قيد يومية'}`;
                details += ` | إجمالي المدين: ${totalDebit.toLocaleString('ar-EG')} ج.م`;
                details += ` | إجمالي الدائن: ${totalCredit.toLocaleString('ar-EG')} ج.م`;
                details += ` | عدد الحسابات: ${j.lines.length}`;
                details += ` | رقم المرجع: ${j.id.substring(0, 8)}`;
                yield (0, auditController_1.logAction)(currentUser, 'ACCOUNTING', 'JOURNAL', `قيد يومية - ${j.description || 'بدون وصف'}`, details);
            }
        }
        // Log journal deletion
        if (deletedJournalId) {
            yield (0, auditController_1.logAction)(currentUser, 'ACCOUNTING', 'DELETE', `حذف قيد يومية`, `تم حذف القيد اليومي | رقم المرجع: ${deletedJournalId.substring(0, 8)}`);
        }
        yield conn.commit();
        // 8. Broadcast Real-time Updates
        const io = req.app.get('io');
        if (io) {
            if (invoicesToProcess.length > 0 || deletedInvoiceId) {
                console.log('📡 Broadcasting invoice change...');
                io.emit('entity:changed', { entityType: 'invoice', updatedBy: currentUser });
            }
            if (cheques && cheques.length > 0) {
                console.log('📡 Broadcasting cheque change...');
                io.emit('entity:changed', { entityType: 'cheques', updatedBy: currentUser });
            }
            // FIX: Check processedJournals instead of req.body.journalEntries
            if (processedJournals.length > 0 || deletedJournalId) {
                console.log(`📡 Broadcasting journal change (${processedJournals.length} entries processed)...`);
                io.emit('entity:changed', { entityType: 'journal', updatedBy: currentUser });
            }
            // Broadcast account changes if accounts were updated or journals were posted (affects balances)
            if ((accounts && accounts.length > 0) || processedJournals.length > 0) {
                console.log(`📡 Broadcasting account change (journals: ${processedJournals.length}, accounts: ${(accounts === null || accounts === void 0 ? void 0 : accounts.length) || 0})...`);
                io.emit('entity:changed', { entityType: 'accounts', updatedBy: currentUser });
            }
            if (partners && partners.length > 0) {
                console.log('📡 Broadcasting partner change...');
                io.emit('entity:changed', { entityType: 'partner', updatedBy: currentUser });
            }
        }
        else {
            console.warn('⚠️ WebSocket IO not available - real-time updates will not work!');
        }
        res.json({
            success: true,
            journal: processedJournals.length === 1 ? processedJournals[0] : undefined,
            journals: processedJournals
        });
    }
    catch (error) {
        yield conn.rollback();
        console.error("Sync Error:", error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'Sync failed');
    }
    finally {
        conn.release();
    }
});
exports.syncTransaction = syncTransaction;
