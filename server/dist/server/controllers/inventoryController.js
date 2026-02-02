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
exports.getInventoryFlowReport = exports.recalculateStock = exports.deleteStockTakingSession = exports.updateStockTakingSession = exports.createStockTakingSession = exports.getStockTakingSessions = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const errorHandler_1 = require("../utils/errorHandler");
const getStockTakingSessions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [sessions] = yield db_1.pool.query('SELECT * FROM stock_taking_sessions ORDER BY date DESC');
        const sessionsWithItems = yield Promise.all(sessions.map((session) => __awaiter(void 0, void 0, void 0, function* () {
            const [items] = yield db_1.pool.query('SELECT * FROM stock_taking_items WHERE sessionId = ?', [session.id]);
            return Object.assign(Object.assign({}, session), { items: items });
        })));
        res.json(sessionsWithItems);
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getStockTakingSessions = getStockTakingSessions;
const createStockTakingSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const session = req.body;
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        const sessionId = session.id || (0, uuid_1.v4)();
        yield conn.query('INSERT INTO stock_taking_sessions (id, date, warehouseId, status) VALUES (?, ?, ?, ?)', [sessionId, session.date, session.warehouseId, session.status]);
        if (session.items && session.items.length > 0) {
            for (const item of session.items) {
                yield conn.query(`INSERT INTO stock_taking_items (sessionId, productId, systemStock, actualStock, cost, touched)
                    VALUES (?, ?, ?, ?, ?, ?)`, [sessionId, item.productId, item.systemStock, item.actualStock, item.cost, item.touched]);
            }
        }
        yield conn.commit();
        res.status(201).json(Object.assign(Object.assign({}, session), { id: sessionId }));
    }
    catch (error) {
        yield conn.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        conn.release();
    }
});
exports.createStockTakingSession = createStockTakingSession;
const updateStockTakingSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const session = req.body;
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        yield conn.query('UPDATE stock_taking_sessions SET date=?, warehouseId=?, status=? WHERE id=?', [session.date, session.warehouseId, session.status, id]);
        // Delete existing items and re-insert (simplest for now)
        yield conn.query('DELETE FROM stock_taking_items WHERE sessionId = ?', [id]);
        if (session.items && session.items.length > 0) {
            for (const item of session.items) {
                yield conn.query(`INSERT INTO stock_taking_items (sessionId, productId, systemStock, actualStock, cost, touched)
                    VALUES (?, ?, ?, ?, ?, ?)`, [id, item.productId, item.systemStock, item.actualStock, item.cost, item.touched]);
            }
        }
        yield conn.commit();
        res.json(session);
    }
    catch (error) {
        yield conn.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        conn.release();
    }
});
exports.updateStockTakingSession = updateStockTakingSession;
const deleteStockTakingSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM stock_taking_sessions WHERE id = ?', [id]);
        res.json({ message: 'Session deleted' });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.deleteStockTakingSession = deleteStockTakingSession;
const recalculateStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        // Get all valid warehouse IDs first (to avoid FK constraint errors on deleted warehouses)
        const [validWarehouses] = yield conn.query('SELECT id FROM warehouses');
        const validWarehouseIds = new Set(validWarehouses.map(w => w.id));
        // Helper function to check if warehouse is valid
        const isValidWarehouse = (warehouseId) => {
            return !!warehouseId && validWarehouseIds.has(warehouseId);
        };
        // 1. Clear current stock
        yield conn.query('TRUNCATE TABLE product_stocks');
        // 2. Process Stock Movements (The Single Source of Truth for most operations)
        // FIX: Exclude Van Sales from Warehouse Stocks (they are sold from car, not warehouse)
        // NOTE: Vehicle Loads (TRANSFER_OUT to vehicles) are now INCLUDED as real deductions
        const [stockMovements] = yield conn.query(`
            SELECT product_id, warehouse_id, SUM(qty_change) as total_change
            FROM stock_movements
            WHERE 
                NOT (movement_type = 'SALE' AND reference_type = 'VAN_SALE')
            GROUP BY product_id, warehouse_id
            HAVING SUM(qty_change) != 0
        `);
        // DEBUG: Log stock movements for product containing "1002" or "كاتشاب"
        console.log(`📊 [recalculateStock] Total stock_movements groups: ${stockMovements.length}`);
        for (const m of stockMovements) {
            console.log(`   - Product: ${(_a = m.product_id) === null || _a === void 0 ? void 0 : _a.substring(0, 8)}, Warehouse: ${((_b = m.warehouse_id) === null || _b === void 0 ? void 0 : _b.substring(0, 8)) || 'NULL'}, Change: ${m.total_change}`);
        }
        for (const movement of stockMovements) {
            // Skip movements with invalid/deleted warehouses
            if (!isValidWarehouse(movement.warehouse_id))
                continue;
            if (!movement.product_id)
                continue;
            const change = parseFloat(movement.total_change) || 0;
            if (change !== 0) {
                yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) 
                     VALUES (?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE stock = stock + ?`, [(0, uuid_1.v4)(), movement.product_id, movement.warehouse_id, change, change]);
            }
        }
        // 3. Process Stock Permits (In/Out/Transfer) - These are NOT recorded in stock_movements!
        // STOCK_PERMIT_IN adds stock to destination warehouse
        const [permitsIn] = yield conn.query(`
            SELECT spi.productId, sp.destWarehouseId as warehouseId, SUM(spi.quantity) as total_change
            FROM stock_permit_items spi
            JOIN stock_permits sp ON spi.permitId = sp.id
            WHERE sp.type = 'STOCK_PERMIT_IN'
            GROUP BY spi.productId, sp.destWarehouseId
            HAVING SUM(spi.quantity) != 0
        `);
        for (const permit of permitsIn) {
            if (!isValidWarehouse(permit.warehouseId))
                continue;
            if (!permit.productId)
                continue;
            const change = parseFloat(permit.total_change) || 0;
            if (change !== 0) {
                yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) 
                     VALUES (?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE stock = stock + ?`, [(0, uuid_1.v4)(), permit.productId, permit.warehouseId, change, change]);
            }
        }
        // STOCK_PERMIT_OUT removes stock from source warehouse
        const [permitsOut] = yield conn.query(`
            SELECT spi.productId, sp.sourceWarehouseId as warehouseId, SUM(spi.quantity) as total_change
            FROM stock_permit_items spi
            JOIN stock_permits sp ON spi.permitId = sp.id
            WHERE sp.type = 'STOCK_PERMIT_OUT'
            GROUP BY spi.productId, sp.sourceWarehouseId
            HAVING SUM(spi.quantity) != 0
        `);
        for (const permit of permitsOut) {
            if (!isValidWarehouse(permit.warehouseId))
                continue;
            if (!permit.productId)
                continue;
            const change = parseFloat(permit.total_change) || 0;
            if (change !== 0) {
                yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) 
                     VALUES (?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE stock = stock - ?`, [(0, uuid_1.v4)(), permit.productId, permit.warehouseId, -change, change]);
            }
        }
        // STOCK_TRANSFER removes from source and adds to destination
        const [transfers] = yield conn.query(`
            SELECT spi.productId, sp.sourceWarehouseId, sp.destWarehouseId, SUM(spi.quantity) as total_change
            FROM stock_permit_items spi
            JOIN stock_permits sp ON spi.permitId = sp.id
            WHERE sp.type = 'STOCK_TRANSFER'
            GROUP BY spi.productId, sp.sourceWarehouseId, sp.destWarehouseId
            HAVING SUM(spi.quantity) != 0
        `);
        for (const transfer of transfers) {
            if (!transfer.productId)
                continue;
            const change = parseFloat(transfer.total_change) || 0;
            if (change !== 0) {
                // Remove from source
                if (isValidWarehouse(transfer.sourceWarehouseId)) {
                    yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) 
                         VALUES (?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE stock = stock - ?`, [(0, uuid_1.v4)(), transfer.productId, transfer.sourceWarehouseId, -change, change]);
                }
                // Add to destination
                if (isValidWarehouse(transfer.destWarehouseId)) {
                    yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) 
                         VALUES (?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE stock = stock + ?`, [(0, uuid_1.v4)(), transfer.productId, transfer.destWarehouseId, change, change]);
                }
            }
        }
        // 4. Process Invoice Lines (Sales, Purchases, Returns) - CRITICAL FIX!
        // EXCLUDE invoices that have stock_movements records (to avoid double-counting new invoices)
        // This matches the Movement Card logic for consistency
        const [invoiceLines] = yield conn.query(`
            SELECT 
                il.productId, 
                COALESCE(il.warehouseId, i.warehouseId) as warehouseId,
                SUM(
                    CASE 
                        WHEN i.type = 'INVOICE_PURCHASE' THEN il.quantity
                        WHEN i.type = 'RETURN_SALE' THEN il.quantity
                        WHEN i.type = 'INVOICE_SALE' THEN -il.quantity
                        WHEN i.type = 'RETURN_PURCHASE' THEN -il.quantity
                        ELSE 0 
                    END
                ) as total_change
            FROM invoice_lines il
            JOIN invoices i ON il.invoiceId = i.id
            WHERE 
                i.status NOT IN ('DRAFT', 'CANCELLED', 'VOID')
                AND COALESCE(il.warehouseId, i.warehouseId) IS NOT NULL
                AND NOT (i.type = 'INVOICE_SALE' AND (i.notes LIKE '%Van Sale%' OR i.notes LIKE '%بيع متنقل%'))
                AND NOT EXISTS (
                    SELECT 1 FROM stock_movements sm 
                    WHERE sm.reference_id = i.id 
                      AND sm.product_id = il.productId
                      AND sm.reference_type IN ('INVOICE_SALE', 'INVOICE_PURCHASE', 'RETURN_SALE', 'RETURN_PURCHASE')
                )
            GROUP BY il.productId, COALESCE(il.warehouseId, i.warehouseId)
            HAVING SUM(
                CASE 
                    WHEN i.type = 'INVOICE_PURCHASE' THEN il.quantity
                    WHEN i.type = 'RETURN_SALE' THEN il.quantity
                    WHEN i.type = 'INVOICE_SALE' THEN -il.quantity
                    WHEN i.type = 'RETURN_PURCHASE' THEN -il.quantity
                    ELSE 0 
                END
            ) != 0
        `);
        for (const line of invoiceLines) {
            if (!isValidWarehouse(line.warehouseId))
                continue;
            if (!line.productId)
                continue;
            const change = parseFloat(line.total_change) || 0;
            if (change !== 0) {
                yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) 
                     VALUES (?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE stock = stock + ?`, [(0, uuid_1.v4)(), line.productId, line.warehouseId, change, change]);
            }
        }
        console.log(`✅ Recalculated stock from ${stockMovements.length} movements, ${permitsIn.length + permitsOut.length} permits, ${transfers.length} transfers, ${invoiceLines.length} invoice lines`);
        // 5. Also update products.stock for global stock (sum of all warehouses + floating stock)
        // Include stock_movements AND invoice_lines for complete accuracy
        yield conn.query(`
            UPDATE products p
            SET stock = (
                -- Sum from stock_movements
                -- Vehicle loads ARE included (real deductions from warehouse)
                -- Van Sales are excluded (they deduct from vehicle, not warehouse)
                COALESCE((
                    SELECT SUM(qty_change)
                    FROM stock_movements sm
                    WHERE sm.product_id = p.id
                    AND NOT (sm.reference_type = 'VAN_SALE')
                ), 0)
                +
                -- Sum from invoice_lines (purchases add, sales subtract)
                COALESCE((
                    SELECT SUM(
                        CASE 
                            WHEN i.type = 'INVOICE_PURCHASE' THEN il.quantity
                            WHEN i.type = 'RETURN_SALE' THEN il.quantity
                            WHEN i.type = 'INVOICE_SALE' THEN -il.quantity
                            WHEN i.type = 'RETURN_PURCHASE' THEN -il.quantity
                            ELSE 0 
                        END
                    )
                    FROM invoice_lines il
                    JOIN invoices i ON il.invoiceId = i.id
                    WHERE il.productId = p.id
                    AND i.status NOT IN ('DRAFT', 'CANCELLED', 'VOID')
                    AND NOT (i.type = 'INVOICE_SALE' AND (i.notes LIKE '%Van Sale%' OR i.notes LIKE '%بيع متنقل%'))
                ), 0)
                +
                -- Stock permits (IN adds, OUT subtracts)
                COALESCE((
                    SELECT SUM(
                        CASE 
                            WHEN sp.type = 'STOCK_PERMIT_IN' THEN spi.quantity
                            WHEN sp.type = 'STOCK_PERMIT_OUT' THEN -spi.quantity
                            ELSE 0 
                        END
                    )
                    FROM stock_permit_items spi
                    JOIN stock_permits sp ON spi.permitId = sp.id
                    WHERE spi.productId = p.id
                ), 0)
            )
        `);
        yield conn.commit();
        res.json({ message: 'Stock recalculated successfully' });
    }
    catch (error) {
        yield conn.rollback();
        console.error("Recalculate Stock Error:", error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        conn.release();
    }
});
exports.recalculateStock = recalculateStock;
const getInventoryFlowReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate, warehouseId, categoryId } = req.query;
        console.log('Generating Flow Report:', { startDate, endDate, warehouseId, categoryId });
        // Build product query with category filter only (warehouse filtering is done via movements/stocks)
        let productQuery = 'SELECT id, name, sku, categoryId FROM products WHERE 1=1';
        const productParams = [];
        if (categoryId && categoryId !== 'ALL') {
            productQuery += ' AND categoryId = ?';
            productParams.push(categoryId);
        }
        const [products] = yield db_1.pool.query(productQuery, productParams);
        console.log(`Found ${products.length} products`);
        // Fix End Date to include the full day
        const endDateTime = `${endDate} 23:59:59`;
        // Build warehouse filter conditions for movement queries
        const warehouseFilter = warehouseId && warehouseId !== 'ALL' ? warehouseId : null;
        // 1. Opening Balance (Transactions < startDate)
        // Invoices - filter by invoice warehouse
        let invoiceOpeningQuery = `
            SELECT il.productId, 
                   SUM(CASE 
                       WHEN i.type IN ('INVOICE_PURCHASE', 'RETURN_SALE') THEN il.quantity 
                       WHEN i.type IN ('INVOICE_SALE', 'RETURN_PURCHASE') THEN -il.quantity 
                       ELSE 0 END) as qty
            FROM invoice_lines il
            JOIN invoices i ON il.invoiceId = i.id
            WHERE i.status = 'POSTED' AND i.date < ?`;
        const invoiceOpeningParams = [startDate];
        if (warehouseFilter) {
            invoiceOpeningQuery += ' AND i.warehouseId = ?';
            invoiceOpeningParams.push(warehouseFilter);
        }
        invoiceOpeningQuery += ' GROUP BY il.productId';
        const [invoiceOpening] = yield db_1.pool.query(invoiceOpeningQuery, invoiceOpeningParams);
        // Permits - filter by source/dest warehouse
        let permitOpeningQuery = `
            SELECT spi.productId,
                   SUM(CASE 
                       WHEN sp.type = 'STOCK_PERMIT_IN' THEN spi.quantity
                       WHEN sp.type = 'STOCK_PERMIT_OUT' THEN -spi.quantity
                       WHEN sp.type = 'STOCK_TRANSFER' AND sp.destWarehouseId = ? THEN spi.quantity
                       WHEN sp.type = 'STOCK_TRANSFER' AND sp.sourceWarehouseId = ? THEN -spi.quantity
                       ELSE 0 END) as qty
            FROM stock_permit_items spi
            JOIN stock_permits sp ON spi.permitId = sp.id
            WHERE sp.date < ?`;
        const permitOpeningParams = [];
        if (warehouseFilter) {
            permitOpeningParams.push(warehouseFilter, warehouseFilter);
            permitOpeningQuery += ` AND (sp.destWarehouseId = ? OR sp.sourceWarehouseId = ?)`;
            permitOpeningParams.push(warehouseFilter, warehouseFilter);
        }
        else {
            // No warehouse filter - just sum all permits
            permitOpeningQuery = `
                SELECT spi.productId,
                       SUM(CASE 
                           WHEN sp.type = 'STOCK_PERMIT_IN' THEN spi.quantity
                           WHEN sp.type = 'STOCK_PERMIT_OUT' THEN -spi.quantity
                           ELSE 0 END) as qty
                FROM stock_permit_items spi
                JOIN stock_permits sp ON spi.permitId = sp.id
                WHERE sp.date < ?`;
        }
        permitOpeningParams.push(startDate);
        permitOpeningQuery += ' GROUP BY spi.productId';
        const [permitOpening] = yield db_1.pool.query(permitOpeningQuery, permitOpeningParams);
        // Stock Movements (Production, Adjustments, Opening Balances) - filter by warehouse
        let movementOpeningQuery = `
            SELECT product_id as productId,
                   SUM(qty_change) as qty
            FROM stock_movements
            WHERE movement_date < ?`;
        const movementOpeningParams = [startDate];
        if (warehouseFilter) {
            movementOpeningQuery += ' AND warehouse_id = ?';
            movementOpeningParams.push(warehouseFilter);
        }
        movementOpeningQuery += ' GROUP BY product_id';
        const [movementOpening] = yield db_1.pool.query(movementOpeningQuery, movementOpeningParams);
        // 2. Period Movement (startDate <= date <= endDate)
        // Invoices - filter by warehouse
        let invoicePeriodQuery = `
            SELECT il.productId, 
                   SUM(CASE WHEN i.type IN ('INVOICE_PURCHASE', 'RETURN_SALE') THEN il.quantity ELSE 0 END) as inQty,
                   SUM(CASE WHEN i.type IN ('INVOICE_SALE', 'RETURN_PURCHASE') THEN il.quantity ELSE 0 END) as outQty
            FROM invoice_lines il
            JOIN invoices i ON il.invoiceId = i.id
            WHERE i.status = 'POSTED' AND i.date >= ? AND i.date <= ?`;
        const invoicePeriodParams = [startDate, endDateTime];
        if (warehouseFilter) {
            invoicePeriodQuery += ' AND i.warehouseId = ?';
            invoicePeriodParams.push(warehouseFilter);
        }
        invoicePeriodQuery += ' GROUP BY il.productId';
        const [invoicePeriod] = yield db_1.pool.query(invoicePeriodQuery, invoicePeriodParams);
        // Permits - filter by warehouse
        let permitPeriodQuery;
        const permitPeriodParams = [];
        if (warehouseFilter) {
            // For specific warehouse, track in/out correctly based on source/dest
            permitPeriodQuery = `
                SELECT spi.productId,
                       SUM(CASE 
                           WHEN sp.type = 'STOCK_PERMIT_IN' AND sp.destWarehouseId = ? THEN spi.quantity
                           WHEN sp.type = 'STOCK_TRANSFER' AND sp.destWarehouseId = ? THEN spi.quantity
                           ELSE 0 END) as inQty,
                       SUM(CASE 
                           WHEN sp.type = 'STOCK_PERMIT_OUT' AND sp.sourceWarehouseId = ? THEN spi.quantity
                           WHEN sp.type = 'STOCK_TRANSFER' AND sp.sourceWarehouseId = ? THEN spi.quantity
                           ELSE 0 END) as outQty
                FROM stock_permit_items spi
                JOIN stock_permits sp ON spi.permitId = sp.id
                WHERE sp.date >= ? AND sp.date <= ?
                  AND (sp.destWarehouseId = ? OR sp.sourceWarehouseId = ?)
                GROUP BY spi.productId`;
            permitPeriodParams.push(warehouseFilter, warehouseFilter, warehouseFilter, warehouseFilter, startDate, endDateTime, warehouseFilter, warehouseFilter);
        }
        else {
            // All warehouses - simple sum
            permitPeriodQuery = `
                SELECT spi.productId,
                       SUM(CASE WHEN sp.type = 'STOCK_PERMIT_IN' THEN spi.quantity ELSE 0 END) as inQty,
                       SUM(CASE WHEN sp.type = 'STOCK_PERMIT_OUT' THEN spi.quantity ELSE 0 END) as outQty
                FROM stock_permit_items spi
                JOIN stock_permits sp ON spi.permitId = sp.id
                WHERE sp.date >= ? AND sp.date <= ?
                GROUP BY spi.productId`;
            permitPeriodParams.push(startDate, endDateTime);
        }
        const [permitPeriod] = yield db_1.pool.query(permitPeriodQuery, permitPeriodParams);
        // Stock Movements (Production, Adjustments) - filter by warehouse
        let movementPeriodQuery = `
            SELECT product_id as productId,
                   SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END) as inQty,
                   SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE 0 END) as outQty
            FROM stock_movements
            WHERE movement_date >= ? AND movement_date <= ?`;
        const movementPeriodParams = [startDate, endDateTime];
        if (warehouseFilter) {
            movementPeriodQuery += ' AND warehouse_id = ?';
            movementPeriodParams.push(warehouseFilter);
        }
        movementPeriodQuery += ' GROUP BY product_id';
        const [movementPeriod] = yield db_1.pool.query(movementPeriodQuery, movementPeriodParams);
        // If warehouse is selected, filter to only include products that have stock in that warehouse
        let relevantProductIds = null;
        if (warehouseFilter) {
            const [warehouseStocks] = yield db_1.pool.query('SELECT DISTINCT productId FROM product_stocks WHERE warehouseId = ? AND stock != 0', [warehouseFilter]);
            const [warehouseMovements] = yield db_1.pool.query('SELECT DISTINCT product_id as productId FROM stock_movements WHERE warehouse_id = ?', [warehouseFilter]);
            relevantProductIds = new Set([
                ...warehouseStocks.map(r => r.productId),
                ...warehouseMovements.map(r => r.productId)
            ]);
        }
        // Build Maps for O(1) lookups (js-set-map-lookups best practice)
        // Opening balance Maps
        const invoiceOpeningMap = new Map(invoiceOpening.map(x => [x.productId, x.qty]));
        const permitOpeningMap = new Map(permitOpening.map(x => [x.productId, x.qty]));
        const movementOpeningMap = new Map(movementOpening.map(x => [x.productId, x.qty]));
        // Period Maps
        const invoicePeriodMap = new Map(invoicePeriod.map(x => [x.productId, x]));
        const permitPeriodMap = new Map(permitPeriod.map(x => [x.productId, x]));
        const movementPeriodMap = new Map(movementPeriod.map(x => [x.productId, x]));
        // Map results using O(1) Map lookups instead of O(n) find() calls
        const report = products
            .filter(p => {
            // If warehouse filter is set, only include products that have movements/stock in that warehouse
            if (relevantProductIds && !relevantProductIds.has(p.id)) {
                return false;
            }
            return true;
        })
            .map(p => {
            // Opening - O(1) lookups
            const invOpen = invoiceOpeningMap.get(p.id) || 0;
            const permOpen = permitOpeningMap.get(p.id) || 0;
            const movOpen = movementOpeningMap.get(p.id) || 0;
            const openingBalance = Number(invOpen) + Number(permOpen) + Number(movOpen);
            // Period - O(1) lookups
            const invPer = invoicePeriodMap.get(p.id) || { inQty: 0, outQty: 0 };
            const permPer = permitPeriodMap.get(p.id) || { inQty: 0, outQty: 0 };
            const movPer = movementPeriodMap.get(p.id) || { inQty: 0, outQty: 0 };
            const periodIn = Number(invPer.inQty) + Number(permPer.inQty) + Number(movPer.inQty);
            const periodOut = Number(invPer.outQty) + Number(permPer.outQty) + Number(movPer.outQty);
            return {
                productId: p.id,
                name: p.name,
                sku: p.sku,
                warehouseId: warehouseFilter || null,
                opening: openingBalance,
                in: periodIn,
                out: periodOut,
                closing: openingBalance + periodIn - periodOut
            };
        })
            .filter(row => {
            // Filter out products with no movement at all (all zeros)
            return row.opening !== 0 || row.in !== 0 || row.out !== 0 || row.closing !== 0;
        });
        console.log(`Generated report with ${report.length} rows`);
        res.json(report);
    }
    catch (error) {
        console.error("Error generating inventory flow report:", error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getInventoryFlowReport = getInventoryFlowReport;
