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
exports.deleteStockPermit = exports.updateStockPermit = exports.createStockPermit = exports.getStockPermitById = exports.getStockPermits = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const auditController_1 = require("./auditController");
const errorHandler_1 = require("../utils/errorHandler");
// Get all stock permits with pagination
const getStockPermits = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        // Pagination parameters - default to ALL (99999) when limit not specified
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 99999; // Show all by default
        const offset = (page - 1) * limit;
        // Filter parameters
        const type = req.query.type; // PERMIT_IN, PERMIT_OUT, TRANSFER
        const warehouseId = req.query.warehouseId;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const search = req.query.search;
        // Build WHERE clause
        let whereConditions = [];
        let params = [];
        if (type) {
            whereConditions.push('type = ?');
            params.push(type);
        }
        if (warehouseId) {
            whereConditions.push('(warehouseId = ? OR toWarehouseId = ?)');
            params.push(warehouseId, warehouseId);
        }
        if (startDate) {
            whereConditions.push('date >= ?');
            params.push(startDate);
        }
        if (endDate) {
            whereConditions.push('date <= ?');
            params.push(endDate);
        }
        if (search) {
            whereConditions.push('(id LIKE ? OR notes LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }
        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';
        // Get total count
        const [countResult] = yield conn.query(`SELECT COUNT(*) as total FROM stock_permits ${whereClause}`, params);
        const total = countResult[0].total;
        // Get paginated permits
        const [permits] = yield conn.query(`SELECT * FROM stock_permits ${whereClause} ORDER BY date DESC, createdAt DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        // Get items for each permit (batch query for better performance)
        if (permits.length > 0) {
            const permitIds = permits.map(p => p.id);
            const [allItems] = yield conn.query(`SELECT * FROM stock_permit_items WHERE permitId IN (?)`, [permitIds]);
            // Map items to their permits
            for (const permit of permits) {
                permit.items = allItems.filter(item => item.permitId === permit.id);
            }
        }
        res.json({
            permits,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Error fetching stock permits:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'stock permits');
    }
    finally {
        conn.release();
    }
});
exports.getStockPermits = getStockPermits;
// Get single stock permit by ID
const getStockPermitById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const conn = yield (0, db_1.getConnection)();
    try {
        const [permits] = yield conn.query('SELECT * FROM stock_permits WHERE id = ?', [id]);
        if (permits.length === 0) {
            return res.status(404).json({ message: 'Stock permit not found' });
        }
        const permit = permits[0];
        const [items] = yield conn.query('SELECT productId, productName, quantity, cost FROM stock_permit_items WHERE permitId = ?', [id]);
        permit.items = items;
        res.json(permit);
    }
    catch (error) {
        console.error('Error fetching stock permit:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'stock permit');
    }
    finally {
        conn.release();
    }
});
exports.getStockPermitById = getStockPermitById;
// Create new stock permit
const createStockPermit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const { id, date, type, sourceWarehouseId, destWarehouseId, description, items } = req.body;
    if (!id || !date || !type || !items || items.length === 0) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    const conn = yield (0, db_1.getConnection)();
    try {
        yield conn.beginTransaction();
        // Insert permit
        // Use authenticated user if available, otherwise fallback to body
        // @ts-ignore
        const createdBy = req.user ? req.user.name : (req.body.user || 'System');
        yield conn.query('INSERT INTO stock_permits (id, date, type, sourceWarehouseId, destWarehouseId, description, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, date, type, sourceWarehouseId || null, destWarehouseId || null, description, createdBy]);
        // Insert items and update stock
        // Insert items and update stock
        for (const item of items) {
            // Ensure strict 5-decimal precision
            const qty = Number(Number(item.quantity).toFixed(5));
            const cost = Number(Number(item.cost || 0).toFixed(2));
            yield conn.query('INSERT INTO stock_permit_items (permitId, productId, productName, quantity, cost) VALUES (?, ?, ?, ?, ?)', [id, item.productId, item.productName || item.name, qty, cost]);
            // Update Product Stock
            if (type === 'STOCK_PERMIT_IN' && destWarehouseId) {
                // Increase stock in destination
                yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) 
                     VALUES (?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE stock = ROUND(stock + ?, 5)`, [(0, uuid_1.v4)(), item.productId, destWarehouseId, qty, qty]);
            }
            else if (type === 'STOCK_PERMIT_OUT' && sourceWarehouseId) {
                // FIX: Get proper initial stock for new warehouse record instead of using negative value
                const [existingStock] = yield conn.query('SELECT id FROM product_stocks WHERE productId = ? AND warehouseId = ?', [item.productId, sourceWarehouseId]);
                if (existingStock.length > 0) {
                    // Record exists, just decrement
                    yield conn.query(`UPDATE product_stocks SET stock = ROUND(stock - ?, 5) WHERE productId = ? AND warehouseId = ?`, [qty, item.productId, sourceWarehouseId]);
                }
                else {
                    // Need to create - get product's global stock and deduct other warehouses
                    const [productResult] = yield conn.query('SELECT stock FROM products WHERE id = ?', [item.productId]);
                    const globalStock = Number(((_a = productResult[0]) === null || _a === void 0 ? void 0 : _a.stock) || 0);
                    const [otherWarehouses] = yield conn.query('SELECT SUM(stock) as total FROM product_stocks WHERE productId = ? AND warehouseId != ?', [item.productId, sourceWarehouseId]);
                    const otherTotal = Number(((_b = otherWarehouses[0]) === null || _b === void 0 ? void 0 : _b.total) || 0);
                    const initialStock = Number((globalStock - otherTotal - qty).toFixed(5));
                    yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) VALUES (?, ?, ?, ?)`, [(0, uuid_1.v4)(), item.productId, sourceWarehouseId, initialStock]);
                }
            }
            else if (type === 'STOCK_TRANSFER' && sourceWarehouseId && destWarehouseId) {
                // FIX: Get proper initial stock for new source warehouse record
                const [existingSourceStock] = yield conn.query('SELECT id FROM product_stocks WHERE productId = ? AND warehouseId = ?', [item.productId, sourceWarehouseId]);
                if (existingSourceStock.length > 0) {
                    // Record exists, just decrement
                    yield conn.query(`UPDATE product_stocks SET stock = ROUND(stock - ?, 5) WHERE productId = ? AND warehouseId = ?`, [qty, item.productId, sourceWarehouseId]);
                }
                else {
                    // Need to create - get product's global stock and deduct other warehouses
                    const [productResult] = yield conn.query('SELECT stock FROM products WHERE id = ?', [item.productId]);
                    const globalStock = Number(((_c = productResult[0]) === null || _c === void 0 ? void 0 : _c.stock) || 0);
                    const [otherWarehouses] = yield conn.query('SELECT SUM(stock) as total FROM product_stocks WHERE productId = ? AND warehouseId != ?', [item.productId, sourceWarehouseId]);
                    const otherTotal = Number(((_d = otherWarehouses[0]) === null || _d === void 0 ? void 0 : _d.total) || 0);
                    const initialStock = Number((globalStock - otherTotal - qty).toFixed(5));
                    yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) VALUES (?, ?, ?, ?)`, [(0, uuid_1.v4)(), item.productId, sourceWarehouseId, initialStock]);
                }
                // Increase stock in destination
                yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) 
                     VALUES (?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE stock = ROUND(stock + ?, 5)`, [(0, uuid_1.v4)(), item.productId, destWarehouseId, qty, qty]);
            }
        }
        yield conn.commit();
        // Log audit trail
        const user = req.body.user || 'System';
        const itemCount = items.length;
        yield (0, auditController_1.logAction)(user, 'INVENTORY', 'CREATE_PERMIT', `Created ${type} Permit #${id.substring(0, 8)}`, `Items: ${itemCount}, Desc: ${description || 'N/A'}`);
        // Fetch the created permit with items
        const [createdPermit] = yield conn.query('SELECT * FROM stock_permits WHERE id = ?', [id]);
        const [createdItems] = yield conn.query('SELECT productId, productName, quantity, cost FROM stock_permit_items WHERE permitId = ?', [id]);
        res.status(201).json(Object.assign(Object.assign({}, createdPermit[0]), { items: createdItems }));
        // Broadcast Real-time Update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'stock-permits', updatedBy: createdBy });
        }
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error creating stock permit:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'creating stock permit');
    }
    finally {
        conn.release();
    }
});
exports.createStockPermit = createStockPermit;
// Update stock permit (Admin only)
const updateStockPermit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const { id } = req.params;
    const { date, description, items } = req.body;
    const conn = yield (0, db_1.getConnection)();
    try {
        yield conn.beginTransaction();
        // Check if permit exists
        const [permits] = yield conn.query('SELECT * FROM stock_permits WHERE id = ?', [id]);
        if (permits.length === 0) {
            yield conn.rollback();
            return res.status(404).json({ message: 'Stock permit not found' });
        }
        const permit = permits[0];
        // Get old items to reverse stock
        const [oldItems] = yield conn.query('SELECT productId, quantity FROM stock_permit_items WHERE permitId = ?', [id]);
        // STEP 1: Reverse OLD Stock Updates
        for (const item of oldItems) {
            if (permit.type === 'STOCK_PERMIT_IN' && permit.destWarehouseId) {
                // Was IN, so decrease stock in destination
                yield conn.query(`UPDATE product_stocks SET stock = stock - ? WHERE productId = ? AND warehouseId = ?`, [item.quantity, item.productId, permit.destWarehouseId]);
            }
            else if (permit.type === 'STOCK_PERMIT_OUT' && permit.sourceWarehouseId) {
                // Was OUT, so increase stock in source
                yield conn.query(`UPDATE product_stocks SET stock = stock + ? WHERE productId = ? AND warehouseId = ?`, [item.quantity, item.productId, permit.sourceWarehouseId]);
            }
            else if (permit.type === 'STOCK_TRANSFER' && permit.sourceWarehouseId && permit.destWarehouseId) {
                // Was TRANSFER - reverse both
                yield conn.query(`UPDATE product_stocks SET stock = stock + ? WHERE productId = ? AND warehouseId = ?`, [item.quantity, item.productId, permit.sourceWarehouseId]);
                yield conn.query(`UPDATE product_stocks SET stock = stock - ? WHERE productId = ? AND warehouseId = ?`, [item.quantity, item.productId, permit.destWarehouseId]);
            }
        }
        // STEP 2: Delete old items
        yield conn.query('DELETE FROM stock_permit_items WHERE permitId = ?', [id]);
        // STEP 3: Update permit header
        yield conn.query('UPDATE stock_permits SET date = ?, description = ?, updatedAt = NOW() WHERE id = ?', [date || permit.date, description !== undefined ? description : permit.description, id]);
        // STEP 4: Insert new items and apply NEW stock changes
        // STEP 4: Insert new items and apply NEW stock changes
        if (items && items.length > 0) {
            for (const item of items) {
                // Ensure strict 5-decimal precision
                const qty = Number(Number(item.quantity).toFixed(5));
                const cost = Number(Number(item.cost || 0).toFixed(2));
                yield conn.query('INSERT INTO stock_permit_items (permitId, productId, productName, quantity, cost) VALUES (?, ?, ?, ?, ?)', [id, item.productId, item.productName || item.name, qty, cost]);
                // Apply new stock changes
                if (permit.type === 'STOCK_PERMIT_IN' && permit.destWarehouseId) {
                    yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) 
                         VALUES (?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE stock = ROUND(stock + ?, 5)`, [(0, uuid_1.v4)(), item.productId, permit.destWarehouseId, qty, qty]);
                }
                else if (permit.type === 'STOCK_PERMIT_OUT' && permit.sourceWarehouseId) {
                    // FIX: Check if record exists before INSERT
                    const [existingStock] = yield conn.query('SELECT id FROM product_stocks WHERE productId = ? AND warehouseId = ?', [item.productId, permit.sourceWarehouseId]);
                    if (existingStock.length > 0) {
                        yield conn.query(`UPDATE product_stocks SET stock = ROUND(stock - ?, 5) WHERE productId = ? AND warehouseId = ?`, [qty, item.productId, permit.sourceWarehouseId]);
                    }
                    else {
                        const [productResult] = yield conn.query('SELECT stock FROM products WHERE id = ?', [item.productId]);
                        const globalStock = Number(((_a = productResult[0]) === null || _a === void 0 ? void 0 : _a.stock) || 0);
                        const [otherWarehouses] = yield conn.query('SELECT SUM(stock) as total FROM product_stocks WHERE productId = ? AND warehouseId != ?', [item.productId, permit.sourceWarehouseId]);
                        const otherTotal = Number(((_b = otherWarehouses[0]) === null || _b === void 0 ? void 0 : _b.total) || 0);
                        const initialStock = Number((globalStock - otherTotal - qty).toFixed(5));
                        yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) VALUES (?, ?, ?, ?)`, [(0, uuid_1.v4)(), item.productId, permit.sourceWarehouseId, initialStock]);
                    }
                }
                else if (permit.type === 'STOCK_TRANSFER' && permit.sourceWarehouseId && permit.destWarehouseId) {
                    // FIX: Check if source record exists before INSERT
                    const [existingSourceStock] = yield conn.query('SELECT id FROM product_stocks WHERE productId = ? AND warehouseId = ?', [item.productId, permit.sourceWarehouseId]);
                    if (existingSourceStock.length > 0) {
                        yield conn.query(`UPDATE product_stocks SET stock = ROUND(stock - ?, 5) WHERE productId = ? AND warehouseId = ?`, [qty, item.productId, permit.sourceWarehouseId]);
                    }
                    else {
                        const [productResult] = yield conn.query('SELECT stock FROM products WHERE id = ?', [item.productId]);
                        const globalStock = Number(((_c = productResult[0]) === null || _c === void 0 ? void 0 : _c.stock) || 0);
                        const [otherWarehouses] = yield conn.query('SELECT SUM(stock) as total FROM product_stocks WHERE productId = ? AND warehouseId != ?', [item.productId, permit.sourceWarehouseId]);
                        const otherTotal = Number(((_d = otherWarehouses[0]) === null || _d === void 0 ? void 0 : _d.total) || 0);
                        const initialStock = Number((globalStock - otherTotal - qty).toFixed(5));
                        yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) VALUES (?, ?, ?, ?)`, [(0, uuid_1.v4)(), item.productId, permit.sourceWarehouseId, initialStock]);
                    }
                    yield conn.query(`INSERT INTO product_stocks (id, productId, warehouseId, stock) 
                         VALUES (?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE stock = ROUND(stock + ?, 5)`, [(0, uuid_1.v4)(), item.productId, permit.destWarehouseId, qty, qty]);
                }
            }
        }
        yield conn.commit();
        // Log audit trail
        // @ts-ignore
        const user = req.user ? req.user.name : (req.body.user || 'System');
        yield (0, auditController_1.logAction)(user, 'INVENTORY', 'UPDATE_PERMIT', `Updated ${permit.type} Permit #${id.substring(0, 8)}`, `Items: ${(items === null || items === void 0 ? void 0 : items.length) || 0}`);
        // Fetch updated permit
        const [updatedPermit] = yield conn.query('SELECT * FROM stock_permits WHERE id = ?', [id]);
        const [updatedItems] = yield conn.query('SELECT productId, productName, quantity, cost FROM stock_permit_items WHERE permitId = ?', [id]);
        res.json(Object.assign(Object.assign({}, updatedPermit[0]), { items: updatedItems }));
        // Broadcast Real-time Update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'stock-permits', updatedBy: user });
        }
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error updating stock permit:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'updating stock permit');
    }
    finally {
        conn.release();
    }
});
exports.updateStockPermit = updateStockPermit;
// Delete stock permit
const deleteStockPermit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const conn = yield (0, db_1.getConnection)();
    try {
        yield conn.beginTransaction();
        // Check if permit exists
        const [permits] = yield conn.query('SELECT * FROM stock_permits WHERE id = ?', [id]);
        if (permits.length === 0) {
            yield conn.rollback();
            return res.status(404).json({ message: 'Stock permit not found' });
        }
        const permit = permits[0];
        // Get items to reverse stock
        const [items] = yield conn.query('SELECT productId, quantity FROM stock_permit_items WHERE permitId = ?', [id]);
        // Reverse Stock Updates
        for (const item of items) {
            if (permit.type === 'STOCK_PERMIT_IN' && permit.destWarehouseId) {
                // Was IN, so decrease stock in destination
                yield conn.query(`UPDATE product_stocks SET stock = stock - ? WHERE productId = ? AND warehouseId = ?`, [item.quantity, item.productId, permit.destWarehouseId]);
            }
            else if (permit.type === 'STOCK_PERMIT_OUT' && permit.sourceWarehouseId) {
                // Was OUT, so increase stock in source
                yield conn.query(`UPDATE product_stocks SET stock = stock + ? WHERE productId = ? AND warehouseId = ?`, [item.quantity, item.productId, permit.sourceWarehouseId]);
            }
            else if (permit.type === 'STOCK_TRANSFER' && permit.sourceWarehouseId && permit.destWarehouseId) {
                // Was TRANSFER
                // 1. Increase stock in source (Reverse OUT)
                yield conn.query(`UPDATE product_stocks SET stock = stock + ? WHERE productId = ? AND warehouseId = ?`, [item.quantity, item.productId, permit.sourceWarehouseId]);
                // 2. Decrease stock in destination (Reverse IN)
                yield conn.query(`UPDATE product_stocks SET stock = stock - ? WHERE productId = ? AND warehouseId = ?`, [item.quantity, item.productId, permit.destWarehouseId]);
            }
        }
        // Delete items (will cascade, but being explicit)
        yield conn.query('DELETE FROM stock_permit_items WHERE permitId = ?', [id]);
        // Delete permit
        yield conn.query('DELETE FROM stock_permits WHERE id = ?', [id]);
        yield conn.commit();
        // Log audit trail
        const user = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.user) || 'System';
        yield (0, auditController_1.logAction)(user, 'INVENTORY', 'DELETE_PERMIT', `Deleted ${permit.type} Permit #${id.substring(0, 8)}`, `Type: ${permit.type}`);
        res.json({ message: 'Stock permit deleted successfully', id });
        // Broadcast Real-time Deletion
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:deleted', { entityType: 'stock-permits', entityId: id, deletedBy: user });
        }
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error deleting stock permit:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'deleting stock permit');
    }
    finally {
        conn.release();
    }
});
exports.deleteStockPermit = deleteStockPermit;
