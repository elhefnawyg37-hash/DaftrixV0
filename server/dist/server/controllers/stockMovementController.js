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
exports.getMovementStats = exports.reconcileStock = exports.createStockMovement = exports.getProductMovementHistory = exports.getStockMovements = void 0;
const db_1 = require("../db");
const errorHandler_1 = require("../utils/errorHandler");
/**
 * Stock Movement Controller
 * Handles stock movement tracking and audit
 */
// Get stock movements with filters
const getStockMovements = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productId, movementType, startDate, endDate, warehouseId, limit = 99999, offset = 0 } = req.query;
        let query = `
            SELECT sm.*, 
                   p.name as product_name,
                   p.sku as product_sku,
                   p.unit as product_unit
            FROM stock_movements sm
            LEFT JOIN products p ON sm.product_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (productId) {
            query += ' AND sm.product_id = ?';
            params.push(productId);
        }
        if (movementType) {
            query += ' AND sm.movement_type = ?';
            params.push(movementType);
        }
        if (startDate) {
            query += ' AND sm.movement_date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND sm.movement_date <= ?';
            params.push(endDate);
        }
        if (warehouseId) {
            query += ' AND sm.warehouse_id = ?';
            params.push(warehouseId);
        }
        query += ' ORDER BY sm.movement_date DESC, sm.id DESC';
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        const [rows] = yield db_1.pool.query(query, params);
        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM stock_movements sm WHERE 1=1';
        const countParams = [];
        if (productId) {
            countQuery += ' AND sm.product_id = ?';
            countParams.push(productId);
        }
        if (movementType) {
            countQuery += ' AND sm.movement_type = ?';
            countParams.push(movementType);
        }
        if (startDate) {
            countQuery += ' AND sm.movement_date >= ?';
            countParams.push(startDate);
        }
        if (endDate) {
            countQuery += ' AND sm.movement_date <= ?';
            countParams.push(endDate);
        }
        if (warehouseId) {
            countQuery += ' AND sm.warehouse_id = ?';
            countParams.push(warehouseId);
        }
        const [countRows] = yield db_1.pool.query(countQuery, countParams);
        const total = countRows[0].total;
        // Convert snake_case to camelCase
        const movements = rows.map(row => ({
            id: row.id,
            productId: row.product_id,
            productName: row.product_name,
            productSku: row.product_sku,
            productUnit: row.product_unit,
            warehouseId: row.warehouse_id,
            qtyChange: parseFloat(row.qty_change) || 0,
            movementType: row.movement_type,
            movementDate: row.movement_date || row.created_at,
            referenceType: row.reference_type,
            referenceId: row.reference_id,
            unitCost: parseFloat(row.unit_cost) || 0,
            notes: row.notes,
            batchId: row.batch_id,
            createdBy: row.created_by,
            createdAt: row.created_at
        }));
        res.json({
            movements,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + movements.length < total
            }
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getStockMovements');
    }
});
exports.getStockMovements = getStockMovements;
// Get product movement history (Live Calculation from Stock Movements, Permits & Historical Invoices)
// NOTE: New invoices create stock_movements records, but HISTORICAL invoices only exist in invoice_lines.
// We query invoice_lines and EXCLUDE those that have corresponding stock_movements to avoid double-counting.
const getProductMovementHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productId } = req.params;
        const { warehouseId } = req.query;
        // First, get all warehouses for name lookup
        const [warehouseRows] = yield db_1.pool.query('SELECT id, name FROM warehouses');
        const warehouseMap = {};
        warehouseRows.forEach(w => {
            warehouseMap[w.id] = w.name;
        });
        // 1. Fetch HISTORICAL Invoices (Sales, Purchases, Returns)
        // EXCLUDE invoices that have stock_movements records (to avoid double-counting new invoices)
        const [invoiceRows] = yield db_1.pool.query(`
            SELECT 
                i.id, 
                i.date, 
                i.type, 
                i.number as docNumber, 
                CONCAT(i.type, ' - ', COALESCE(i.partnerName, '')) as description,
                i.notes,
                il.quantity,
                COALESCE(il.warehouseId, i.warehouseId) as docWarehouseId
            FROM invoice_lines il
            JOIN invoices i ON il.invoiceId = i.id
            WHERE il.productId = ? 
              AND i.status = 'POSTED' 
              AND i.number NOT LIKE 'VAN-%'
              AND NOT EXISTS (
                  SELECT 1 FROM stock_movements sm 
                  WHERE sm.reference_id = i.id 
                    AND sm.product_id = il.productId
                    AND sm.reference_type IN ('INVOICE_SALE', 'INVOICE_PURCHASE', 'RETURN_SALE', 'RETURN_PURCHASE')
              )
        `, [productId]);
        // 2. Fetch Stock Permits (In, Out, Transfer)
        const [permitRows] = yield db_1.pool.query(`
            SELECT 
                sp.id, 
                sp.date, 
                sp.type, 
                sp.number as docNumber, 
                sp.description,
                spi.quantity,
                sp.sourceWarehouseId,
                sp.destWarehouseId
            FROM stock_permit_items spi
            JOIN stock_permits sp ON spi.permitId = sp.id
            WHERE spi.productId = ?
        `, [productId]);
        // 2. Fetch Stock Movements (Invoices, Production, Adjustments, Opening Balances, etc.)
        // This includes ALL stock changes - invoices now write here via invoiceController
        let stockMovementQuery = `
            SELECT 
                sm.id,
                sm.movement_date as date,
                sm.movement_type as type,
                sm.reference_type,
                sm.reference_id,
                COALESCE(sm.notes, CONCAT(sm.movement_type, '-', sm.id)) as docNumber,
                sm.notes as description,
                sm.qty_change,
                sm.warehouse_id
            FROM stock_movements sm
            WHERE sm.product_id = ?
        `;
        const smParams = [productId];
        if (warehouseId) {
            // For specific warehouse ID, include:
            // 1. Movements with that specific warehouse ID
            // 2. Movements with NULL warehouse ID (Global) UNLESS they are VAN_SALE
            //    (Van Sales are truly separate location, not global/shared stock)
            stockMovementQuery += ' AND (sm.warehouse_id = ? OR (sm.warehouse_id IS NULL AND sm.reference_type != "VAN_SALE"))';
            smParams.push(warehouseId);
        }
        const [stockMovementRows] = yield db_1.pool.query(stockMovementQuery, smParams);
        const movements = [];
        const targetWarehouseId = warehouseId;
        // Process HISTORICAL Invoices (those without stock_movements)
        invoiceRows.forEach(row => {
            const whId = row.docWarehouseId;
            // Filter by warehouse if requested
            if (targetWarehouseId) {
                if (whId && whId !== targetWarehouseId)
                    return;
                // Exclude Van Sales from Specific Warehouse View
                const isVanSale = (row.docNumber && row.docNumber.toString().startsWith('VAN-')) ||
                    (row.notes && (row.notes.includes('بيع متنقل') || row.notes.includes('Van Sale')));
                if (isVanSale)
                    return;
            }
            let inQty = 0;
            let outQty = 0;
            switch (row.type) {
                case 'INVOICE_SALE':
                    outQty = row.quantity;
                    break;
                case 'INVOICE_PURCHASE':
                    inQty = row.quantity;
                    break;
                case 'RETURN_SALE':
                    inQty = row.quantity;
                    break;
                case 'RETURN_PURCHASE':
                    outQty = row.quantity;
                    break;
            }
            const warehouseName = whId ? warehouseMap[whId] : null;
            // Map invoice types to readable labels
            let displayType = row.type;
            switch (row.type) {
                case 'INVOICE_SALE':
                    displayType = 'فاتورة بيع';
                    break;
                case 'INVOICE_PURCHASE':
                    displayType = 'فاتورة شراء';
                    break;
                case 'RETURN_SALE':
                    displayType = 'مرتجع مبيعات';
                    break;
                case 'RETURN_PURCHASE':
                    displayType = 'مرتجع مشتريات';
                    break;
            }
            movements.push({
                id: row.id,
                date: row.date,
                type: displayType,
                docNumber: row.docNumber || row.id,
                description: row.description,
                inQty,
                outQty,
                balance: 0,
                warehouseId: whId,
                warehouseName: warehouseName || 'الكل',
                sourceWarehouse: null,
                destWarehouse: null,
                transferQty: 0
            });
        });
        // Process Permits - For transfers, show individual FROM/TO entries
        permitRows.forEach(row => {
            const sourceWarehouseName = row.sourceWarehouseId ? warehouseMap[row.sourceWarehouseId] : null;
            const destWarehouseName = row.destWarehouseId ? warehouseMap[row.destWarehouseId] : null;
            if (targetWarehouseId) {
                // Warehouse Specific View
                if (row.type === 'STOCK_PERMIT_IN') {
                    if (row.destWarehouseId === targetWarehouseId) {
                        movements.push({
                            id: row.id,
                            date: row.date,
                            type: row.type,
                            docNumber: row.docNumber || row.id,
                            description: row.description || `إذن إضافة إلى ${destWarehouseName}`,
                            inQty: row.quantity,
                            outQty: 0,
                            balance: 0,
                            warehouseId: row.destWarehouseId,
                            warehouseName: destWarehouseName,
                            sourceWarehouse: null,
                            destWarehouse: destWarehouseName,
                            transferQty: 0
                        });
                    }
                }
                else if (row.type === 'STOCK_PERMIT_OUT') {
                    if (row.sourceWarehouseId === targetWarehouseId) {
                        movements.push({
                            id: row.id,
                            date: row.date,
                            type: row.type,
                            docNumber: row.docNumber || row.id,
                            description: row.description || `إذن صرف من ${sourceWarehouseName}`,
                            inQty: 0,
                            outQty: row.quantity,
                            balance: 0,
                            warehouseId: row.sourceWarehouseId,
                            warehouseName: sourceWarehouseName,
                            sourceWarehouse: sourceWarehouseName,
                            destWarehouse: null
                        });
                    }
                }
                else if (row.type === 'STOCK_TRANSFER') {
                    // For specific warehouse view, show IN or OUT based on perspective
                    if (row.destWarehouseId === targetWarehouseId) {
                        movements.push({
                            id: `${row.id}-IN`,
                            date: row.date,
                            type: 'STOCK_TRANSFER',
                            docNumber: row.docNumber || row.id,
                            description: `تحويل فروع: من ${sourceWarehouseName} ← إلى ${destWarehouseName}`,
                            inQty: row.quantity,
                            outQty: 0,
                            balance: 0,
                            warehouseId: row.destWarehouseId,
                            warehouseName: destWarehouseName,
                            sourceWarehouse: sourceWarehouseName,
                            destWarehouse: destWarehouseName
                        });
                    }
                    else if (row.sourceWarehouseId === targetWarehouseId) {
                        movements.push({
                            id: `${row.id}-OUT`,
                            date: row.date,
                            type: 'STOCK_TRANSFER',
                            docNumber: row.docNumber || row.id,
                            description: `تحويل فروع: من ${sourceWarehouseName} ← إلى ${destWarehouseName}`,
                            inQty: 0,
                            outQty: row.quantity,
                            balance: 0,
                            warehouseId: row.sourceWarehouseId,
                            warehouseName: sourceWarehouseName,
                            sourceWarehouse: sourceWarehouseName,
                            destWarehouse: destWarehouseName
                        });
                    }
                }
            }
            else {
                // Global View - Show both sides of transfer as SEPARATE movements
                if (row.type === 'STOCK_PERMIT_IN') {
                    movements.push({
                        id: row.id,
                        date: row.date,
                        type: row.type,
                        docNumber: row.docNumber || row.id,
                        description: row.description || `إذن إضافة إلى ${destWarehouseName}`,
                        inQty: row.quantity,
                        outQty: 0,
                        balance: 0,
                        warehouseId: row.destWarehouseId,
                        warehouseName: destWarehouseName,
                        sourceWarehouse: null,
                        destWarehouse: destWarehouseName,
                        transferQty: 0
                    });
                }
                else if (row.type === 'STOCK_PERMIT_OUT') {
                    // Vehicle Loads are now REAL deductions (not floating)
                    const isCarLoad = row.description && row.description.includes('تحميل سيارة');
                    if (isCarLoad) {
                        // Show as real OUT (deduction from warehouse)
                        movements.push({
                            id: row.id,
                            date: row.date,
                            type: 'STOCK_PERMIT_OUT',
                            docNumber: row.docNumber || row.id,
                            description: `تحميل سيارة: نقل من ${sourceWarehouseName} ← إلى مخازن السيارات`,
                            inQty: 0,
                            outQty: row.quantity, // Count as real deduction
                            transferQty: 0,
                            balance: 0,
                            warehouseId: row.sourceWarehouseId,
                            warehouseName: sourceWarehouseName,
                            sourceWarehouse: sourceWarehouseName,
                            destWarehouse: 'مخازن السيارات'
                        });
                    }
                    else {
                        movements.push({
                            id: row.id,
                            date: row.date,
                            type: row.type,
                            docNumber: row.docNumber || row.id,
                            description: row.description || `إذن صرف من ${sourceWarehouseName}`,
                            inQty: 0,
                            outQty: row.quantity,
                            balance: 0,
                            warehouseId: row.sourceWarehouseId,
                            warehouseName: sourceWarehouseName,
                            sourceWarehouse: sourceWarehouseName,
                            destWarehouse: null,
                            transferQty: 0
                        });
                    }
                }
                else if (row.type === 'STOCK_TRANSFER') {
                    // For global view, show transfer as TWO separate entries: OUT from source, IN to dest
                    // This shows the complete picture of where items moved FROM and TO
                    movements.push({
                        id: `${row.id}-OUT`,
                        date: row.date,
                        type: 'STOCK_TRANSFER',
                        docNumber: row.docNumber || row.id,
                        description: `تحويل فروع: صادر من ${sourceWarehouseName} ← إلى ${destWarehouseName}`,
                        inQty: 0,
                        outQty: row.quantity,
                        balance: 0,
                        warehouseId: row.sourceWarehouseId,
                        warehouseName: sourceWarehouseName,
                        sourceWarehouse: sourceWarehouseName,
                        destWarehouse: destWarehouseName
                    });
                    movements.push({
                        id: `${row.id}-IN`,
                        date: row.date,
                        type: 'STOCK_TRANSFER',
                        docNumber: row.docNumber || row.id,
                        description: `تحويل فروع: وارد من ${sourceWarehouseName} ← إلى ${destWarehouseName}`,
                        inQty: row.quantity,
                        outQty: 0,
                        balance: 0,
                        warehouseId: row.destWarehouseId,
                        warehouseName: destWarehouseName,
                        sourceWarehouse: sourceWarehouseName,
                        destWarehouse: destWarehouseName
                    });
                }
            }
        });
        // Process Stock Movements (Production, Adjustments, Opening Balances)
        stockMovementRows.forEach(row => {
            var _a, _b;
            const qtyChange = parseFloat(row.qty_change) || 0;
            let inQty = 0;
            let outQty = 0;
            if (qtyChange > 0) {
                inQty = qtyChange;
            }
            else {
                outQty = Math.abs(qtyChange);
            }
            // Map movement types to readable labels
            let displayType = row.type;
            switch (row.type) {
                case 'PRODUCTION_OUTPUT':
                    displayType = 'إنتاج تام';
                    break;
                case 'PRODUCTION_USE':
                    displayType = 'استخدام إنتاج';
                    break;
                case 'OPENING_BALANCE':
                    displayType = 'رصيد افتتاحي';
                    break;
                case 'ADJUSTMENT':
                    displayType = 'تعديل';
                    break;
                case 'SCRAP':
                    displayType = 'هالك';
                    break;
                case 'TRANSFER_IN':
                    displayType = 'تحويل وارد';
                    break;
                case 'TRANSFER_OUT':
                    displayType = 'تحويل صادر';
                    break;
                // Invoice-related movement types (now primary source)
                case 'PURCHASE':
                    displayType = 'فاتورة شراء';
                    break;
                case 'SALE':
                    displayType = 'فاتورة بيع';
                    break;
                case 'RETURN_SALE':
                    displayType = 'مرتجع مبيعات';
                    break;
                case 'RETURN_PURCHASE':
                    displayType = 'مرتجع مشتريات';
                    break;
            }
            // Vehicle Loads are now REAL deductions (not floating)
            // They deduct from the source warehouse immediately
            const isVehicleLoad = (row.type === 'TRANSFER_OUT') &&
                (((_a = row.description) === null || _a === void 0 ? void 0 : _a.includes('تحميل سيارة')) || ((_b = row.docNumber) === null || _b === void 0 ? void 0 : _b.includes('VEHICLE_LOAD')));
            let transferQty = 0;
            if (isVehicleLoad) {
                // Show as normal TRANSFER_OUT with actual deduction
                displayType = 'تحميل سيارة'; // Show clear label
                row.description = `تحميل سيارة: نقل من المخزن ← إلى مخازن السيارات`;
                // outQty is already set from qty_change - DON'T zero it out
                // This will properly deduct from the running balance
            }
            let warehouseName = row.warehouse_id ? warehouseMap[row.warehouse_id] : 'الكل';
            // Van Sales: Show in movement card but DON'T affect warehouse balance
            // Van sales deduct from VEHICLE inventory, not warehouse
            // The vehicle load already deducted from warehouse when items were loaded
            const isVanSale = (row.reference_type === 'VAN_SALE') ||
                (row.warehouse_id === null && (String(row.type) === 'SALE' || (row.notes && row.notes.includes('بيع متنقل'))));
            if (isVanSale) {
                warehouseName = 'مخازن السيارات';
                // Zero out the qty so it doesn't affect running balance in global view
                // These items were already deducted when loaded onto vehicle
                outQty = 0;
                inQty = 0;
            }
            movements.push({
                id: `SM-${row.id}`,
                date: row.date,
                type: displayType,
                docNumber: row.docNumber,
                description: row.description || displayType,
                inQty,
                outQty,
                transferQty,
                balance: 0,
                warehouseId: row.warehouse_id,
                warehouseName: warehouseName,
                sourceWarehouse: null,
                destWarehouse: null
            });
        });
        // Sort: Oldest First to calculate running balance
        // Use deterministic ordering: date, then numeric ID
        movements.sort((a, b) => {
            // Primary: Sort by date
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0)
                return dateDiff;
            // Secondary: Extract numeric ID for consistent ordering
            const numA = parseInt(String(a.id).replace(/\D/g, '')) || 0;
            const numB = parseInt(String(b.id).replace(/\D/g, '')) || 0;
            return numA - numB;
        });
        // Calculate Running Balance
        let runningBalance = 0;
        movements.forEach(m => {
            runningBalance = runningBalance + m.inQty - m.outQty;
            m.balance = runningBalance;
        });
        // Return Newest First (Reverse)
        res.json(movements.reverse());
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getStockMovementsByProduct');
    }
});
exports.getProductMovementHistory = getProductMovementHistory;
// Create stock movement (manual adjustment)
const createStockMovement = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        const { productId, warehouseId, qtyChange, movementType, referenceType, referenceId, unitCost, notes, createdBy } = req.body;
        // Validate product exists
        const [productRows] = yield connection.query('SELECT id, stock, cost FROM products WHERE id = ?', [productId]);
        if (productRows.length === 0) {
            throw new Error('Product not found');
        }
        const product = productRows[0];
        // Insert movement
        yield connection.query(`
            INSERT INTO stock_movements (
                product_id, warehouse_id, qty_change, movement_type,
                reference_type, reference_id, unit_cost, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            productId,
            warehouseId || null,
            qtyChange,
            movementType,
            referenceType || null,
            referenceId || null,
            unitCost || product.cost,
            notes || null,
            createdBy || null
        ]);
        // Update product stock (global level)
        yield connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [qtyChange, productId]);
        // =====================================================
        // UPDATE WAREHOUSE-LEVEL STOCK (product_stocks table)
        // This ensures warehouse-specific stock reports are accurate
        // =====================================================
        if (warehouseId) {
            yield connection.query(`
                INSERT INTO product_stocks (id, productId, warehouseId, stock)
                VALUES (UUID(), ?, ?, ?)
                ON DUPLICATE KEY UPDATE stock = stock + ?
            `, [productId, warehouseId, qtyChange, qtyChange]);
            console.log(`📦 Warehouse stock updated: ${productId} in ${warehouseId} ${qtyChange > 0 ? '+' : ''}${qtyChange}`);
        }
        else {
            // If no warehouse specified, try to use default warehouse
            const [defaultWarehouse] = yield connection.query('SELECT id FROM warehouses WHERE isDefault = 1 OR isActive = 1 LIMIT 1');
            const defaultWhId = (_a = defaultWarehouse[0]) === null || _a === void 0 ? void 0 : _a.id;
            if (defaultWhId) {
                yield connection.query(`
                    INSERT INTO product_stocks (id, productId, warehouseId, stock)
                    VALUES (UUID(), ?, ?, ?)
                    ON DUPLICATE KEY UPDATE stock = stock + ?
                `, [productId, defaultWhId, qtyChange, qtyChange]);
                console.log(`📦 Warehouse stock updated (default): ${productId} in ${defaultWhId} ${qtyChange > 0 ? '+' : ''}${qtyChange}`);
            }
        }
        // Note: Product cost is now FIXED and only changes when manually edited in Product Management (إدارة المنتجات)
        // No automatic averaging - the cost field is the single source of truth
        yield connection.commit();
        res.json({ message: 'Stock movement created successfully' });
    }
    catch (error) {
        yield connection.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'createStockMovement');
    }
    finally {
        connection.release();
    }
});
exports.createStockMovement = createStockMovement;
// Reconcile stock
const reconcileStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get all products with their calculated stock from movements
        const [products] = yield db_1.pool.query(`
            SELECT p.id, p.name, p.sku, p.stock as current_stock,
                   COALESCE(SUM(sm.qty_change), 0) as calculated_stock
            FROM products p
            LEFT JOIN stock_movements sm ON p.id = sm.product_id
            GROUP BY p.id, p.name, p.sku, p.stock
        `);
        // Find discrepancies
        const discrepancies = products
            .map((p) => ({
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            currentStock: p.current_stock,
            calculatedStock: p.calculated_stock,
            difference: p.current_stock - p.calculated_stock
        }))
            .filter((p) => Math.abs(p.difference) > 0.001); // Ignore tiny floating point differences
        res.json({
            totalProducts: products.length,
            discrepanciesFound: discrepancies.length,
            discrepancies
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'reconcileStock');
    }
});
exports.reconcileStock = reconcileStock;
// Get movement statistics
const getMovementStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate } = req.query;
        let query = `
            SELECT 
                movement_type,
                COUNT(*) as count,
                SUM(ABS(qty_change)) as total_quantity,
                SUM(ABS(qty_change) * COALESCE(unit_cost, 0)) as total_value
            FROM stock_movements
            WHERE 1=1
        `;
        const params = [];
        if (startDate) {
            query += ' AND movement_date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND movement_date <= ?';
            params.push(endDate);
        }
        query += ' GROUP BY movement_type';
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching movement stats:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getMovementStats = getMovementStats;
