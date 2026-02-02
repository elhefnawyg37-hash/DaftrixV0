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
exports.getSalesmanRoutes = exports.updateVehicleLocation = exports.getProductPerformanceReport = exports.getVehiclePerformanceReport = exports.getVehicleLowStockAlerts = exports.deleteVehicleFuelLog = exports.createVehicleFuelLog = exports.getVehicleFuelLogs = exports.deleteVehicleMaintenance = exports.updateVehicleMaintenance = exports.createVehicleMaintenance = exports.getVehicleMaintenance = exports.deleteVehicleTarget = exports.updateVehicleTarget = exports.createVehicleTarget = exports.getVehicleTargets = exports.getCustomerVehicleHistory = exports.getDailyReport = exports.deleteSettlement = exports.getApprovedSettlements = exports.submitSettlement = exports.disputeSettlement = exports.approveSettlement = exports.updateSettlement = exports.calculateRefinedSettlementStats = exports.createSettlement = exports.getSettlements = exports.processVehicleReturn = exports.createVehicleReturn = exports.getVehicleReturns = exports.deleteCustomerVisit = exports.updateCustomerVisit = exports.createVanReturnVisit = exports.createVanSaleVisit = exports.createCustomerVisit = exports.getCustomerVisits = exports.getVehicleReport = exports.deleteOperation = exports.getOperationDetails = exports.getAllOperations = exports.getVehicleOperations = exports.unloadVehicle = exports.loadVehicle = exports.getAllVehicleInventory = exports.getVehicleInventory = exports.deleteVehicle = exports.updateVehicle = exports.createVehicle = exports.getVehicle = exports.getVehicles = void 0;
exports.debugDiscounts = exports.completeRoute = exports.startRoute = exports.deleteRouteStop = exports.markStopVisited = exports.updateRouteStop = exports.addRouteStop = exports.deleteRoute = exports.updateRoute = exports.createRoute = exports.getRoute = exports.getRoutes = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const errorHandler_1 = require("../utils/errorHandler");
// Helper: Check if user is a restricted salesman (not admin/manager)
const getUserSalesmanFilter = (req) => {
    const user = req.user;
    if (!user)
        return null;
    // Admins and managers see all
    if (user.role === 'ADMIN' || user.role === 'admin' || user.role === 'MANAGER') {
        return null;
    }
    // If user has a salesmanId, filter by it
    return user.salesmanId || null;
};
// ==========================================
// VEHICLES (السيارات)
// ==========================================
const getVehicles = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const salesmanFilter = getUserSalesmanFilter(req);
        let query = `
            SELECT v.*, 
                   s.name as salesmanName,
                   w.name as warehouseName,
                   (SELECT COUNT(*) FROM vehicle_inventory vi WHERE vi.vehicleId = v.id AND vi.quantity > 0) as itemCount,
                   (SELECT COALESCE(SUM(vi.quantity * COALESCE(p.price, 0)), 0) 
                    FROM vehicle_inventory vi 
                    LEFT JOIN products p ON vi.productId = p.id 
                    WHERE vi.vehicleId = v.id) as totalValue
            FROM vehicles v
            LEFT JOIN salesmen s ON v.salesmanId = s.id
            LEFT JOIN warehouses w ON v.warehouseId = w.id
        `;
        const params = [];
        // If user is a salesman, only show their assigned vehicles
        if (salesmanFilter) {
            query += ` WHERE v.salesmanId = ?`;
            params.push(salesmanFilter);
        }
        query += ` ORDER BY v.plateNumber`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching vehicles:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch vehicles');
    }
});
exports.getVehicles = getVehicles;
const getVehicle = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const [rows] = yield db_1.pool.query(`
            SELECT v.*, 
                   s.name as salesmanName,
                   w.name as warehouseName
            FROM vehicles v
            LEFT JOIN salesmen s ON v.salesmanId = s.id
            LEFT JOIN warehouses w ON v.warehouseId = w.id
            WHERE v.id = ?
        `, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        res.json(rows[0]);
    }
    catch (error) {
        console.error('Error fetching vehicle:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch vehicle');
    }
});
exports.getVehicle = getVehicle;
const createVehicle = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { plateNumber, name, type, capacity, salesmanId, warehouseId, status, notes } = req.body;
    if (!plateNumber) {
        return res.status(400).json({ error: 'Plate number is required' });
    }
    try {
        const id = (0, uuid_1.v4)();
        // Convert empty string to null for numeric fields
        const capacityValue = capacity === '' || capacity === undefined ? null : capacity;
        const salesmanValue = salesmanId === '' ? null : salesmanId;
        const warehouseValue = warehouseId === '' ? null : warehouseId;
        yield db_1.pool.query(`
            INSERT INTO vehicles (id, plateNumber, name, type, capacity, salesmanId, warehouseId, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, plateNumber, name, type, capacityValue, salesmanValue, warehouseValue, status || 'AVAILABLE', notes]);
        res.status(201).json({ id, message: 'Vehicle created successfully' });
    }
    catch (error) {
        console.error('Error creating vehicle:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Vehicle with this plate number already exists' });
        }
        return (0, errorHandler_1.handleControllerError)(res, error, 'create vehicle');
    }
});
exports.createVehicle = createVehicle;
const updateVehicle = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { plateNumber, name, type, capacity, salesmanId, warehouseId, status, notes } = req.body;
    try {
        // Convert empty string to null for numeric fields
        const capacityValue = capacity === '' || capacity === undefined ? null : capacity;
        const salesmanValue = salesmanId === '' ? null : salesmanId;
        const warehouseValue = warehouseId === '' ? null : warehouseId;
        yield db_1.pool.query(`
            UPDATE vehicles SET
                plateNumber = COALESCE(?, plateNumber),
                name = ?,
                type = ?,
                capacity = ?,
                salesmanId = ?,
                warehouseId = ?,
                status = COALESCE(?, status),
                notes = ?
            WHERE id = ?
        `, [plateNumber, name, type, capacityValue, salesmanValue, warehouseValue, status, notes, id]);
        res.json({ message: 'Vehicle updated successfully' });
    }
    catch (error) {
        console.error('Error updating vehicle:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update vehicle');
    }
});
exports.updateVehicle = updateVehicle;
const deleteVehicle = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        // Check if vehicle has inventory
        const [inventory] = yield db_1.pool.query('SELECT COUNT(*) as count FROM vehicle_inventory WHERE vehicleId = ? AND quantity > 0', [id]);
        if (inventory[0].count > 0) {
            return res.status(400).json({
                error: 'Cannot delete vehicle with loaded inventory. Unload items first.'
            });
        }
        yield db_1.pool.query('DELETE FROM vehicles WHERE id = ?', [id]);
        res.json({ message: 'Vehicle deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting vehicle:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete vehicle');
    }
});
exports.deleteVehicle = deleteVehicle;
// ==========================================
// VEHICLE INVENTORY (جرد السيارة)
// ==========================================
const getVehicleInventory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        // Cleanup any items with zero or negative quantities (data hygiene)
        yield db_1.pool.query('DELETE FROM vehicle_inventory WHERE vehicleId = ? AND quantity <= 0.0001', [id]);
        const [rows] = yield db_1.pool.query(`
            SELECT vi.*, 
                   p.name as productName, 
                   p.sku as productSku,
                   p.cost,
                   p.price as unitPrice,
                   (vi.quantity * COALESCE(p.price, 0)) as totalValue
            FROM vehicle_inventory vi
            LEFT JOIN products p ON vi.productId = p.id
            WHERE vi.vehicleId = ? AND vi.quantity > 0.0001
            ORDER BY p.name
        `, [id]);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching vehicle inventory:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch vehicle inventory');
    }
});
exports.getVehicleInventory = getVehicleInventory;
const getAllVehicleInventory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Cleanup any items with zero or negative quantities (data hygiene)
        yield db_1.pool.query('DELETE FROM vehicle_inventory WHERE quantity <= 0.0001');
        const [rows] = yield db_1.pool.query(`
            SELECT vi.*, 
                   v.plateNumber as vehicleName,
                   p.name as productName, 
                   p.sku as productSku,
                   p.cost,
                   (vi.quantity * COALESCE(p.price, 0)) as totalValue
            FROM vehicle_inventory vi
            LEFT JOIN vehicles v ON vi.vehicleId = v.id
            LEFT JOIN products p ON vi.productId = p.id
            WHERE vi.quantity > 0.0001
            ORDER BY v.plateNumber, p.name
        `);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching all vehicle inventory:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch vehicle inventory');
    }
});
exports.getAllVehicleInventory = getAllVehicleInventory;
// ==========================================
// VEHICLE OPERATIONS (تحميل/تفريغ)
// ==========================================
const loadVehicle = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params; // vehicleId
    const { warehouseId, items, notes } = req.body;
    const user = req.user;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items are required for loading' });
    }
    if (!warehouseId) {
        return res.status(400).json({ error: 'Warehouse is required for loading' });
    }
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        // Create operation record
        const operationId = (0, uuid_1.v4)();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        yield conn.query(`
            INSERT INTO vehicle_operations (id, vehicleId, operationType, date, warehouseId, notes, createdBy)
            VALUES (?, ?, 'LOAD', ?, ?, ?, ?)
        `, [operationId, id, now, warehouseId, notes, (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'System']);
        // Process each item
        for (const item of items) {
            const { productId, quantity, productName } = item;
            if (!productId || !quantity || quantity <= 0)
                continue;
            // Get product cost
            const [productRows] = yield conn.query('SELECT cost, name FROM products WHERE id = ?', [productId]);
            const cost = ((_a = productRows[0]) === null || _a === void 0 ? void 0 : _a.cost) || 0;
            const name = productName || ((_b = productRows[0]) === null || _b === void 0 ? void 0 : _b.name) || '';
            // Insert operation item
            yield conn.query(`
                INSERT INTO vehicle_operation_items (operationId, productId, productName, quantity, cost)
                VALUES (?, ?, ?, ?, ?)
            `, [operationId, productId, name, quantity, cost]);
            // Update vehicle inventory (upsert)
            yield conn.query(`
                INSERT INTO vehicle_inventory (id, vehicleId, productId, quantity, lastLoadDate)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    quantity = quantity + VALUES(quantity),
                    lastLoadDate = VALUES(lastLoadDate)
            `, [(0, uuid_1.v4)(), id, productId, quantity, now]);
            // Decrease warehouse stock
            yield conn.query(`
                UPDATE product_stocks 
                SET stock = stock - ? 
                WHERE productId = ? AND warehouseId = ?
            `, [quantity, productId, warehouseId]);
            // Also decrease global product stock
            yield conn.query(`
                UPDATE products SET stock = stock - ? WHERE id = ?
            `, [quantity, productId]);
            // Create stock movement record
            yield conn.query(`
                INSERT INTO stock_movements (
                    id, product_id, warehouse_id, qty_change, movement_type,
                    reference_type, reference_id, notes, movement_date
                ) VALUES (UUID(), ?, ?, ?, 'TRANSFER_OUT', 'VEHICLE_LOAD', ?, ?, ?)
            `, [productId, warehouseId, -quantity, operationId, `تحميل سيارة`, now]);
        }
        // Update vehicle status to ON_ROUTE if it was AVAILABLE
        yield conn.query(`
            UPDATE vehicles SET status = 'ON_ROUTE' WHERE id = ? AND status = 'AVAILABLE'
        `, [id]);
        yield conn.commit();
        // Broadcast real-time update to all connected clients
        const io = req.app.get('io');
        if (io) {
            // Notify vehicle inventory viewers
            io.emit('entity:changed', {
                entityType: 'vehicle-inventory',
                vehicleId: id,
                operation: 'LOAD',
                updatedBy: (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'System'
            });
            // Notify product viewers (both singular and plural for compatibility)
            io.emit('entity:changed', { entityType: 'product', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System' });
            io.emit('entity:changed', { entityType: 'products', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System' });
            // Notify stock balance report and other stock-dependent views
            io.emit('stock:updated', {
                warehouseId,
                operation: 'VEHICLE_LOAD',
                productIds: items.map((i) => i.productId),
                updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System'
            });
        }
        res.json({
            message: 'Vehicle loaded successfully',
            operationId,
            itemCount: items.length
        });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error loading vehicle:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'load vehicle');
    }
    finally {
        conn.release();
    }
});
exports.loadVehicle = loadVehicle;
const unloadVehicle = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params; // vehicleId
    const { warehouseId, items, notes } = req.body;
    const user = req.user;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items are required for unloading' });
    }
    if (!warehouseId) {
        return res.status(400).json({ error: 'Warehouse is required for unloading' });
    }
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        // Create operation record
        const operationId = (0, uuid_1.v4)();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        yield conn.query(`
            INSERT INTO vehicle_operations (id, vehicleId, operationType, date, warehouseId, notes, createdBy)
            VALUES (?, ?, 'UNLOAD', ?, ?, ?, ?)
        `, [operationId, id, now, warehouseId, notes, (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'System']);
        // Process each item
        for (const item of items) {
            const { productId, quantity, productName } = item;
            if (!productId || !quantity || quantity <= 0)
                continue;
            // Check vehicle has enough stock
            const [vehicleStock] = yield conn.query('SELECT quantity FROM vehicle_inventory WHERE vehicleId = ? AND productId = ?', [id, productId]);
            if (!vehicleStock[0] || vehicleStock[0].quantity < quantity) {
                throw new Error(`Insufficient quantity for product ${productName || productId}`);
            }
            // Get product cost
            const [productRows] = yield conn.query('SELECT cost, name FROM products WHERE id = ?', [productId]);
            const cost = ((_a = productRows[0]) === null || _a === void 0 ? void 0 : _a.cost) || 0;
            const name = productName || ((_b = productRows[0]) === null || _b === void 0 ? void 0 : _b.name) || '';
            // Insert operation item
            yield conn.query(`
                INSERT INTO vehicle_operation_items (operationId, productId, productName, quantity, cost)
                VALUES (?, ?, ?, ?, ?)
            `, [operationId, productId, name, quantity, cost]);
            // Update vehicle inventory (decrease)
            yield conn.query(`
                UPDATE vehicle_inventory 
                SET quantity = quantity - ? 
                WHERE vehicleId = ? AND productId = ?
            `, [quantity, id, productId]);
            // Increase warehouse stock
            yield conn.query(`
                INSERT INTO product_stocks (id, productId, warehouseId, stock)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)
            `, [(0, uuid_1.v4)(), productId, warehouseId, quantity]);
            // Also increase global product stock
            yield conn.query(`
                UPDATE products SET stock = stock + ? WHERE id = ?
            `, [quantity, productId]);
            // Create stock movement record
            yield conn.query(`
                INSERT INTO stock_movements (
                    id, product_id, warehouse_id, qty_change, movement_type,
                    reference_type, reference_id, notes, movement_date
                ) VALUES (UUID(), ?, ?, ?, 'TRANSFER_IN', 'VEHICLE_UNLOAD', ?, ?, ?)
            `, [productId, warehouseId, quantity, operationId, `تفريغ سيارة`, now]);
        }
        // Check if vehicle is now empty, set to AVAILABLE
        const [remainingItems] = yield conn.query('SELECT SUM(quantity) as total FROM vehicle_inventory WHERE vehicleId = ?', [id]);
        if (!remainingItems[0].total || remainingItems[0].total <= 0) {
            yield conn.query(`UPDATE vehicles SET status = 'AVAILABLE' WHERE id = ?`, [id]);
        }
        yield conn.commit();
        // Broadcast real-time update to all connected clients
        const io = req.app.get('io');
        if (io) {
            // Notify vehicle inventory viewers
            io.emit('entity:changed', {
                entityType: 'vehicle-inventory',
                vehicleId: id,
                operation: 'UNLOAD',
                updatedBy: (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'System'
            });
            // Notify product viewers (both singular and plural for compatibility)
            io.emit('entity:changed', { entityType: 'product', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System' });
            io.emit('entity:changed', { entityType: 'products', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System' });
            // Notify stock balance report and other stock-dependent views
            io.emit('stock:updated', {
                warehouseId,
                operation: 'VEHICLE_UNLOAD',
                productIds: items.map((i) => i.productId),
                updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System'
            });
        }
        res.json({
            message: 'Vehicle unloaded successfully',
            operationId,
            itemCount: items.length
        });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error unloading vehicle:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        conn.release();
    }
});
exports.unloadVehicle = unloadVehicle;
// ==========================================
// VEHICLE OPERATIONS HISTORY
// ==========================================
const getVehicleOperations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params; // vehicleId (optional via query)
    const { startDate, endDate, operationType } = req.query;
    try {
        let query = `
            SELECT vo.*, 
                   v.plateNumber as vehicleName,
                   w.name as warehouseName,
                   (SELECT COUNT(*) FROM vehicle_operation_items WHERE operationId = vo.id) as totalItems,
                   (SELECT SUM(quantity * cost) FROM vehicle_operation_items WHERE operationId = vo.id) as totalValue
            FROM vehicle_operations vo
            LEFT JOIN vehicles v ON vo.vehicleId = v.id
            LEFT JOIN warehouses w ON vo.warehouseId = w.id
            WHERE 1=1
        `;
        const params = [];
        if (id) {
            query += ` AND vo.vehicleId = ?`;
            params.push(id);
        }
        if (operationType) {
            query += ` AND vo.operationType = ?`;
            params.push(operationType);
        }
        if (startDate) {
            query += ` AND vo.date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND vo.date <= ?`;
            params.push(endDate + ' 23:59:59');
        }
        query += ` ORDER BY vo.date DESC LIMIT 100`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching vehicle operations:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch vehicle operations');
    }
});
exports.getVehicleOperations = getVehicleOperations;
const getAllOperations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { startDate, endDate, operationType, vehicleId } = req.query;
    try {
        let query = `
            SELECT vo.*, 
                   v.plateNumber as vehicleName,
                   w.name as warehouseName,
                   (SELECT COUNT(*) FROM vehicle_operation_items WHERE operationId = vo.id) as totalItems,
                   (SELECT SUM(quantity * cost) FROM vehicle_operation_items WHERE operationId = vo.id) as totalValue
            FROM vehicle_operations vo
            LEFT JOIN vehicles v ON vo.vehicleId = v.id
            LEFT JOIN warehouses w ON vo.warehouseId = w.id
            WHERE 1=1
        `;
        const params = [];
        if (vehicleId) {
            query += ` AND vo.vehicleId = ?`;
            params.push(vehicleId);
        }
        if (operationType) {
            query += ` AND vo.operationType = ?`;
            params.push(operationType);
        }
        if (startDate) {
            query += ` AND vo.date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND vo.date <= ?`;
            params.push(endDate + ' 23:59:59');
        }
        query += ` ORDER BY vo.date DESC LIMIT 200`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching all operations:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch operations');
    }
});
exports.getAllOperations = getAllOperations;
const getOperationDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { operationId } = req.params;
    try {
        // Get operation
        const [operations] = yield db_1.pool.query(`
            SELECT vo.*, 
                   v.plateNumber as vehicleName,
                   w.name as warehouseName,
                   s.name as salesmanName
            FROM vehicle_operations vo
            LEFT JOIN vehicles v ON vo.vehicleId = v.id
            LEFT JOIN warehouses w ON vo.warehouseId = w.id
            LEFT JOIN salesmen s ON v.salesmanId = s.id
            WHERE vo.id = ?
        `, [operationId]);
        if (operations.length === 0) {
            return res.status(404).json({ error: 'Operation not found' });
        }
        // Get items
        const [items] = yield db_1.pool.query(`
            SELECT voi.*, p.sku as productSku
            FROM vehicle_operation_items voi
            LEFT JOIN products p ON voi.productId = p.id
            WHERE voi.operationId = ?
        `, [operationId]);
        res.json(Object.assign(Object.assign({}, operations[0]), { items }));
    }
    catch (error) {
        console.error('Error fetching operation details:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch operation details');
    }
});
exports.getOperationDetails = getOperationDetails;
// Delete a vehicle operation (and reverse inventory changes if applicable)
const deleteOperation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { operationId } = req.params;
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        // Get operation details first (to reverse inventory changes)
        const [operations] = yield conn.query(`
            SELECT * FROM vehicle_operations WHERE id = ?
        `, [operationId]);
        if (operations.length === 0) {
            yield conn.rollback();
            return res.status(404).json({ error: 'العملية غير موجودة' });
        }
        const operation = operations[0];
        // Get operation items
        const [items] = yield conn.query(`
            SELECT * FROM vehicle_operation_items WHERE operationId = ?
        `, [operationId]);
        // Reverse inventory changes based on operation type
        for (const item of items) {
            if (operation.operationType === 'LOAD') {
                // LOAD: Added to vehicle, subtracted from warehouse
                // Reverse: Subtract from vehicle, add back to warehouse
                yield conn.query(`
                    UPDATE vehicle_inventory 
                    SET quantity = GREATEST(0, quantity - ?)
                    WHERE vehicleId = ? AND productId = ?
                `, [item.quantity, operation.vehicleId, item.productId]);
                yield conn.query(`
                    UPDATE product_stocks 
                    SET stock = stock + ?
                    WHERE productId = ? AND warehouseId = ?
                `, [item.quantity, item.productId, operation.warehouseId]);
            }
            else if (operation.operationType === 'UNLOAD') {
                // UNLOAD: Subtracted from vehicle, added to warehouse
                // Reverse: Add back to vehicle, subtract from warehouse
                yield conn.query(`
                    INSERT INTO vehicle_inventory (id, vehicleId, productId, quantity, costPrice, sellPrice)
                    VALUES (UUID(), ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE quantity = quantity + ?
                `, [operation.vehicleId, item.productId, item.quantity, item.costPrice || 0, item.sellPrice || 0, item.quantity]);
                yield conn.query(`
                    UPDATE product_stocks 
                    SET stock = GREATEST(0, stock - ?)
                    WHERE productId = ? AND warehouseId = ?
                `, [item.quantity, item.productId, operation.warehouseId]);
            }
        }
        // Delete operation items
        yield conn.query('DELETE FROM vehicle_operation_items WHERE operationId = ?', [operationId]);
        // Delete the operation itself
        yield conn.query('DELETE FROM vehicle_operations WHERE id = ?', [operationId]);
        yield conn.commit();
        console.log(`🗑️ Deleted vehicle operation ${operationId} (${operation.operationType}) with ${items.length} items`);
        res.json({ success: true, message: 'تم حذف العملية بنجاح' });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error deleting operation:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete operation');
    }
    finally {
        conn.release();
    }
});
exports.deleteOperation = deleteOperation;
// ==========================================
// REPORTS
// ==========================================
const getVehicleReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, startDate, endDate } = req.query;
    try {
        let whereClause = '1=1';
        const params = [];
        if (vehicleId) {
            whereClause += ' AND vo.vehicleId = ?';
            params.push(vehicleId);
        }
        if (startDate) {
            whereClause += ' AND vo.date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ' AND vo.date <= ?';
            params.push(endDate + ' 23:59:59');
        }
        // Summary by vehicle
        const [vehicleSummary] = yield db_1.pool.query(`
            SELECT 
                v.id,
                v.plateNumber,
                v.name,
                v.status,
                s.name as salesmanName,
                COUNT(DISTINCT CASE WHEN vo.operationType = 'LOAD' THEN vo.id END) as loadCount,
                COUNT(DISTINCT CASE WHEN vo.operationType = 'UNLOAD' THEN vo.id END) as unloadCount,
                COALESCE(SUM(CASE WHEN vo.operationType = 'LOAD' THEN voi.quantity * voi.cost END), 0) as totalLoaded,
                COALESCE(SUM(CASE WHEN vo.operationType = 'UNLOAD' THEN voi.quantity * voi.cost END), 0) as totalUnloaded,
                (SELECT COALESCE(SUM(vi.quantity * COALESCE(p.cost, 0)), 0) 
                 FROM vehicle_inventory vi 
                 LEFT JOIN products p ON vi.productId = p.id 
                 WHERE vi.vehicleId = v.id) as currentValue
            FROM vehicles v
            LEFT JOIN salesmen s ON v.salesmanId = s.id
            LEFT JOIN vehicle_operations vo ON v.id = vo.vehicleId AND ${whereClause}
            LEFT JOIN vehicle_operation_items voi ON vo.id = voi.operationId
            GROUP BY v.id, v.plateNumber, v.name, v.status, s.name
            ORDER BY v.plateNumber
        `, params);
        res.json({
            vehicles: vehicleSummary,
            period: { startDate, endDate }
        });
    }
    catch (error) {
        console.error('Error generating vehicle report:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'generate report');
    }
});
exports.getVehicleReport = getVehicleReport;
// ==========================================
// CUSTOMER VISITS (تتبع زيارات العملاء)
// ==========================================
const getCustomerVisits = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, salesmanId, startDate, endDate, result } = req.query;
    // Get salesman filter from auth token
    const userSalesmanFilter = getUserSalesmanFilter(req);
    try {
        let query = `
            SELECT cv.*, 
                   v.plateNumber as vehicleName,
                   s.name as salesmanName
            FROM vehicle_customer_visits cv
            LEFT JOIN vehicles v ON cv.vehicleId = v.id
            LEFT JOIN salesmen s ON cv.salesmanId = s.id
            WHERE 1=1
        `;
        const params = [];
        // If user is a salesman, force filter to their data only
        if (userSalesmanFilter) {
            query += ` AND cv.salesmanId = ?`;
            params.push(userSalesmanFilter);
        }
        else if (salesmanId) {
            // Only allow manual salesmanId filter if user is admin/manager
            query += ` AND cv.salesmanId = ?`;
            params.push(salesmanId);
        }
        if (vehicleId) {
            query += ` AND cv.vehicleId = ?`;
            params.push(vehicleId);
        }
        if (result) {
            query += ` AND cv.result = ?`;
            params.push(result);
        }
        if (startDate) {
            query += ` AND DATE(cv.visitDate) >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND DATE(cv.visitDate) <= ?`;
            params.push(endDate);
        }
        query += ` ORDER BY cv.visitDate DESC LIMIT 500`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching customer visits:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch customer visits');
    }
});
exports.getCustomerVisits = getCustomerVisits;
const createCustomerVisit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { vehicleId, customerId, customerName, visitDate, visitType, result, invoiceId, invoiceAmount, paymentCollected, paymentMethod, latitude, longitude, address, notes, duration } = req.body;
    const user = req.user;
    if (!vehicleId) {
        return res.status(400).json({ error: 'Vehicle ID is required' });
    }
    try {
        const id = (0, uuid_1.v4)();
        // Get the salesman from the vehicle
        const [vehicle] = yield db_1.pool.query('SELECT salesmanId FROM vehicles WHERE id = ?', [vehicleId]);
        const salesmanId = ((_a = vehicle[0]) === null || _a === void 0 ? void 0 : _a.salesmanId) || null;
        // Convert date to MySQL format - IMPORTANT: Don't use toISOString() as it converts to UTC
        // Mobile sends date in local timezone, preserve the date portion
        // Convert date to MySQL format - IMPORTANT: Don't use toISOString() as it converts to UTC
        // Mobile sends date in local timezone, preserve the date portion
        // FIX: Expect Egypt Time (UTC+2) fallback
        let mysqlDate;
        // Helper to get Egypt Time
        const getEgyptNow = () => {
            const n = new Date();
            const utc = n.getTime() + (n.getTimezoneOffset() * 60000);
            return new Date(utc + (2 * 3600000));
        };
        if (visitDate) {
            const datePart = visitDate.slice(0, 10); // Get YYYY-MM-DD
            const egyptNow = getEgyptNow();
            const timePart = egyptNow.toISOString().slice(11, 19);
            mysqlDate = `${datePart} ${timePart}`;
        }
        else {
            const egyptNow = getEgyptNow();
            mysqlDate = egyptNow.toISOString().slice(0, 19).replace('T', ' ');
        }
        yield db_1.pool.query(`
            INSERT INTO vehicle_customer_visits (
                id, vehicleId, salesmanId, customerId, customerName, visitDate, visitType, result,
                invoiceId, invoiceAmount, paymentCollected, paymentMethod,
                latitude, longitude, address, notes, duration
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, vehicleId, salesmanId, customerId, customerName,
            mysqlDate, visitType || 'UNPLANNED', result || 'NO_SALE',
            invoiceId, invoiceAmount || 0, paymentCollected || 0, paymentMethod,
            latitude, longitude, address, notes, duration
        ]);
        res.status(201).json({ id, message: 'Visit recorded successfully' });
    }
    catch (error) {
        console.error('Error creating customer visit:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'record visit');
    }
});
exports.createCustomerVisit = createCustomerVisit;
/**
 * Create a Van Sale Visit with Invoice
 * This comprehensive endpoint:
 * 1. Creates a real sales invoice (فاتورة بيع)
 * 2. Deducts items from vehicle inventory (جرد السيارات)
 * 3. Records the customer visit with the invoice linked
 * 4. Creates stock movement records
 */
const createVanSaleVisit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { vehicleId, customerId, customerName, visitDate, visitType, items, // Array of { productId, productName, quantity, price, cost }
    paymentMethod, // CASH, CREDIT, BANK, etc.
    paymentCollected, // Amount paid (for partial payments)
    notes, latitude, longitude, address, duration, discount, // Optional global discount
    taxAmount, // Optional tax
    warehouseId, // Optional: if specified, also update warehouse stock
    idempotencyKey, // Optional: unique key to prevent duplicate submissions
    isReturn, // Flag for return invoices (مرتجع مبيعات)
    bankAccountId, // Optional: bank account ID for bank transfers
    transferReference, // Optional: bank transfer reference number
    creditPaymentType // Optional: for CREDIT sales, is the partial payment CASH or BANK?
     } = req.body;
    const user = req.user;
    // Extract transfer reference from notes if not provided directly
    let extractedTransferReference = transferReference;
    if (!extractedTransferReference && notes && typeof notes === 'string') {
        const match = notes.match(/رقم التحويل:\s*(.+)/);
        if (match) {
            extractedTransferReference = match[1].trim();
        }
    }
    // Validate required fields
    if (!vehicleId) {
        return res.status(400).json({ error: 'Vehicle ID is required' });
    }
    if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
    }
    // Calculate total for duplicate detection
    let subtotalCheck = 0;
    for (const item of items) {
        subtotalCheck += (item.quantity * item.price);
    }
    const totalCheck = subtotalCheck - (discount || 0) + (taxAmount || 0);
    const conn = yield db_1.pool.getConnection();
    const lockKey = `invoice_lock_${customerId}`;
    try {
        // 🔒 GLOBAL MUTEX LOCK (GET_LOCK)
        // This is the strongest lock possible. It works even if the customer row DOES NOT exist.
        // It locks a strict string name for 5 seconds.
        const [lockResult] = yield conn.query("SELECT GET_LOCK(?, 5) as locked", [lockKey]);
        if (!lockResult[0].locked) {
            console.warn(`⚠️ Could not acquire lock for ${lockKey}, request busy.`);
            return res.status(429).json({ error: 'System busy, please try again' });
        }
        try {
            // START TRANSACTION
            yield conn.beginTransaction();
            // Format dates BEFORE check so we can use them in the query
            // FIX: Robust timezone parsing for Egypt (UTC+2) to handle server timezone differences
            let dateToInsert;
            // Helper to get Egypt Time
            const getEgyptNow = () => {
                const n = new Date();
                const utc = n.getTime() + (n.getTimezoneOffset() * 60000);
                return new Date(utc + (2 * 3600000)); // +2 hours
            };
            if (visitDate) {
                const datePart = visitDate.slice(0, 10); // Get YYYY-MM-DD
                const egyptNow = getEgyptNow();
                const timePart = egyptNow.toISOString().slice(11, 19);
                dateToInsert = `${datePart} ${timePart}`;
            }
            else {
                const egyptNow = getEgyptNow();
                dateToInsert = egyptNow.toISOString().slice(0, 19).replace('T', ' ');
                console.log(`⚠️ processVanSale: Missing visitDate, defaulted to Egypt Time: ${dateToInsert}`);
            }
            console.log(`📅 processVanSale: incoming=${visitDate}, used=${dateToInsert}`);
            // Define mysqlNow for compatibility with downstream code
            const mysqlNow = dateToInsert;
            console.log(`🔒 Acquired mutex lock: ${lockKey}`);
            console.log(`🔍 Checking for duplicates: customerId=${customerId}, total=${totalCheck}`);
            // IDEMPOTENCY CHECK
            // We check for:
            // 1. Same Customer
            // 2. Same SUBTOTAL (pre-discount) compared against total (close enough match)
            // 3. EITHER:
            //    a) Created recently on server (within 5 mins) - covers online double clicks
            //    b) Created at the exact same 'visitDate' (within 30s tolerance) - covers offline sync retries
            const invoiceType = isReturn ? 'RETURN_SALE' : 'INVOICE_SALE';
            const [recentDuplicates] = yield conn.query(`SELECT id, number, total, date 
                 FROM invoices 
                 WHERE partnerId = ? 
                   AND type = ?
                   AND (
                        ABS(total - ?) < 0.01
                        OR ABS(total - ?) < 0.01
                   )
                   AND (
                        date > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                        OR
                        ABS(TIMESTAMPDIFF(SECOND, date, ?)) < 30
                   )
                 ORDER BY date DESC
                 LIMIT 1
                 FOR UPDATE`, [customerId, invoiceType, subtotalCheck, totalCheck, dateToInsert]);
            if (recentDuplicates.length > 0) {
                const dup = recentDuplicates[0];
                console.log(`⚠️ ⚠️ ⚠️ DUPLICATE INVOICE DETECTED! ⚠️ ⚠️ ⚠️`);
                console.log(`   Customer: ${customerId}`);
                console.log(`   Total: ${totalCheck}`);
                console.log(`   Existing Invoice: ${dup.number} (ID: ${dup.id})`);
                yield conn.rollback();
                // Release lock in finally block
                return res.status(200).json({
                    id: dup.id,
                    invoiceId: dup.id,
                    number: dup.number,
                    invoiceNumber: dup.number,
                    message: 'Invoice already exists (duplicate request detected)',
                    isDuplicate: true
                });
            }
            console.log(`✅ No duplicates found, proceeding to create invoice`);
            // Re-bind to variables used downstream
            const mysqlDate = mysqlNow;
            const invoiceDate = dateToInsert;
            // Get vehicle info
            const [vehicleRows] = yield conn.query('SELECT v.*, s.name as salesmanName FROM vehicles v LEFT JOIN salesmen s ON v.salesmanId = s.id WHERE v.id = ?', [vehicleId]);
            if (vehicleRows.length === 0) {
                throw new Error('Vehicle not found');
            }
            const vehicle = vehicleRows[0];
            const salesmanId = vehicle.salesmanId;
            const salesmanName = vehicle.salesmanName;
            // Validate all items exist in vehicle inventory with sufficient quantity
            for (const item of items) {
                const [vehicleStock] = yield conn.query('SELECT quantity FROM vehicle_inventory WHERE vehicleId = ? AND productId = ?', [vehicleId, item.productId]);
                if (!vehicleStock[0] || vehicleStock[0].quantity < item.quantity) {
                    const available = ((_a = vehicleStock[0]) === null || _a === void 0 ? void 0 : _a.quantity) || 0;
                    throw new Error(`الكمية غير كافية للصنف ${item.productName || item.productId}. المتاح: ${available}, المطلوب: ${item.quantity}`);
                }
            }
            // Get partner's current balance BEFORE this invoice (for balance snapshot)
            // FIX: Check if partner exists first. If not, auto-create it (Handles offline new customers)
            const [partnerRows] = yield conn.query('SELECT COALESCE(balance, 0) as balance FROM partners WHERE id = ?', [customerId]);
            let previousBalance = 0;
            if (partnerRows.length === 0) {
                console.log(`⚠️ Partner ${customerName} (${customerId}) not found. Auto-creating...`);
                // Auto-create missing partner (e.g. created offline)
                yield conn.query('INSERT INTO partners (id, name, type, isCustomer, status, salesmanId, openingBalance, balance) VALUES (?, ?, "CUSTOMER", 1, "ACTIVE", ?, 0, 0)', [customerId, customerName || "Unknown Customer", salesmanId]);
                // previousBalance remains 0
            }
            else {
                previousBalance = Number(((_b = partnerRows[0]) === null || _b === void 0 ? void 0 : _b.balance) || 0);
            }
            console.log(`💰 Partner ${customerName} previous balance: ${previousBalance}`);
            let subtotal = 0;
            for (const item of items) {
                const lineTotal = item.quantity * item.price;
                subtotal += lineTotal;
            }
            const globalDiscount = discount || 0;
            const tax = taxAmount || 0;
            const total = subtotal - globalDiscount + tax;
            const paidAmount = paymentCollected || (paymentMethod === 'CASH' ? total : 0);
            // Debug logging
            console.log(`💵 Payment Debug:`);
            console.log(`   - paymentMethod: ${paymentMethod}`);
            console.log(`   - paymentCollected (from request): ${paymentCollected}`);
            console.log(`   - paidAmount (calculated): ${paidAmount}`);
            console.log(`   - total: ${total}`);
            // Create Invoice ID and number
            const invoiceId = (0, uuid_1.v4)();
            // Generate invoice number - count existing VAN invoices for this year
            const currentYear = new Date().getFullYear();
            const [vanInvoiceCount] = yield conn.query(`
            SELECT COUNT(*) as count FROM invoices 
            WHERE type = 'INVOICE_SALE' 
            AND number LIKE 'VAN-${currentYear}-%'
        `);
            const nextNumber = (((_c = vanInvoiceCount[0]) === null || _c === void 0 ? void 0 : _c.count) || 0) + 1;
            const invoiceNumber = `VAN-${currentYear}-${String(nextNumber).padStart(5, '0')}`;
            // Create invoice - status POSTED for posted van sales/returns
            const invoiceNotes = isReturn
                ? (notes ? `مرتجع مبيعات - ${notes}` : 'مرتجع مبيعات من سيارة التوزيع')
                : (notes ? `بيع متنقل - ${notes}` : 'بيع متنقل من سيارة التوزيع');
            // Create bankTransfers JSON for BANK payments OR CREDIT payments with bank partial payment
            let bankTransfersJson = null;
            let bankNameForInvoice = null;
            let bankGLAccountId = null; // The GL account ID for the bank (for receipts)
            // Check if this is a bank payment - either direct BANK or CREDIT with bank partial payment
            const isBankPayment = (paymentMethod === 'BANK' || (paymentMethod === 'CREDIT' && creditPaymentType === 'BANK'));
            console.log(`💳 Payment type check: paymentMethod=${paymentMethod}, creditPaymentType=${creditPaymentType}, isBankPayment=${isBankPayment}`);
            if (isBankPayment && paidAmount > 0) {
                // Get bank name if bankAccountId is provided
                if (bankAccountId) {
                    // Mobile passes bank.id, but we need to check both id and accountId
                    const [bankRows] = yield conn.query(`SELECT b.name, b.accountNumber, b.accountId FROM banks b WHERE b.id = ? OR b.accountId = ? LIMIT 1`, [bankAccountId, bankAccountId]);
                    if (bankRows[0]) {
                        bankNameForInvoice = bankRows[0].name;
                        bankGLAccountId = bankRows[0].accountId; // This is the GL account ID
                        console.log(`🏦 Found bank: ${bankNameForInvoice}, GL Account: ${bankGLAccountId}`);
                    }
                    else {
                        console.log(`⚠️ Bank not found for ID: ${bankAccountId}`);
                    }
                }
                // Create bank transfer entry
                bankTransfersJson = JSON.stringify([{
                        bankId: bankGLAccountId || bankAccountId || null, // Use GL account ID
                        bankName: bankNameForInvoice || 'بنك',
                        amount: paidAmount,
                        reference: extractedTransferReference || ''
                    }]);
            }
            yield conn.query(`
            INSERT INTO invoices (
                id, number, date, type, partnerId, partnerName, total,
                taxAmount, globalDiscount, paidAmount, status, paymentMethod, posted,
                notes, salesmanId, createdBy, bankAccountId, bankTransfers
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        `, [
                invoiceId, invoiceNumber, invoiceDate, invoiceType, customerId, customerName, total,
                tax, globalDiscount, paidAmount,
                'POSTED', // Always POSTED for van sales/returns (shows as "مرحل")
                paymentMethod || 'CASH',
                invoiceNotes,
                salesmanId,
                (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || (isReturn ? 'مرتجع مبيعات' : 'بيع متنقل'),
                paymentMethod === 'BANK' ? bankAccountId : null,
                bankTransfersJson
            ]);
            // Store balance snapshot
            // For returns: new balance = previous - invoice (we SUBTRACT the return from balance)
            // For sales: new balance = previous + invoice - paid
            const newBalance = isReturn
                ? previousBalance - total // Return reduces customer debt
                : previousBalance + total - paidAmount;
            console.log(`💰 Partner balance snapshot: previous=${previousBalance}, new=${newBalance} ${isReturn ? '(RETURN)' : ''}`);
            // Try to update balance fields (columns may not exist in all installations)
            try {
                yield conn.query(`
                UPDATE invoices SET previousBalance = ?, newBalance = ? WHERE id = ?
            `, [previousBalance, newBalance, invoiceId]);
            }
            catch (e) {
                console.log('Note: Could not store balance snapshot (columns may not exist yet)');
            }
            // Insert invoice lines and update vehicle inventory
            for (const item of items) {
                const lineTotal = item.quantity * item.price;
                const lineCost = item.cost || 0;
                // Insert invoice line
                yield conn.query(`
                INSERT INTO invoice_lines (
                    invoiceId, productId, productName, quantity, 
                    price, cost, discount, total
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                    invoiceId, item.productId, item.productName,
                    item.quantity, item.price, lineCost, item.discount || 0, lineTotal
                ]);
                // Update vehicle inventory (subtract for sales, add for returns)
                if (isReturn) {
                    console.log(`📦 RETURN: Adding ${item.quantity} of ${item.productName} (${item.productId}) to vehicle ${vehicleId}`);
                    yield conn.query(`
                        UPDATE vehicle_inventory 
                        SET quantity = quantity + ? 
                        WHERE vehicleId = ? AND productId = ?
                    `, [item.quantity, vehicleId, item.productId]);
                }
                else {
                    console.log(`📦 SALE: Deducting ${item.quantity} of ${item.productName} (${item.productId}) from vehicle ${vehicleId}`);
                    yield conn.query(`
                        UPDATE vehicle_inventory 
                        SET quantity = quantity - ? 
                        WHERE vehicleId = ? AND productId = ?
                    `, [item.quantity, vehicleId, item.productId]);
                }
                // Create stock movement record
                const movementType = isReturn ? 'RETURN_IN' : 'SALE';
                const qtyChange = isReturn ? item.quantity : -item.quantity;
                const movementNotes = isReturn ? `مرتجع مبيعات - ${customerName}` : `بيع متنقل - ${customerName}`;
                yield conn.query(`
                INSERT INTO stock_movements (
                    id, product_id, warehouse_id, qty_change, movement_type,
                    reference_type, reference_id, notes, movement_date
                ) VALUES (UUID(), ?, ?, ?, ?, 'VAN_SALE', ?, ?, ?)
            `, [
                    item.productId,
                    // CRITICAL FIX: For Van Sales, do NOT link to the warehouse ID.
                    // The items were already deducted from the warehouse during "Load" (TRANSFER_OUT).
                    // If we link the warehouse here, it counts as a second deduction from the warehouse.
                    null, // Left as null for Van Sales to indicate "Sold from Vehicle" not "Sold from Warehouse"
                    qtyChange,
                    movementType,
                    invoiceId,
                    movementNotes,
                    mysqlDate
                ]);
            }
            // Create the visit record linked to the invoice
            const visitId = (0, uuid_1.v4)();
            const visitResult = isReturn ? 'RETURN' : 'SALE';
            yield conn.query(`
            INSERT INTO vehicle_customer_visits (
                id, vehicleId, salesmanId, customerId, customerName, visitDate, visitType, result,
                invoiceId, invoiceAmount, paymentCollected, paymentMethod,
                latitude, longitude, address, notes, duration
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
                visitId, vehicleId, salesmanId, customerId, customerName,
                invoiceDate, visitType || 'PLANNED', visitResult,
                invoiceId, total, paidAmount, paymentMethod || 'CASH',
                latitude, longitude, address, notes, duration
            ]);
            // Create operation record for tracking
            const operationId = (0, uuid_1.v4)();
            const operationType = isReturn ? 'RETURN' : 'SALE';
            const operationNotes = isReturn
                ? (notes ? `مرتجع مبيعات - ${customerName}: ${notes}` : `مرتجع مبيعات - ${customerName}`)
                : (notes ? `بيع متنقل - ${customerName}: ${notes}` : `بيع متنقل - ${customerName}`);
            yield conn.query(`
            INSERT INTO vehicle_operations (id, vehicleId, operationType, date, warehouseId, notes, createdBy)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
                operationId, vehicleId, operationType, mysqlDate, warehouseId || vehicle.warehouseId,
                operationNotes,
                (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'System'
            ]);
            // Insert operation items
            for (const item of items) {
                yield conn.query(`
                INSERT INTO vehicle_operation_items (operationId, productId, productName, quantity, cost)
                VALUES (?, ?, ?, ?, ?)
            `, [operationId, item.productId, item.productName, item.quantity, item.price]);
            }
            // =====================================================
            // UPDATE PARTNER BALANCE AND CREATE TREASURY ENTRY
            // =====================================================
            // Calculate balance change:
            // For SALE: balance increases (customer owes more), then payment decreases it
            // For RETURN: balance decreases (we owe customer back or reduce their debt)
            const balanceChange = isReturn ? -total : (total - paidAmount);
            // Update the partner's balance
            // For credit sales: balanceChange = total (full amount added to their debt)
            // For cash sales: balanceChange = 0 (paid in full)
            // For partial payment: balanceChange = total - paidAmount
            yield conn.query(`
            UPDATE partners 
            SET balance = COALESCE(balance, 0) + ? 
            WHERE id = ?
        `, [balanceChange, customerId]);
            console.log(`💰 Partner ${customerName} (${customerId}) balance updated by ${balanceChange}`);
            // If there's a payment, create a treasury receipt entry
            console.log(`💳 Checking payment for treasury receipt: paidAmount = ${paidAmount}, type = ${typeof paidAmount}`);
            if (paidAmount > 0) {
                console.log(`💳 paidAmount > 0, creating treasury receipt...`);
                console.log(`💳 Payment method: ${paymentMethod}, creditPaymentType: ${creditPaymentType}`);
                // Find appropriate account for the receipt based on payment method
                let treasuryAccountId = null;
                // For CREDIT payments with bank partial, the receipt should be BANK type
                let receiptPaymentMethod = isBankPayment ? 'BANK' : (paymentMethod || 'CASH');
                if (isBankPayment && bankGLAccountId) {
                    // Use the already resolved bank GL account from earlier
                    treasuryAccountId = bankGLAccountId;
                    console.log(`🏦 Using bank GL account from invoice: ${treasuryAccountId}`);
                }
                else if (isBankPayment) {
                    // Fallback: get any bank account
                    const [bankAccount] = yield conn.query(`
                        SELECT accountId FROM banks WHERE accountId IS NOT NULL LIMIT 1
                    `);
                    treasuryAccountId = (_d = bankAccount[0]) === null || _d === void 0 ? void 0 : _d.accountId;
                    console.log(`🏦 Using fallback bank account: ${treasuryAccountId}`);
                }
                // Fallback to cash account if no bank account or not BANK payment
                if (!treasuryAccountId) {
                    const [cashAccount] = yield conn.query(`
                        SELECT id FROM accounts WHERE code LIKE '101%' OR name LIKE '%نقدي%' OR name LIKE '%صندوق%' LIMIT 1
                    `);
                    treasuryAccountId = (_e = cashAccount[0]) === null || _e === void 0 ? void 0 : _e.id;
                    receiptPaymentMethod = 'CASH'; // Force to CASH if using cash account
                    console.log(`💳 Using default cash account: ${treasuryAccountId}`);
                }
                if (treasuryAccountId) {
                    // Create a treasury invoice/receipt for the payment
                    const receiptId = (0, uuid_1.v4)();
                    const receiptNumber = `RCV-${invoiceNumber}`;
                    console.log(`💳 Creating receipt invoice: ${receiptNumber} for amount ${paidAmount} (${receiptPaymentMethod})`);
                    yield conn.query(`
                    INSERT INTO invoices (
                        id, number, date, type, partnerId, partnerName, 
                        total, paidAmount, status, paymentMethod, posted,
                        notes, salesmanId, createdBy, referenceInvoiceId, bankAccountId
                    ) VALUES (?, ?, ?, 'RECEIPT', ?, ?, ?, ?, 'POSTED', ?, 1, ?, ?, ?, ?, ?)
                `, [
                        receiptId, receiptNumber, invoiceDate, customerId, customerName,
                        paidAmount, paidAmount,
                        receiptPaymentMethod,
                        isBankPayment
                            ? `تحصيل بيع متنقل (تحويل بنكي${bankNameForInvoice ? ' - ' + bankNameForInvoice : ''}) - فاتورة ${invoiceNumber}${notes ? ` - ${notes}` : ''}`
                            : `تحصيل بيع متنقل - فاتورة ${invoiceNumber}`,
                        salesmanId,
                        (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'بيع متنقل',
                        invoiceId,
                        isBankPayment ? (bankGLAccountId || bankAccountId) : null
                    ]);
                    console.log(`🧾 Created treasury receipt ${receiptNumber} for ${paidAmount}`);
                    // Update treasury account balance
                    yield conn.query(`
                    UPDATE accounts SET balance = COALESCE(balance, 0) + ? WHERE id = ?
                `, [paidAmount, treasuryAccountId]);
                    console.log(`💰 Updated treasury account ${treasuryAccountId} balance by +${paidAmount}`);
                    // =====================================================
                    // CREATE JOURNAL ENTRY FOR TREASURY RECEIPT
                    // This makes the receipt visible in TreasuryJournal
                    // =====================================================
                    const journalId = (0, uuid_1.v4)();
                    // Get default customer receivable account
                    const [defaultReceivable] = yield conn.query(`
                    SELECT id, name FROM accounts WHERE code LIKE '120%' OR name LIKE '%ذمم%' OR name LIKE '%عملاء%' LIMIT 1
                `);
                    const receivableAccountId = (_f = defaultReceivable[0]) === null || _f === void 0 ? void 0 : _f.id;
                    const receivableAccountName = ((_g = defaultReceivable[0]) === null || _g === void 0 ? void 0 : _g.name) || 'ذمم العملاء';
                    // Get treasury account details
                    const [treasuryAcc] = yield conn.query(`
                    SELECT name FROM accounts WHERE id = ?
                `, [treasuryAccountId]);
                    const treasuryAccountName = ((_h = treasuryAcc[0]) === null || _h === void 0 ? void 0 : _h.name) || 'الخزينة';
                    // Create the journal entry
                    yield conn.query(`
                    INSERT INTO journal_entries (id, date, description, referenceId, createdBy)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                        journalId,
                        invoiceDate,
                        `تحصيل بيع متنقل - ${customerName} - فاتورة ${invoiceNumber}`,
                        receiptNumber,
                        (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'بيع متنقل'
                    ]);
                    // Create journal lines: Debit Cash, Credit Receivable
                    yield conn.query(`
                    INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit)
                    VALUES (?, ?, ?, ?, 0)
                `, [journalId, treasuryAccountId, treasuryAccountName, paidAmount]);
                    yield conn.query(`
                    INSERT INTO journal_lines (journalId, accountId, accountName, debit, credit)
                    VALUES (?, ?, ?, 0, ?)
                `, [journalId, receivableAccountId, receivableAccountName, paidAmount]);
                    console.log(`📝 Created journal entry ${journalId} for receipt: Debit ${treasuryAccountName} ${paidAmount}, Credit ${receivableAccountName} ${paidAmount}`);
                }
                else {
                    console.log(`⚠️ No treasury account found! Cannot create receipt.`);
                }
            }
            else {
                console.log(`💳 paidAmount is ${paidAmount}, skipping treasury receipt`);
            }
            yield conn.commit();
            // =====================================================
            // AUTO-SYNC: Create/Update LIVE Settlement for Today
            // This ensures desktop can see real-time settlement data
            // =====================================================
            try {
                const today = invoiceDate.slice(0, 10); // YYYY-MM-DD
                const conn2 = yield db_1.pool.getConnection();
                try {
                    // Check for existing LIVE or non-approved settlement for today
                    // FIX: Find ANY open settlement (submitted) to merge new visit into it, regardless of date
                    // This prevents creating new duplicate settlements when working past midnight
                    const [existingSettlement] = yield conn2.query(`SELECT id, status FROM vehicle_settlements 
                         WHERE vehicleId = ? AND status = 'SUBMITTED'
                         ORDER BY settlementDate DESC LIMIT 1`, [vehicleId]);
                    // Recalculate stats cleanly, excluding THIS settlement from cutoff lookups
                    // The settlementId parameter is used to exclude the current settlement being updated
                    // from the calculation of 'cutoff' for new invoices after an approved settlement.
                    // If no existing settlement, pass null.
                    const settlementId = existingSettlement.length > 0 ? existingSettlement[0].id : null;
                    const ignoreDateFilter = !!settlementId; // Merge mode if settlement exists
                    const stats = yield (0, exports.calculateRefinedSettlementStats)(conn2, vehicleId, today, settlementId, ignoreDateFilter);
                    if (existingSettlement.length > 0) {
                        // Update existing LIVE settlement - but ONLY if still SUBMITTED
                        // This prevents race conditions where approval happens concurrently
                        const result = yield conn2.query(`
                            UPDATE vehicle_settlements SET
                                totalCashSales = ?, totalCreditSales = ?, totalSales = ?, totalBankTransfers = ?,
                        cashCollected = ?, totalCollections = ?,
                        totalReturns = ?, returnCount = ?,
                        expectedCash = ?, updatedAt = NOW()
                            WHERE id = ? AND status = 'SUBMITTED'
                        `, [
                            stats.totalCashSales, stats.totalCreditSales, stats.totalSales, stats.totalBankTransfers || 0,
                            stats.cashCollected, stats.totalCollections,
                            stats.totalReturns, stats.returnCount,
                            stats.expectedCash,
                            existingSettlement[0].id
                        ]);
                        if (result[0].affectedRows > 0) {
                            console.log(`📊 Updated SUBMITTED settlement ${existingSettlement[0].id} for ${today}`);
                        }
                        else {
                            console.log(`⚠️ Settlement ${existingSettlement[0].id} was approved during sync, skipping update`);
                        }
                    }
                    else {
                        // Check if there's an APPROVED settlement (don't create duplicate)
                        const [approved] = yield conn2.query(`SELECT id FROM vehicle_settlements WHERE vehicleId = ? AND settlementDate = ? AND status = 'APPROVED'`, [vehicleId, today]);
                        if (approved.length === 0) {
                            // Create new LIVE settlement
                            const newSettlementId = (0, uuid_1.v4)();
                            yield conn2.query(`
                                INSERT INTO vehicle_settlements(
                            id, vehicleId, settlementDate, salesmanId, salesmanName,
                            totalCashSales, totalCreditSales, totalSales, totalBankTransfers,
                            cashCollected, totalCollections,
                            totalReturns, returnCount,
                            expectedCash, actualCash, cashDifference,
                            status, notes, createdBy
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'SUBMITTED', 'تسوية مباشرة', ?)
                            `, [
                                newSettlementId, vehicleId, today,
                                salesmanId, salesmanName,
                                stats.totalCashSales, stats.totalCreditSales, stats.totalSales, stats.totalBankTransfers || 0,
                                stats.cashCollected, stats.totalCollections,
                                stats.totalReturns, stats.returnCount,
                                stats.expectedCash,
                                (user === null || user === void 0 ? void 0 : user.name) || 'System'
                            ]);
                            console.log(`📊 Created SUBMITTED settlement ${newSettlementId} for ${today}`);
                        }
                        else {
                            const [existingLiveAfterApproval] = yield conn2.query(`SELECT id FROM vehicle_settlements 
                                 WHERE vehicleId = ? AND settlementDate = ? AND status = 'SUBMITTED' 
                                 AND createdAt > (SELECT COALESCE(updatedAt, createdAt) FROM vehicle_settlements WHERE id = ?)
                                 LIMIT 1`, [vehicleId, today, approved[0].id]);
                            if (existingLiveAfterApproval.length > 0) {
                                // Update the existing LIVE settlement created after approval
                                // Calculate ONLY invoices created after the approved settlement
                                const [invoicesAfter] = yield conn2.query(`
                    SELECT
                    COALESCE(SUM(CASE WHEN paymentMethod = 'CASH' THEN total ELSE 0 END), 0) as cashSales,
                        COALESCE(SUM(CASE WHEN paymentMethod = 'CREDIT' THEN total ELSE 0 END), 0) as creditSales,
                        COALESCE(SUM(CASE WHEN paymentMethod = 'BANK' THEN total ELSE 0 END), 0) as bankSales,
                        COALESCE(SUM(total), 0) as totalSales,
                        COALESCE(SUM(paidAmount), 0) as collected
                                    FROM invoices 
                                    WHERE salesmanId = ?
                        AND DATE(date) = ?
                            AND date > (SELECT COALESCE(updatedAt, createdAt) FROM vehicle_settlements WHERE id = ?)
                                    AND type IN ('INVOICE_SALE', 'RETURN_SALE')
                    `, [salesmanId, today, approved[0].id]);
                                const newStats = invoicesAfter[0] || {};
                                const result2 = yield conn2.query(`
                                    UPDATE vehicle_settlements SET
                    totalCashSales = ?, totalCreditSales = ?, totalSales = ?, totalBankTransfers = ?,
                        cashCollected = ?, expectedCash = ?, updatedAt = NOW()
                                    WHERE id = ? AND status = 'SUBMITTED'
                        `, [
                                    newStats.cashSales || 0, newStats.creditSales || 0, newStats.totalSales || 0, newStats.bankSales || 0,
                                    newStats.collected || 0, newStats.collected || 0,
                                    existingLiveAfterApproval[0].id
                                ]);
                                if (result2[0].affectedRows > 0) {
                                    console.log(`📊 Updated SUBMITTED settlement ${existingLiveAfterApproval[0].id} (after approval) for ${today}`);
                                }
                                else {
                                    console.log(`⚠️ Settlement ${existingLiveAfterApproval[0].id} was approved during sync, skipping update`);
                                }
                            }
                            else {
                                // Create new LIVE settlement with only this invoice's data
                                const newSettlementId = (0, uuid_1.v4)();
                                const thisSaleCash = (paymentMethod === 'CASH' ? total : 0);
                                const thisSaleCredit = (paymentMethod === 'CREDIT' ? total : 0);
                                const thisSaleBank = (paymentMethod === 'BANK' ? total : 0);
                                yield conn2.query(`
                                    INSERT INTO vehicle_settlements(
                            id, vehicleId, settlementDate, salesmanId, salesmanName,
                            totalCashSales, totalCreditSales, totalSales, totalBankTransfers,
                            cashCollected, totalCollections,
                            totalReturns, returnCount,
                            expectedCash, actualCash, cashDifference,
                            status, notes, createdBy
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, 0, 'SUBMITTED', 'تسوية إضافية (بعد الاعتماد)', ?)
                                `, [
                                    newSettlementId, vehicleId, today,
                                    salesmanId, salesmanName,
                                    thisSaleCash, thisSaleCredit, total, thisSaleBank,
                                    paidAmount, paidAmount,
                                    paidAmount,
                                    (user === null || user === void 0 ? void 0 : user.name) || 'System'
                                ]);
                                console.log(`📊 Created additional SUBMITTED settlement ${newSettlementId} for ${today}(after approval)`);
                            }
                        }
                    }
                }
                finally {
                    conn2.release();
                }
            }
            catch (syncError) {
                console.error('⚠️ Could not auto-sync settlement (non-critical):', syncError);
                // Don't fail the invoice creation for this
            }
            // Broadcast real-time update to all connected clients
            const io = req.app.get('io');
            if (io) {
                io.emit('entity:changed', {
                    entityType: 'vehicle-inventory',
                    vehicleId,
                    operation: 'SALE',
                    invoiceNumber,
                    updatedBy: (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'بيع متنقل'
                });
                io.emit('entity:changed', { entityType: 'invoice', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'بيع متنقل' });
                io.emit('entity:changed', { entityType: 'partner', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System' });
                io.emit('entity:changed', { entityType: 'product', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System' });
                io.emit('entity:changed', { entityType: 'products', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System' });
                // Notify stock balance report
                io.emit('stock:updated', {
                    warehouseId: warehouseId || vehicle.warehouseId,
                    operation: 'VAN_SALE',
                    productIds: items.map((i) => i.productId),
                    updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System'
                });
            }
            res.status(201).json({
                success: true,
                message: 'تم إنشاء فاتورة البيع المتنقل بنجاح',
                id: invoiceId,
                invoiceId,
                number: invoiceNumber,
                visitId,
                operationId,
                total,
                paidAmount,
                itemCount: items.length
            });
        }
        catch (error) {
            yield conn.rollback();
            console.error('Error creating van sale visit:', error);
            return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
        }
        finally {
            // RELEASE THE MUTEX LOCK
            try {
                // We must release the lock we acquired at the start
                yield conn.query("SELECT RELEASE_LOCK(?)", [lockKey]);
            }
            catch (releaseErr) {
                console.warn(`Could not release lock ${lockKey} `, releaseErr);
            }
            conn.release();
        }
    }
    finally {
        // Redundant release safety net (if outer try fails)
        // But conn.release() is usually enough.
        // We need to close the outer specific block.
    }
});
exports.createVanSaleVisit = createVanSaleVisit;
/**
 * Create a Van Return Visit with Return Invoice
 * This comprehensive endpoint:
 * 1. Creates a return invoice (مرتجع بيع)
 * 2. ADDS items back to vehicle inventory (جرد السيارات)
 * 3. Records the customer visit with the return linked
 * 4. Creates return operation records
 */
const createVanReturnVisit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { vehicleId, customerId, customerName, visitDate, visitType, items, // Array of { productId, productName, quantity, price, cost }
    paymentMethod, // CASH, CREDIT, etc.
    notes, latitude, longitude, address, duration, originalInvoiceId // Optional: link to original sale invoice
     } = req.body;
    const user = req.user;
    if (!vehicleId || !items || items.length === 0) {
        return res.status(400).json({ error: 'Vehicle ID and items are required' });
    }
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        // Get vehicle details
        const [vehicleRows] = yield conn.query('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
        if (vehicleRows.length === 0) {
            throw new Error('Vehicle not found');
        }
        const vehicle = vehicleRows[0];
        const salesmanId = vehicle.assignedTo || (user === null || user === void 0 ? void 0 : user.id);
        const warehouseId = vehicle.warehouseId;
        // Calculate totals
        let total = 0;
        let tax = 0;
        let globalDiscount = 0;
        for (const item of items) {
            const lineTotal = item.quantity * item.price;
            total += lineTotal;
        }
        // For returns, payment is typically refund
        const refundAmount = paymentMethod === 'CREDIT' ? 0 : total;
        // Create Return Invoice ID and number
        const invoiceId = (0, uuid_1.v4)();
        // Generate invoice number - count existing VAN return invoices for this year
        const currentYear = new Date().getFullYear();
        const [vanReturnCount] = yield conn.query(`
            SELECT COUNT(*) as count FROM invoices 
            WHERE type = 'RETURN_SALE' 
            AND number LIKE 'RET-${currentYear}-%'
        `);
        const nextNumber = (((_a = vanReturnCount[0]) === null || _a === void 0 ? void 0 : _a.count) || 0) + 1;
        const invoiceNumber = `RET - ${currentYear} -${String(nextNumber).padStart(5, '0')} `;
        // Format date for MySQL - IMPORTANT: Don't use toISOString() as it converts to UTC
        // Mobile sends date in local timezone, we just need to extract and preserve the date portion
        // FIX: Expect Egypt Time (UTC+2) fallback
        let invoiceDate;
        // Helper to get Egypt Time
        const getEgyptNow = () => {
            const n = new Date();
            const utc = n.getTime() + (n.getTimezoneOffset() * 60000);
            return new Date(utc + (2 * 3600000));
        };
        if (visitDate) {
            // Extract YYYY-MM-DD part from mobile date (could be "2026-01-29 00:50:00" or ISO format)
            const datePart = visitDate.slice(0, 10); // Get YYYY-MM-DD
            const egyptNow = getEgyptNow();
            const timePart = egyptNow.toISOString().slice(11, 19);
            invoiceDate = `${datePart} ${timePart} `;
        }
        else {
            const egyptNow = getEgyptNow();
            invoiceDate = egyptNow.toISOString().slice(0, 19).replace('T', ' ');
        }
        const mysqlDate = invoiceDate;
        // Create return invoice - status POSTED
        yield conn.query(`
            INSERT INTO invoices(
                            id, number, date, type, partnerId, partnerName, total,
                            taxAmount, globalDiscount, paidAmount, status, paymentMethod, posted,
                            notes, salesmanId, createdBy
                        ) VALUES(?, ?, ?, 'RETURN_SALE', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `, [
            invoiceId, invoiceNumber, invoiceDate, customerId, customerName, total,
            tax, globalDiscount, refundAmount,
            'POSTED', // Always POSTED for van returns (shows as "مرحل")
            paymentMethod || 'CASH',
            notes ? `مرتجع متنقل - ${notes} ` : 'مرتجع متنقل من سيارة التوزيع',
            salesmanId,
            (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'مرتجع متنقل'
        ]);
        // Insert invoice lines and ADD to vehicle inventory (reverse of sale)
        for (const item of items) {
            const lineTotal = item.quantity * item.price;
            const lineCost = item.cost || 0;
            // Insert invoice line
            yield conn.query(`
                INSERT INTO invoice_lines(
                            invoiceId, productId, productName, quantity,
                            price, cost, discount, total
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                invoiceId, item.productId, item.productName,
                item.quantity, item.price, lineCost, item.discount || 0, lineTotal
            ]);
            // ADD to vehicle inventory (opposite of sale)
            const [existingStock] = yield conn.query('SELECT quantity FROM vehicle_inventory WHERE vehicleId = ? AND productId = ?', [vehicleId, item.productId]);
            if (existingStock.length > 0) {
                // Update existing stock - ADD quantity
                yield conn.query('UPDATE vehicle_inventory SET quantity = quantity + ? WHERE vehicleId = ? AND productId = ?', [item.quantity, vehicleId, item.productId]);
            }
            else {
                // Insert new stock entry with the returned quantity
                yield conn.query(`
                    INSERT INTO vehicle_inventory(id, vehicleId, productId, quantity, lastLoadDate)
                    VALUES(?, ?, ?, ?, ?)
                        `, [(0, uuid_1.v4)(), vehicleId, item.productId, item.quantity, mysqlDate]);
            }
        }
        // Create customer visit record with result = RETURN
        const visitId = (0, uuid_1.v4)();
        yield conn.query(`
            INSERT INTO vehicle_customer_visits(
                            id, vehicleId, salesmanId, customerId, customerName,
                            visitDate, visitType, result,
                            invoiceId, invoiceAmount, paymentCollected, paymentMethod,
                            latitude, longitude, address, notes, duration
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, 'RETURN', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
            visitId, vehicleId, salesmanId, customerId, customerName,
            invoiceDate, visitType || 'PLANNED',
            invoiceId, total, refundAmount, paymentMethod || 'CASH',
            latitude, longitude, address, notes, duration
        ]);
        // Create a RETURN operation record for tracking
        const operationId = (0, uuid_1.v4)();
        yield conn.query(`
            INSERT INTO vehicle_operations(id, vehicleId, operationType, date, warehouseId, notes, createdBy)
                    VALUES(?, ?, 'RETURN', ?, ?, ?, ?)
        `, [
            operationId, vehicleId, mysqlDate, warehouseId || vehicle.warehouseId,
            notes ? `مرتجع متنقل - ${customerName}: ${notes} ` : `مرتجع متنقل - ${customerName} `,
            (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'System'
        ]);
        // Insert operation items
        for (const item of items) {
            yield conn.query(`
                INSERT INTO vehicle_operation_items(operationId, productId, productName, quantity, cost)
                    VALUES(?, ?, ?, ?, ?)
                        `, [operationId, item.productId, item.productName, item.quantity, item.price]);
        }
        yield conn.commit();
        // Broadcast real-time update to all connected clients
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', {
                entityType: 'vehicle-inventory',
                vehicleId,
                operation: 'RETURN',
                invoiceNumber,
                updatedBy: (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'مرتجع متنقل'
            });
            io.emit('entity:changed', { entityType: 'invoice', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'مرتجع متنقل' });
            io.emit('entity:changed', { entityType: 'partner', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System' });
            io.emit('entity:changed', { entityType: 'product', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System' });
            io.emit('entity:changed', { entityType: 'products', updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System' });
            // Notify stock balance report
            io.emit('stock:updated', {
                warehouseId: warehouseId || vehicle.warehouseId,
                operation: 'VAN_RETURN',
                productIds: items.map((i) => i.productId),
                updatedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System'
            });
        }
        res.status(201).json({
            success: true,
            message: 'تم إنشاء فاتورة المرتجع المتنقل بنجاح',
            id: invoiceId,
            invoiceId,
            number: invoiceNumber,
            visitId,
            operationId,
            total,
            refundAmount,
            itemCount: items.length
        });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error creating van return visit:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        conn.release();
    }
});
exports.createVanReturnVisit = createVanReturnVisit;
const updateCustomerVisit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { result, invoiceId, invoiceAmount, paymentCollected, paymentMethod, notes, duration } = req.body;
    try {
        yield db_1.pool.query(`
            UPDATE vehicle_customer_visits SET
                    result = COALESCE(?, result),
                        invoiceId = ?,
                        invoiceAmount = COALESCE(?, invoiceAmount),
                        paymentCollected = COALESCE(?, paymentCollected),
                        paymentMethod = ?,
                        notes = ?,
                        duration = ?
                            WHERE id = ?
                                `, [result, invoiceId, invoiceAmount, paymentCollected, paymentMethod, notes, duration, id]);
        res.json({ message: 'Visit updated successfully' });
    }
    catch (error) {
        console.error('Error updating customer visit:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update visit');
    }
});
exports.updateCustomerVisit = updateCustomerVisit;
// Delete a customer visit
const deleteCustomerVisit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { visitId } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM vehicle_customer_visits WHERE id = ?', [visitId]);
        res.json({ message: 'Visit deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting customer visit:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete visit');
    }
});
exports.deleteCustomerVisit = deleteCustomerVisit;
// ==========================================
// VEHICLE RETURNS (مرتجعات المبيعات المتنقلة)
// ==========================================
const getVehicleReturns = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, status, startDate, endDate } = req.query;
    try {
        let query = `
            SELECT vr.*,
                        v.plateNumber as vehicleName
            FROM vehicle_returns vr
            LEFT JOIN vehicles v ON vr.vehicleId = v.id
            WHERE 1 = 1
                        `;
        const params = [];
        if (vehicleId) {
            query += ` AND vr.vehicleId = ? `;
            params.push(vehicleId);
        }
        if (status) {
            query += ` AND vr.status = ? `;
            params.push(status);
        }
        if (startDate) {
            query += ` AND DATE(vr.returnDate) >= ? `;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND DATE(vr.returnDate) <= ? `;
            params.push(endDate);
        }
        query += ` ORDER BY vr.returnDate DESC LIMIT 200`;
        const [rows] = yield db_1.pool.query(query, params);
        // Get items for each return
        for (const row of rows) {
            const [items] = yield db_1.pool.query('SELECT * FROM vehicle_return_items WHERE returnId = ?', [row.id]);
            row.items = items;
        }
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching vehicle returns:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch returns');
    }
});
exports.getVehicleReturns = getVehicleReturns;
const createVehicleReturn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, customerId, customerName, returnDate, originalInvoiceId, returnType, returnReason, items, notes } = req.body;
    const user = req.user;
    if (!vehicleId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Vehicle ID and items are required' });
    }
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        const id = (0, uuid_1.v4)();
        const totalValue = items.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0);
        // Convert ISO date to MySQL format (YYYY-MM-DD HH:MM:SS)
        const mysqlDate = returnDate
            ? new Date(returnDate).toISOString().slice(0, 19).replace('T', ' ')
            : new Date().toISOString().slice(0, 19).replace('T', ' ');
        yield conn.query(`
            INSERT INTO vehicle_returns(
                            id, vehicleId, customerId, customerName, returnDate,
                            originalInvoiceId, returnType, returnReason, totalValue,
                            status, notes, createdBy
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
                            `, [
            id, vehicleId, customerId, customerName,
            mysqlDate, originalInvoiceId,
            returnType || 'OTHER', returnReason, totalValue,
            notes, (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'System'
        ]);
        // Insert items
        for (const item of items) {
            yield conn.query(`
                INSERT INTO vehicle_return_items(
                                returnId, productId, productName, quantity, unitPrice, totalPrice, reason
                            ) VALUES(?, ?, ?, ?, ?, ?, ?)
                                `, [
                id, item.productId, item.productName, item.quantity,
                item.unitPrice || 0, (item.quantity * (item.unitPrice || 0)), item.reason
            ]);
        }
        yield conn.commit();
        res.status(201).json({ id, message: 'Return created successfully', totalValue });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error creating vehicle return:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create return');
    }
    finally {
        conn.release();
    }
});
exports.createVehicleReturn = createVehicleReturn;
const processVehicleReturn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status, notes } = req.body;
    const user = req.user;
    if (!['APPROVED', 'REJECTED', 'PROCESSED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        // Get return details
        const [returns] = yield conn.query('SELECT * FROM vehicle_returns WHERE id = ?', [id]);
        if (returns.length === 0) {
            return res.status(404).json({ error: 'Return not found' });
        }
        const returnData = returns[0];
        // Update status
        yield conn.query(`
            UPDATE vehicle_returns SET
                    status = ?,
                        processedBy = ?,
                        processedAt = NOW(),
                        notes = CONCAT(COALESCE(notes, ''), '\n', ?)
            WHERE id = ?
                        `, [status, (user === null || user === void 0 ? void 0 : user.name) || 'System', notes || '', id]);
        // If approved/processed, adjust vehicle inventory
        if (status === 'APPROVED' || status === 'PROCESSED') {
            const [items] = yield conn.query('SELECT * FROM vehicle_return_items WHERE returnId = ?', [id]);
            for (const item of items) {
                // Decrease vehicle inventory
                yield conn.query(`
                    UPDATE vehicle_inventory 
                    SET quantity = quantity - ?
                        WHERE vehicleId = ? AND productId = ?
                            `, [item.quantity, returnData.vehicleId, item.productId]);
            }
        }
        yield conn.commit();
        res.json({ message: `Return ${status.toLowerCase()} successfully` });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error processing return:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'process return');
    }
    finally {
        conn.release();
    }
});
exports.processVehicleReturn = processVehicleReturn;
// ==========================================
// END OF DAY SETTLEMENT (تسوية نهاية اليوم)
// ==========================================
const getSettlements = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { vehicleId, status, startDate, endDate } = req.query;
    // Get salesman filter from auth token
    const userSalesmanFilter = getUserSalesmanFilter(req);
    try {
        // Note: vs.* includes totalExpenses and totalBankTransfers if they exist
        // The columns are added by migration on server start
        let query = `
            SELECT vs.*,
                        v.plateNumber as vehicleName,
                        v.plateNumber as vehiclePlateNumber,
                        s.name as salesmanName
            FROM vehicle_settlements vs
            LEFT JOIN vehicles v ON vs.vehicleId = v.id
            LEFT JOIN salesmen s ON v.salesmanId = s.id
            WHERE 1 = 1
                        `;
        const params = [];
        // If user is a salesman, only show their settlements
        if (userSalesmanFilter) {
            query += ` AND vs.salesmanId = ? `;
            params.push(userSalesmanFilter);
        }
        if (vehicleId) {
            query += ` AND vs.vehicleId = ? `;
            params.push(vehicleId);
        }
        if (status) {
            query += ` AND vs.status = ? `;
            params.push(status);
        }
        if (startDate) {
            query += ` AND vs.settlementDate >= ? `;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND vs.settlementDate <= ? `;
            params.push(endDate);
        }
        query += ` ORDER BY vs.settlementDate DESC LIMIT 100`;
        const [rows] = yield db_1.pool.query(query, params);
        // Fetch expenses and bank transfers details for each settlement
        const settlementsWithDetails = yield Promise.all(rows.map((settlement) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            // Get expense breakdown
            try {
                const [expenses] = yield db_1.pool.query('SELECT category, description, amount FROM settlement_expenses WHERE settlementId = ?', [settlement.id]);
                settlement.expenseDetails = expenses || [];
                // Calculate total expenses from the details
                settlement.totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
            }
            catch (e) {
                console.error(`❌ Error fetching expenses for settlement ${settlement.id}:`, e.message);
                settlement.expenseDetails = [];
                settlement.totalExpenses = 0;
            }
            // Calculate bank transfers from invoices for this settlement date range
            // Bank transfers are invoices with paymentMethod = 'BANK'
            // Get settlement date - convert to Egypt timezone for DATE() comparison
            const rawDate = settlement.settlementDate;
            const settDate = rawDate ? new Date(rawDate) : null;
            // Add 2 hours to convert UTC to Egypt time (UTC+2)
            // This ensures we compare with the same date that MariaDB's DATE() returns
            const egyptDate = settDate ? new Date(settDate.getTime() + 2 * 60 * 60 * 1000) : null;
            const dateStr = egyptDate ? egyptDate.toISOString().slice(0, 10) : null;
            // For APPROVED settlements, trust the stored immutable values, UNLESS they are 0 or missing (heuristic to fix bad saves or missing columns)
            // For SUBMITTED, calculate dynamically to handle old data with missing discounts.
            const storedDiscounts = Number(settlement.totalDiscounts);
            const storedBank = Number(settlement.totalBankTransfers || 0);
            // Check if we have valid stored data (Discounts OR Bank Transfers)
            // This is critical for Multi-Day settlements where dynamic recalculation (date-based) would fail
            const hasStoredDiscounts = !isNaN(storedDiscounts) && storedDiscounts !== 0;
            const hasStoredBank = !isNaN(storedBank) && storedBank !== 0;
            const hasStoredData = hasStoredDiscounts || hasStoredBank;
            if ((settlement.status === 'APPROVED' || settlement.status === 'SUBMITTED') && hasStoredData) {
                // APPROVED/SUBMITTED = use stored values if they exist
                // This preserves merged multi-day stats
                settlement.totalDiscounts = storedDiscounts;
                settlement.totalBankTransfers = storedBank;
            }
            else {
                if (settlement.status === 'APPROVED') {
                    console.log(`⚠️ Recalculating APPROVED settlement ${settlement.id} (Discounts: ${storedDiscounts})`);
                }
                // For SUBMITTED and other statuses, calculate discounts from invoices
                // This ensures we show correct values even if they weren't saved properly
                try {
                    // 1. Find the cutoff time (end of previous settlement)
                    // We only want invoices AFTER the previous settlement on the same day
                    // AND before the current settlement creation time (to respect its original scope)
                    // FIX: Use approvedAt (not createdAt) because invoices created before approval belong to that settlement
                    const [prevSettlement] = yield db_1.pool.query(`
                        SELECT COALESCE(approvedAt, createdAt) as cutoff 
                        FROM vehicle_settlements 
                        WHERE vehicleId = ?
                        AND settlementDate = ?
                            AND(status = 'APPROVED' OR status = 'SUBMITTED')
                        AND COALESCE(approvedAt, createdAt) < ?
                        ORDER BY COALESCE(approvedAt, createdAt) DESC LIMIT 1
                            `, [settlement.vehicleId, dateStr, settlement.createdAt]);
                    const cutoff = (_a = prevSettlement[0]) === null || _a === void 0 ? void 0 : _a.cutoff;
                    const cutoffFilter = cutoff ? 'AND createdAt > ?' : '';
                    // Check if this is the only settlement for this vehicle on this day
                    // If so, we can relax the 'createdAt <= settlement.createdAt' constraint
                    // This handles cases where invoices were synced/imported AFTER the settlement was created
                    const [settlementCount] = yield db_1.pool.query('SELECT COUNT(*) as cnt FROM vehicle_settlements WHERE vehicleId = ? AND settlementDate = ?', [settlement.vehicleId, dateStr]);
                    const isSingleSettlement = (((_b = settlementCount[0]) === null || _b === void 0 ? void 0 : _b.cnt) || 0) <= 1;
                    // Params: vehicleId, vehicleId (fallback), date, [cutoff], [settlement.createdAt]
                    const params = [settlement.vehicleId, settlement.vehicleId, dateStr];
                    if (cutoff)
                        params.push(cutoff);
                    // Only enforce upper bound if there are multiple settlements (to prevent overlap)
                    let upperBoundFilter = '';
                    if (!isSingleSettlement) {
                        upperBoundFilter = 'AND createdAt <= ?';
                        params.push(settlement.createdAt);
                    }
                    else {
                        if (settlement.status === 'APPROVED')
                            console.log(`⚠️ Relaxing timestamp constraint for settlement ${settlement.id} (Single settlement on ${dateStr})`);
                    }
                    // Calculate discounts from invoices for this vehicle/date WITHIN the time window
                    const [discountRows] = yield db_1.pool.query(`
                        SELECT COALESCE(SUM(discount + globalDiscount), 0) as totalDisc,
                        COALESCE(SUM(CASE WHEN paymentMethod = 'BANK' THEN total ELSE 0 END), 0) as totalBank
                        FROM invoices
                    WHERE(vehicleId = ? OR(salesmanId = (SELECT salesmanId FROM vehicles WHERE id = ?) AND vehicleId IS NULL))
                        AND DATE(date) = ?
                        AND status = 'POSTED'
                        AND (type = 'INVOICE_SALE' OR (type = 'RECEIPT' AND referenceInvoiceId IS NULL))
                        ${cutoffFilter}
                        ${upperBoundFilter}
                        `, params);
                    settlement.totalDiscounts = Number(((_c = discountRows[0]) === null || _c === void 0 ? void 0 : _c.totalDisc) || 0);
                    settlement.totalBankTransfers = Number(((_d = discountRows[0]) === null || _d === void 0 ? void 0 : _d.totalBank) || 0);
                }
                catch (e) {
                    // Fallback to stored values if query fails
                    settlement.totalDiscounts = Number(settlement.totalDiscounts || 0);
                    settlement.totalBankTransfers = Number(settlement.totalBankTransfers || 0);
                }
            }
            return settlement;
        })));
        // Debug: Count ALL bank invoices in the database for diagnostics
        try {
            const [allBankInvoices] = yield db_1.pool.query(`
                SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
                FROM invoices 
                WHERE paymentMethod = 'BANK' 
                AND status = 'POSTED'
                        `);
            console.log(`📊 Total BANK invoices in database: ${(_a = allBankInvoices[0]) === null || _a === void 0 ? void 0 : _a.count}, total amount: ${(_b = allBankInvoices[0]) === null || _b === void 0 ? void 0 : _b.total} `);
        }
        catch (e) {
            console.log('Could not count bank invoices:', e);
        }
        // Check if we need to include "Live" data for today
        // We include it if:
        // 1. We are querying for today (or no date filter which implies recent)
        // 2. The vehicle(s) in question don't have a settlement for today yet
        const today = new Date().toISOString().slice(0, 10);
        let includeLive = true;
        if (startDate && startDate > today)
            includeLive = false;
        if (endDate && endDate < today)
            includeLive = false;
        // If searching by specific status that isn't LIVE/DRAFT, don't show live
        if (status && status !== 'LIVE' && status !== 'DRAFT')
            includeLive = false;
        if (includeLive) {
            // Identify which vehicles we need to check
            let targetVehicleIds = [];
            if (vehicleId) {
                targetVehicleIds = [vehicleId];
            }
            else {
                // If no specific vehicle, we might need to fetch relevant vehicles
                // But to avoid performance issues, we limit to:
                // - The user's assigned vehicle (if salesman)
                // - OR all vehicles if admin (but this might be heavy, so maybe limit to active ones?)
                // For now, if no vehicleId is provided, we only do this if result set is small or user is salesman
                if (userSalesmanFilter) {
                    // Find vehicles for this salesman
                    const [salesmanVehicles] = yield db_1.pool.query('SELECT id FROM vehicles WHERE salesmanId = ?', [userSalesmanFilter]);
                    targetVehicleIds = salesmanVehicles.map((v) => v.id);
                }
                else {
                    // For admin viewing all, we grab all active vehicles
                    // PROD OPTIMIZATION: this might be heavy if you have 100s of vehicles. 
                    // Limit to those with activity today?
                    const [activeVehicles] = yield db_1.pool.query('SELECT id FROM vehicles WHERE status != "MAINTENANCE"');
                    targetVehicleIds = activeVehicles.map((v) => v.id);
                }
            }
            // Exclude vehicles that already have a settlement for today in the 'rows'
            // FIX: Convert settlementDate to string for proper comparison (DB returns Date object)
            const existingSettlementVehicleIds = new Set(rows.filter((r) => {
                const settDate = r.settlementDate;
                if (!settDate)
                    return false;
                // Convert Date to YYYY-MM-DD string, accounting for timezone
                const dateStr = settDate instanceof Date
                    ? new Date(settDate.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10) // Egypt UTC+2
                    : String(settDate).slice(0, 10);
                return dateStr === today;
            }).map((r) => r.vehicleId));
            const vehiclesToCalculate = targetVehicleIds.filter(vid => !existingSettlementVehicleIds.has(vid));
            // Calculate live stats for these vehicles
            const liveSettlements = yield Promise.all(vehiclesToCalculate.map((vid) => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b, _c;
                try {
                    // Check if there is ANY activity today before calling the heavy calc?
                    // Optional optimization. For now, just calc.
                    // Check if there is ANY activity today before calling the heavy calc?
                    // Optional optimization. For now, just calc.
                    const stats = yield (0, exports.calculateRefinedSettlementStats)(db_1.pool, vid, today);
                    // Only show if there's some activity to show
                    const hasActivity = stats.totalVisits > 0 || stats.loadedValue > 0 || stats.totalReturns > 0;
                    if (!hasActivity)
                        return null;
                    // Get basic vehicle info for the display
                    const [vInfo] = yield db_1.pool.query(`SELECT v.plateNumber as vehicleName, v.plateNumber as vehiclePlateNumber, s.name as salesmanName 
                         FROM vehicles v LEFT JOIN salesmen s ON v.salesmanId = s.id 
                         WHERE v.id = ? `, [vid]);
                    return Object.assign(Object.assign({ id: `LIVE - ${vid} -${today} `, vehicleId: vid, settlementDate: today, status: 'LIVE', vehicleName: (_a = vInfo[0]) === null || _a === void 0 ? void 0 : _a.vehicleName, vehiclePlateNumber: (_b = vInfo[0]) === null || _b === void 0 ? void 0 : _b.vehiclePlateNumber, salesmanName: (_c = vInfo[0]) === null || _c === void 0 ? void 0 : _c.salesmanName }, stats), { expenseDetails: [], totalBankTransfers: Number(stats.totalBankTransfers || 0), totalDiscounts: Number(stats.totalDiscounts || 0), cashDifference: stats.actualCash - stats.expectedCash // logic check
                     });
                }
                catch (e) {
                    console.error(`Error calculating live stats for vehicle ${vid}: `, e);
                    return null;
                }
            })));
            // Add valid live settlements to the list
            const validLive = liveSettlements.filter(s => s !== null);
            // Prepend live ones so they appear at the top
            res.json([...validLive, ...settlementsWithDetails]);
        }
        else {
            res.json(settlementsWithDetails);
        }
    }
    catch (error) {
        console.error('Error fetching settlements:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch settlements');
    }
});
exports.getSettlements = getSettlements;
const createSettlement = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, settlementDate, actualCash, notes, expenseDetails } = req.body;
    const user = req.user;
    if (!vehicleId) {
        return res.status(400).json({ error: 'Vehicle ID is required' });
    }
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        const date = settlementDate || new Date().toISOString().slice(0, 10);
        // Check if settlement already exists for this date
        const [existing] = yield conn.query('SELECT id, status FROM vehicle_settlements WHERE vehicleId = ? AND settlementDate = ? ORDER BY createdAt DESC', [vehicleId, date]);
        // Only block if there's an active (non-approved, non-submitted) settlement for this date
        // APPROVED settlements can have a new one created for additional work
        // SUBMITTED settlements can be updated by this quick settlement
        const activeSettlement = existing.find((s) => s.status !== 'APPROVED' && s.status !== 'SUBMITTED');
        if (activeSettlement) {
            return res.status(400).json({ error: 'Settlement already exists for this date. Use update instead.' });
        }
        // If there's a SUBMITTED settlement, update it instead of creating new
        // This ensures Quick Settlement updates the existing pending settlement rather than creating duplicates
        const submittedSettlement = existing.find((s) => s.status === 'SUBMITTED');
        const isUpdate = !!submittedSettlement;
        // Get vehicle info
        const [vehicle] = yield conn.query('SELECT v.*, s.name as salesmanName FROM vehicles v LEFT JOIN salesmen s ON v.salesmanId = s.id WHERE v.id = ?', [vehicleId]);
        if (vehicle.length === 0) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        // Calculate statistics using helper
        // When updating a SUBMITTED settlement, exclude it from cutoff calculation
        // so we don't lose visits created before the settlement was first created
        const excludeId = isUpdate && submittedSettlement ? submittedSettlement.id : undefined;
        const stats = yield (0, exports.calculateRefinedSettlementStats)(conn, vehicleId, date, excludeId);
        console.log(`🛠️ ${isUpdate ? 'Updating' : 'Creating'} Settlement: Sales = ${stats.totalSales}, Disc = ${stats.totalDiscounts}, Bank = ${stats.totalBankTransfers} `);
        // Expected cash = cash collected minus cash refunds for returns
        // Note: stats.expectedCash might already be calculated, but checking here
        const baseExpectedCash = stats.expectedCash;
        // Calculate total expenses from expenseDetails (provided by frontend)
        const expensesTotal = Array.isArray(expenseDetails)
            ? expenseDetails.reduce((sum, e) => sum + Number(e.amount || 0), 0)
            : 0;
        // Final expected cash = base expected - expenses
        const expectedCash = baseExpectedCash - expensesTotal;
        let settlementId;
        if (isUpdate && submittedSettlement) {
            // Update the existing SUBMITTED settlement
            settlementId = submittedSettlement.id;
            const result3 = yield conn.query(`
                UPDATE vehicle_settlements SET
                    salesmanId = ?, salesmanName = ?,
                        totalCashSales = ?, totalCreditSales = ?, totalSales = ?,
                        cashCollected = ?, totalCollections = ?,
                        totalReturns = ?, returnCount = ?,
                        loadedValue = ?, unloadedValue = ?, closingInventoryValue = ?,
                        plannedVisits = ?, completedVisits = ?, successfulVisits = ?,
                        expectedCash = ?, actualCash = ?, cashDifference = ?,
                        totalDiscounts = ?, totalBankTransfers = ?,
                        status = 'SUBMITTED', notes = ?, updatedAt = NOW()
                WHERE id = ? AND status = 'SUBMITTED'
                        `, [
                vehicle[0].salesmanId, vehicle[0].salesmanName,
                stats.totalCashSales, stats.totalCreditSales, stats.totalSales,
                stats.cashCollected, stats.totalCollections,
                stats.totalReturns, stats.returnCount,
                stats.loadedValue, stats.unloadedValue,
                stats.closingInventoryValue,
                stats.plannedVisits, stats.completedVisits, stats.successfulVisits,
                expectedCash, actualCash || 0, (actualCash || 0) - expectedCash,
                stats.totalDiscounts, stats.totalBankTransfers,
                notes, settlementId
            ]);
            if (result3[0].affectedRows > 0) {
                console.log(`📊 Updated existing SUBMITTED settlement ${settlementId} `);
            }
            else {
                yield conn.rollback();
                return res.status(409).json({ error: 'Settlement was approved during update. Please refresh and try again.' });
            }
        }
        else {
            // Create new settlement
            settlementId = (0, uuid_1.v4)();
            yield conn.query(`
                INSERT INTO vehicle_settlements(
                            id, vehicleId, settlementDate, salesmanId, salesmanName,
                            totalCashSales, totalCreditSales, totalSales,
                            cashCollected, totalCollections,
                            totalReturns, returnCount,
                            loadedValue, unloadedValue, closingInventoryValue,
                            plannedVisits, completedVisits, successfulVisits,
                            expectedCash, actualCash, cashDifference,
                            status, notes, createdBy, totalDiscounts, totalBankTransfers
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, ?, ?)
                            `, [
                settlementId, vehicleId, date,
                vehicle[0].salesmanId, vehicle[0].salesmanName,
                stats.totalCashSales, stats.totalCreditSales, stats.totalSales,
                stats.cashCollected, stats.totalCollections,
                stats.totalReturns, stats.returnCount,
                stats.loadedValue, stats.unloadedValue,
                stats.closingInventoryValue,
                stats.plannedVisits, stats.completedVisits, stats.successfulVisits,
                expectedCash, actualCash || 0, (actualCash || 0) - expectedCash,
                notes, (user === null || user === void 0 ? void 0 : user.name) || 'System',
                stats.totalDiscounts || 0, stats.totalBankTransfers || 0
            ]);
        }
        // Auto-create journal entry for the cash (no approval needed)
        if (actualCash > 0) {
            yield createSettlementJournalEntry(conn, {
                id: settlementId,
                settlementDate: date,
                salesmanName: vehicle[0].salesmanName,
                expectedCash // pass expected cash for logic
            }, actualCash, user, expenseDetails);
        }
        // Save expense details to settlement_expenses table
        if (expenseDetails && Array.isArray(expenseDetails) && expenseDetails.length > 0) {
            // Delete existing expenses first (for updates)
            yield conn.query('DELETE FROM settlement_expenses WHERE settlementId = ?', [settlementId]);
            for (const expense of expenseDetails) {
                const expenseId = (0, uuid_1.v4)();
                yield conn.query(`
                    INSERT INTO settlement_expenses(id, settlementId, category, description, amount, receiptNumber, expenseType)
                    VALUES(?, ?, ?, ?, ?, ?, ?)
                `, [expenseId, settlementId, expense.category || 'OTHER', expense.description || '', expense.amount || 0, expense.receiptNumber || null, expense.category === 'FUEL' ? 'FUEL' : 'MANUAL']);
            }
            console.log(`💰 Saved ${expenseDetails.length} expenses for settlement ${settlementId}`);
        }
        yield conn.commit();
        res.status(201).json({ id: settlementId, message: isUpdate ? 'Settlement updated successfully' : 'Settlement created successfully' });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error creating settlement:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create settlement');
    }
    finally {
        conn.release();
    }
});
exports.createSettlement = createSettlement;
// Helper: Calculate refined settlement stats
// Used for both creating settlements and "Live" view
const calculateRefinedSettlementStats = (conn_1, vehicleId_1, date_1, excludeSettlementId_1, ...args_1) => __awaiter(void 0, [conn_1, vehicleId_1, date_1, excludeSettlementId_1, ...args_1], void 0, function* (conn, vehicleId, date, excludeSettlementId, ignoreDateFilter = false) {
    // 1. Find cutoff time from latest APPROVED settlement for this vehicle
    // FIX: Use approvedAt (not createdAt) because we want to count transactions AFTER approval
    // FIX: Only look at APPROVED settlements (SUBMITTED should not block new calculations)
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    let cutoffQuery = `
        SELECT COALESCE(approvedAt, createdAt) as cutoff 
        FROM vehicle_settlements 
        WHERE vehicleId = ?
        AND status = 'APPROVED'
    `;
    const cutoffParams = [vehicleId];
    if (excludeSettlementId) {
        cutoffQuery += ` AND id != ? `;
        cutoffParams.push(excludeSettlementId);
    }
    cutoffQuery += ` ORDER BY COALESCE(approvedAt, createdAt) DESC LIMIT 1 `;
    const [lastSettlement] = yield conn.query(cutoffQuery, cutoffParams);
    const cutoff = (_a = lastSettlement[0]) === null || _a === void 0 ? void 0 : _a.cutoff;
    if (cutoff) {
        console.log(`🔒 Found APPROVED settlement cutoff: ${cutoff} - will only count data after this time`);
    }
    else {
        console.log(`📊 No prior APPROVED settlement found for vehicle ${vehicleId} - counting all data for date ${date}`);
    }
    // NOTE: For "Live" stats, we don't have an upper bound because we want everything up to now.
    // The previous stats logic is correct for "Live", but we need to respect prior SUBMITTED settlements too.
    // FIX: Use createdAt for Visits/Returns to capture late-syncs in the correct (current) settlement
    // instead of losing them if they backdate to a closed settlement's window.
    // IMPORTANT: Use table prefixes to avoid ambiguity when JOINing with other tables that have createdAt
    const timeFilter = cutoff ? ' AND v.createdAt > ?' : ''; // v = vehicle_customer_visits
    const returnFilter = cutoff ? ' AND createdAt > ?' : ''; // No JOIN here, so no prefix needed
    const operationFilter = cutoff ? ' AND vo.date > ?' : '';
    // Prepare params: standard [id, date] + optional [cutoff]
    // If ignoreDateFilter is true, we remove 'date' from the params list 
    // and rely on cutoff for the time window.
    // Visits
    const visitParams = [vehicleId];
    if (!ignoreDateFilter)
        visitParams.push(date);
    if (cutoff)
        visitParams.push(cutoff);
    // Returns
    const returnParams = [vehicleId];
    if (!ignoreDateFilter)
        returnParams.push(date);
    if (cutoff)
        returnParams.push(cutoff);
    // Operations
    const contextParams = [vehicleId];
    if (!ignoreDateFilter)
        contextParams.push(date);
    if (cutoff)
        contextParams.push(cutoff);
    // Discounts & Bank: Date is usually first param if filtered
    const discountParams = [];
    if (!ignoreDateFilter)
        discountParams.push(date);
    discountParams.push(vehicleId, vehicleId);
    if (cutoff)
        discountParams.push(cutoff);
    const bankParams = [];
    if (!ignoreDateFilter)
        bankParams.push(date);
    bankParams.push(vehicleId);
    if (cutoff)
        bankParams.push(cutoff);
    // Visits - properly calculating cash collected and credit sales
    const [visits] = yield conn.query(`
                    SELECT
                    COUNT(*) as totalVisits,
                        SUM(CASE WHEN result = 'SALE' THEN 1 ELSE 0 END) as successfulVisits,
                        SUM(COALESCE(v.invoiceAmount, 0)) as totalSales,
                        
                        -- Total Cash Collected (Base + Debt + Extra)
                        SUM(COALESCE(v.paymentCollected, 0) + COALESCE(v.debtCollected, 0)) as cashCollected,
                        
                        -- Cash Sales Component (Capped payment on CASH invoices)
                        SUM(CASE 
                            WHEN result = 'SALE' AND (i.paymentMethod = 'CASH' OR i.paymentMethod IS NULL)
                            THEN LEAST(COALESCE(v.paymentCollected, 0), COALESCE(v.invoiceAmount, 0))
                            ELSE 0 
                        END) as cashPartSales
                        
        FROM vehicle_customer_visits v
        LEFT JOIN invoices i ON v.invoiceId = i.id
        WHERE v.vehicleId = ? ${ignoreDateFilter ? '' : 'AND DATE(v.visitDate) = ?'} ${timeFilter}
                    `, visitParams);
    // Returns
    const [returns] = yield conn.query(`
        SELECT COUNT(*) as returnCount, COALESCE(SUM(totalValue), 0) as totalReturns
        FROM vehicle_returns 
        WHERE vehicleId = ? ${ignoreDateFilter ? '' : 'AND DATE(returnDate) = ?'} ${returnFilter}
                    `, returnParams);
    // Load/Unload operations
    const [operations] = yield conn.query(`
                    SELECT
                    COALESCE(SUM(CASE WHEN vo.operationType = 'LOAD' THEN voi.quantity * voi.cost END), 0) as loadedValue,
                        COALESCE(SUM(CASE WHEN vo.operationType = 'UNLOAD' THEN voi.quantity * voi.cost END), 0) as unloadedValue
        FROM vehicle_operations vo
        LEFT JOIN vehicle_operation_items voi ON vo.id = voi.operationId
        WHERE vo.vehicleId = ? ${ignoreDateFilter ? '' : 'AND DATE(vo.date) = ?'} ${operationFilter}
                    `, contextParams);
    // Current inventory value (Snapshot, no time filter needed as it represents current state)
    const [inventory] = yield conn.query(`
        SELECT COALESCE(SUM(vi.quantity * COALESCE(p.cost, 0)), 0) as closingValue
        FROM vehicle_inventory vi
        LEFT JOIN products p ON vi.productId = p.id
        WHERE vi.vehicleId = ?
                        `, [vehicleId]);
    // Calculate Discounts 
    // Use createdAt for time-windowing if cutoff exists
    const discountQuery = `
        SELECT COALESCE(SUM(COALESCE(globalDiscount, 0) + COALESCE(discount, 0)), 0) as totalDiscounts
        FROM invoices 
        WHERE ${ignoreDateFilter ? '1=1' : 'DATE(date) = ?'}
                        AND(vehicleId = ? OR(salesmanId = (SELECT salesmanId FROM vehicles WHERE id = ?) AND vehicleId IS NULL))
                    AND(type LIKE '%SALE%' AND type NOT LIKE '%RETURN%')
        AND status = 'POSTED'
        ${cutoff ? 'AND createdAt > ?' : ''}
                    `;
    // params: date, vehicleId, vehicleId
    // params: date, vehicleId, vehicleId
    const discountParams2 = [];
    if (!ignoreDateFilter)
        discountParams2.push(date);
    discountParams2.push(vehicleId, vehicleId);
    if (cutoff)
        discountParams2.push(cutoff);
    const [discounts] = yield conn.query(discountQuery, discountParams2);
    // Calculate Bank Transfers
    // FIX: Only count Sales Invoices paid by BANK, or Receipts that are NOT linked to an invoice (Debt Collection)
    // This prevents double counting if a Receipt is auto-generated for a Sale Invoice.
    const bankQuery = `
        SELECT COALESCE(SUM(total), 0) as totalBank
        FROM invoices 
        WHERE ${ignoreDateFilter ? '1=1' : 'DATE(date) = ?'}
        AND salesmanId = (SELECT salesmanId FROM vehicles WHERE id = ?)
        AND paymentMethod = 'BANK'
        AND status = 'POSTED'
        AND (type = 'INVOICE_SALE' OR (type = 'RECEIPT' AND referenceInvoiceId IS NULL))
        ${cutoff ? 'AND createdAt > ?' : ''}
    `;
    const [banks] = yield conn.query(bankQuery, bankParams);
    // === NEW: Query Treasury Payment Receipts (سند قبض) ===
    // These are stored in invoices table with type='RECEIPT' and linked to salesman
    // EXCLUDE auto-created receipts from van sales (referenceInvoiceId IS NOT NULL)
    const treasuryReceiptQuery = `
        SELECT COALESCE(SUM(total), 0) as totalReceipts
        FROM invoices 
        WHERE DATE(date) = ?
        AND salesmanId = (SELECT salesmanId FROM vehicles WHERE id = ?)
        AND type = 'RECEIPT' 
        AND status = 'POSTED'
        AND referenceInvoiceId IS NULL
        ${cutoff ? 'AND createdAt > ?' : ''}
    `;
    const receiptParams = [date, vehicleId];
    if (cutoff)
        receiptParams.push(cutoff);
    const [treasuryReceipts] = yield conn.query(treasuryReceiptQuery, receiptParams);
    const treasuryReceiptsTotal = Number(((_b = treasuryReceipts[0]) === null || _b === void 0 ? void 0 : _b.totalReceipts) || 0);
    // cashCollected = total of all paymentCollected (includes debt collections beyond invoice amounts)
    const cashCollected = Number(((_c = visits[0]) === null || _c === void 0 ? void 0 : _c.cashCollected) || 0);
    // totalCashSales = invoice amounts minus any unpaid (credit) portions
    // For cash sales: the portion of invoices covered by payments (capped at invoice amount)
    const totalSales = Number(((_d = visits[0]) === null || _d === void 0 ? void 0 : _d.totalSales) || 0);
    // cashPartSales comes from SQL query (payment collected on CASH invoices)
    const totalCashSales = Number(((_e = visits[0]) === null || _e === void 0 ? void 0 : _e.cashPartSales) || 0);
    // Derived credit sales: Total Sales - Cash Sales
    const totalCreditSales = totalSales - totalCashSales;
    const totalReturns = Number(((_f = returns[0]) === null || _f === void 0 ? void 0 : _f.totalReturns) || 0);
    // Include treasury receipts in total collections
    const totalCollectionsWithReceipts = cashCollected + treasuryReceiptsTotal;
    // FIX: Expected cash should exclude Bank Transfers (as they are not collected in cash)
    const totalBank = Number(((_g = banks[0]) === null || _g === void 0 ? void 0 : _g.totalBank) || 0); // Use the calculated bank total
    const expectedCash = totalCollectionsWithReceipts - totalReturns - totalBank;
    // Log for debugging
    if (cutoff) {
        console.log(`🧮 Calculated refined stats with cutoff ${cutoff.toISOString()}: Sales = ${totalSales}, Collection = ${cashCollected}, Bank = ${totalBank}, Treasury = ${treasuryReceiptsTotal}`);
    }
    return {
        totalCashSales,
        totalCreditSales: Math.max(0, totalCreditSales), // Credit sales should not be negative
        totalSales,
        cashCollected: totalCollectionsWithReceipts, // Now includes treasury receipts
        totalCollections: totalCollectionsWithReceipts, // Now includes treasury receipts
        treasuryReceipts: treasuryReceiptsTotal, // New field for transparency
        totalReturns,
        returnCount: Number(((_h = returns[0]) === null || _h === void 0 ? void 0 : _h.returnCount) || 0),
        loadedValue: Number(((_j = operations[0]) === null || _j === void 0 ? void 0 : _j.loadedValue) || 0),
        unloadedValue: Number(((_k = operations[0]) === null || _k === void 0 ? void 0 : _k.unloadedValue) || 0),
        closingInventoryValue: Number(((_l = inventory[0]) === null || _l === void 0 ? void 0 : _l.closingValue) || 0),
        plannedVisits: 0,
        completedVisits: Number(((_m = visits[0]) === null || _m === void 0 ? void 0 : _m.totalVisits) || 0),
        totalVisits: Number(((_o = visits[0]) === null || _o === void 0 ? void 0 : _o.totalVisits) || 0),
        successfulVisits: Number(((_p = visits[0]) === null || _p === void 0 ? void 0 : _p.successfulVisits) || 0),
        expectedCash,
        actualCash: 0, // Default actual cash to 0 for stats
        totalDiscounts: Number(((_q = discounts[0]) === null || _q === void 0 ? void 0 : _q.totalDiscounts) || 0),
        totalBankTransfers: Number(((_r = banks[0]) === null || _r === void 0 ? void 0 : _r.totalBank) || 0)
    };
});
exports.calculateRefinedSettlementStats = calculateRefinedSettlementStats;
const updateSettlement = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { settlementId } = req.params;
    const { actualCash, notes, status, disputeReason, openingCash, totalExpenses, expenseDetails } = req.body;
    const user = req.user;
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        // Get current settlement with row lock to prevent race conditions
        const [current] = yield conn.query('SELECT * FROM vehicle_settlements WHERE id = ? FOR UPDATE', [settlementId]);
        if (current.length === 0) {
            yield conn.rollback();
            return res.status(404).json({ error: 'Settlement not found' });
        }
        const settlement = current[0];
        const updates = [];
        const params = [];
        // Update basic fields
        if (openingCash !== undefined) {
            updates.push('openingCash = ?');
            params.push(openingCash);
        }
        if (totalExpenses !== undefined) {
            updates.push('totalExpenses = ?');
            params.push(totalExpenses);
        }
        if (actualCash !== undefined) {
            updates.push('actualCash = ?');
            params.push(actualCash);
            // Recalculate expected cash considering new values
            const newOpeningCash = (_a = openingCash !== null && openingCash !== void 0 ? openingCash : settlement.openingCash) !== null && _a !== void 0 ? _a : 0;
            const newExpenses = (_b = totalExpenses !== null && totalExpenses !== void 0 ? totalExpenses : settlement.totalExpenses) !== null && _b !== void 0 ? _b : 0;
            const expectedCash = newOpeningCash +
                (settlement.totalCashSales || 0) +
                (settlement.cashCollected || 0) -
                (settlement.totalReturns || 0) -
                newExpenses;
            updates.push('expectedCash = ?');
            params.push(expectedCash);
            updates.push('cashDifference = ?');
            params.push(actualCash - expectedCash);
        }
        if (notes !== undefined) {
            updates.push('notes = ?');
            params.push(notes);
        }
        // Handle status changes
        if (status) {
            updates.push('status = ?');
            params.push(status);
            if (status === 'APPROVED') {
                // SAFETY CHECK: Prevent re-approval (prevents duplicate journal entries)
                if (settlement.status === 'APPROVED') {
                    yield conn.rollback();
                    return res.status(400).json({ error: 'This settlement is already approved.' });
                }
                updates.push('approvedBy = ?');
                params.push((user === null || user === void 0 ? void 0 : user.name) || 'System');
                updates.push('approvedAt = NOW()');
                // Generate journal entry for cash receipt from salesman and expenses
                yield createSettlementJournalEntry(conn, settlement, actualCash !== null && actualCash !== void 0 ? actualCash : settlement.actualCash, user, expenseDetails);
            }
            if (status === 'DISPUTED') {
                updates.push('disputeReason = ?');
                params.push(disputeReason || 'لم يتم تحديد السبب');
            }
        }
        if (updates.length === 0) {
            yield conn.rollback();
            return res.status(400).json({ error: 'No updates provided' });
        }
        // Update settlement
        params.push(settlementId);
        yield conn.query(`UPDATE vehicle_settlements SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ? `, params);
        // Handle expense details (table might not exist yet)
        if (expenseDetails && Array.isArray(expenseDetails)) {
            try {
                // Delete existing expenses
                yield conn.query('DELETE FROM settlement_expenses WHERE settlementId = ?', [settlementId]);
                // Insert new expenses
                for (const expense of expenseDetails) {
                    const expenseId = (0, uuid_1.v4)();
                    yield conn.query(`
                        INSERT INTO settlement_expenses(id, settlementId, category, description, amount, receiptNumber, expenseType)
                    VALUES(?, ?, ?, ?, ?, ?, ?)
                    `, [expenseId, settlementId, expense.category || 'OTHER', expense.description || '', expense.amount || 0, expense.receiptNumber || null, expense.category === 'FUEL' ? 'FUEL' : 'MANUAL']);
                }
            }
            catch (e) {
                console.log('Expense table might not exist yet, skipping expense details');
            }
        }
        yield conn.commit();
        // If settlement was approved, notify the salesman via WebSocket
        if (status === 'APPROVED') {
            const io = req.app.get('io');
            if (io) {
                // Emit to all clients - mobile will filter by salesmanId
                io.emit('settlement:approved', {
                    settlementId,
                    salesmanId: settlement.salesmanId,
                    settlementDate: settlement.settlementDate,
                    approvedBy: (user === null || user === void 0 ? void 0 : user.name) || 'System',
                    message: 'تم اعتماد التسوية - سيتم تصفير بيانات اليوم'
                });
                console.log(`📢 Settlement ${settlementId} approved - notifying salesman ${settlement.salesmanId} `);
            }
        }
        res.json({ message: 'Settlement updated successfully', status: status || settlement.status });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error updating settlement:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update settlement');
    }
    finally {
        conn.release();
    }
});
exports.updateSettlement = updateSettlement;
// Helper: Create journal entry when settlement is approved
function createSettlementJournalEntry(conn, settlement, actualCash, user, expenseDetails) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const expectedCash = settlement.expectedCash || 0;
            const cashDifference = actualCash - expectedCash; // Negative = deficit
            // Get Treasury account
            const [cashAccounts] = yield conn.query(`
            SELECT id, name FROM accounts 
            WHERE type = 'ASSET'
                    AND(name LIKE '%صندوق%' OR name LIKE '%خزينة%' OR name LIKE '%نقدية%' OR code LIKE '11%')
            LIMIT 1
        `);
            if (cashAccounts.length === 0) {
                console.log('⚠️ No treasury account found for journal entry');
                return;
            }
            const treasuryAccountId = cashAccounts[0].id;
            // Find or create Salesman Custody Account (عهدة المندوب)
            let salesmanCustodyAccountId;
            const custodyAccountName = `عهدة ${settlement.salesmanName || 'المندوب'} `;
            let [custodyAccounts] = yield conn.query(`SELECT id FROM accounts WHERE name = ? LIMIT 1`, [custodyAccountName]);
            if (custodyAccounts.length === 0) {
                // Try generic custody account
                [custodyAccounts] = yield conn.query(`SELECT id FROM accounts WHERE name LIKE '%عهدة%' AND type = 'ASSET' LIMIT 1`);
            }
            if (custodyAccounts.length === 0) {
                // Create custody account for this salesman
                salesmanCustodyAccountId = (0, uuid_1.v4)();
                yield conn.query(`
                INSERT INTO accounts(id, code, name, type, balance)
                    VALUES(?, ?, ?, 'ASSET', 0)
            `, [salesmanCustodyAccountId, `CUST - ${((_a = settlement.salesmanId) === null || _a === void 0 ? void 0 : _a.slice(0, 8)) || 'GEN'} `, custodyAccountName]);
                console.log(`📗 Created salesman custody account: ${custodyAccountName} `);
            }
            else {
                salesmanCustodyAccountId = custodyAccounts[0].id;
            }
            // Find or create Deficit Account (عجز المناديب) - only if there's a deficit
            let deficitAccountId = null;
            if (cashDifference < 0) {
                const [deficitAccounts] = yield conn.query(`SELECT id FROM accounts WHERE(name LIKE '%عجز%' OR name LIKE '%deficit%') AND type = 'EXPENSE' LIMIT 1`);
                if (deficitAccounts.length === 0) {
                    // Create deficit account
                    deficitAccountId = (0, uuid_1.v4)();
                    yield conn.query(`
                    INSERT INTO accounts(id, code, name, type, balance)
                    VALUES(?, 'DEF-SAL', 'عجز المناديب', 'EXPENSE', 0)
                `, [deficitAccountId]);
                    console.log(`📗 Created deficit account: عجز المناديب`);
                }
                else {
                    deficitAccountId = deficitAccounts[0].id;
                }
            }
            // Create main journal entry
            const journalId = (0, uuid_1.v4)();
            yield conn.query(`
            INSERT INTO journal_entries(id, date, description, referenceId)
                    VALUES(?, ?, ?, ?)
        `, [
                journalId,
                settlement.settlementDate,
                `تسوية نهاية اليوم - ${settlement.salesmanName || 'المندوب'} - ${settlement.settlementDate} `,
                settlement.id
            ]);
            // ===== BALANCED JOURNAL ENTRY =====
            // NOTE: Treasury is NOT debited here because individual receipt journal entries
            // already debited the treasury when payments were collected (تحصيل بيع متنقل).
            // This settlement journal only handles:
            // 1. Credit Custody account (to clear salesman's balance)
            // 2. Debit Receivables/Deficit (to balance the entry)
            // REMOVED: Treasury debit - this was causing double-counting!
            // The actualCash was already recorded via individual RECEIPT invoices
            // created in createVanSaleVisit() with their own journal entries.
            console.log(`⚠️ Settlement: Treasury NOT debited (already done via receipts). actualCash=${actualCash}`);
            // Debit: Deficit Account (if cashDifference < 0)
            if (cashDifference < 0 && deficitAccountId) {
                const deficitAmount = Math.abs(cashDifference);
                yield conn.query(`
                INSERT INTO journal_lines(journalId, accountId, debit, credit)
                    VALUES(?, ?, ?, 0)
                        `, [journalId, deficitAccountId, deficitAmount]);
                // Update deficit account balance
                yield conn.query(`
                UPDATE accounts SET balance = COALESCE(balance, 0) + ? WHERE id = ?
                        `, [deficitAmount, deficitAccountId]);
                console.log(`⚠️ Deficit of ${deficitAmount} recorded for ${settlement.salesmanName}`);
            }
            // Credit: Salesman Custody Account (expected cash - this is what was owed to company)
            if (expectedCash > 0) {
                yield conn.query(`
                INSERT INTO journal_lines(journalId, accountId, debit, credit)
                    VALUES(?, ?, 0, ?)
                        `, [journalId, salesmanCustodyAccountId, expectedCash]);
                // Update custody account balance (reduce what salesman owes)
                yield conn.query(`
                UPDATE accounts SET balance = COALESCE(balance, 0) - ? WHERE id = ?
                        `, [expectedCash, salesmanCustodyAccountId]);
            }
            console.log(`✅ Settlement journal entry created: ${journalId} `);
            console.log(`   💵 Treasury(Debit): 0 (already done via individual receipts)`);
            console.log(`   📉 Deficit(Debit): ${cashDifference < 0 ? Math.abs(cashDifference) : 0} `);
            console.log(`   👤 Custody(Credit): ${expectedCash} `);
            // === CREATE EXPENSE JOURNAL ENTRIES ===
            if (expenseDetails && Array.isArray(expenseDetails) && expenseDetails.length > 0) {
                console.log(`📝 Creating journal entries for ${expenseDetails.length} expenses...`);
                const expenseAccountMapping = {
                    'FUEL': 'مصروفات بنزين',
                    'FOOD': 'مصروفات وجبات',
                    'DELIVERY': 'مصروفات توصيل',
                    'PARKING': 'مصروفات انتظار',
                    'MAINTENANCE': 'مصروفات صيانة',
                    'OTHER': 'مصروفات أخرى'
                };
                for (const expense of expenseDetails) {
                    if (!expense.amount || expense.amount <= 0)
                        continue;
                    const categoryName = expenseAccountMapping[expense.category] || 'مصروفات أخرى';
                    // Find or create expense account
                    let [expenseAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE name = ? LIMIT 1`, [categoryName]);
                    let expenseAccountId;
                    if (expenseAccounts.length === 0) {
                        [expenseAccounts] = yield conn.query(`SELECT id, name FROM accounts WHERE type = 'EXPENSE' AND name LIKE '%مصروفات%' LIMIT 1`);
                        if (expenseAccounts.length === 0) {
                            expenseAccountId = (0, uuid_1.v4)();
                            yield conn.query(`
                            INSERT INTO accounts(id, code, name, type, balance)
                    VALUES(?, ?, ?, 'EXPENSE', 0)
                        `, [expenseAccountId, `EXP - ${expense.category} `, categoryName]);
                            console.log(`📗 Created expense account: ${categoryName} `);
                        }
                        else {
                            expenseAccountId = expenseAccounts[0].id;
                        }
                    }
                    else {
                        expenseAccountId = expenseAccounts[0].id;
                    }
                    // Create expense journal entry
                    const expenseJournalId = (0, uuid_1.v4)();
                    const expenseDescription = expense.description
                        ? `${categoryName}: ${expense.description} - ${settlement.salesmanName || 'المندوب'} `
                        : `${categoryName} - ${settlement.salesmanName || 'المندوب'} `;
                    yield conn.query(`
                    INSERT INTO journal_entries(id, date, description, referenceId)
                    VALUES(?, ?, ?, ?)
                        `, [
                        expenseJournalId,
                        settlement.settlementDate,
                        expenseDescription,
                        settlement.id
                    ]);
                    // Debit: Expense Account
                    yield conn.query(`
                    INSERT INTO journal_lines(journalId, accountId, debit, credit)
                    VALUES(?, ?, ?, 0)
                        `, [expenseJournalId, expenseAccountId, expense.amount]);
                    // Credit: Treasury (Cash Out for expense)
                    yield conn.query(`
                    INSERT INTO journal_lines(journalId, accountId, debit, credit)
                    VALUES(?, ?, 0, ?)
                        `, [expenseJournalId, treasuryAccountId, expense.amount]);
                    // Update account balances
                    yield conn.query(`
                    UPDATE accounts SET balance = COALESCE(balance, 0) + ? WHERE id = ?
                        `, [expense.amount, expenseAccountId]);
                    yield conn.query(`
                    UPDATE accounts SET balance = COALESCE(balance, 0) - ? WHERE id = ?
                        `, [expense.amount, treasuryAccountId]);
                    console.log(`💰 Expense journal entry created: ${expenseDescription} - ${expense.amount} `);
                }
            }
        }
        catch (error) {
            console.error('❌ Error creating settlement journal entry:', error);
            // Don't throw - settlement should still succeed
        }
    });
}
// Approve settlement endpoint
const approveSettlement = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { settlementId } = req.params;
    const user = req.user;
    req.body.status = 'APPROVED';
    return (0, exports.updateSettlement)(req, res);
});
exports.approveSettlement = approveSettlement;
// Dispute settlement endpoint
const disputeSettlement = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { settlementId } = req.params;
    const { reason } = req.body;
    req.body.status = 'DISPUTED';
    req.body.disputeReason = reason;
    return (0, exports.updateSettlement)(req, res);
});
exports.disputeSettlement = disputeSettlement;
// Submit settlement (salesman submits for review)
const submitSettlement = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { settlementId } = req.params;
    req.body.status = 'SUBMITTED';
    return (0, exports.updateSettlement)(req, res);
});
exports.submitSettlement = submitSettlement;
// Get approved settlements for a salesman (for mobile sync - triggers data clearing)
const getApprovedSettlements = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const { salesmanId, since } = req.query;
        // Use user's salesmanId if not provided
        const targetSalesmanId = salesmanId || (user === null || user === void 0 ? void 0 : user.salesmanId);
        // Get settlements approved in the last 7 days (or since specified date)
        const sinceDate = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        let query = `
            SELECT id, settlementDate, salesmanId, salesmanName, approvedAt, approvedBy, status
            FROM vehicle_settlements 
            WHERE status = 'APPROVED'
            AND approvedAt >= ?
                        `;
        const params = [sinceDate];
        if (targetSalesmanId) {
            query += ' AND salesmanId = ?';
            params.push(targetSalesmanId);
        }
        query += ' ORDER BY approvedAt DESC LIMIT 10';
        const [rows] = yield db_1.pool.query(query, params);
        res.json({
            approvedSettlements: rows,
            count: rows.length,
            message: rows.length > 0 ? 'تم العثور على تسويات معتمدة - يجب تصفير البيانات' : 'لا توجد تسويات معتمدة جديدة'
        });
    }
    catch (error) {
        console.error('Error getting approved settlements:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'get approved settlements');
    }
});
exports.getApprovedSettlements = getApprovedSettlements;
// Delete settlement
const deleteSettlement = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { settlementId } = req.params;
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        // Approved settlements can now be deleted
        // Delete related expenses first (table might not exist yet)
        try {
            yield conn.query('DELETE FROM settlement_expenses WHERE settlementId = ?', [settlementId]);
        }
        catch (e) { /* Table might not exist */ }
        // Delete related cheques (table might not exist yet)
        try {
            yield conn.query('DELETE FROM settlement_cheques WHERE settlementId = ?', [settlementId]);
        }
        catch (e) { /* Table might not exist */ }
        // Delete settlement
        yield conn.query('DELETE FROM vehicle_settlements WHERE id = ?', [settlementId]);
        yield conn.commit();
        res.json({ message: 'Settlement deleted successfully' });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error deleting settlement:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete settlement');
    }
    finally {
        conn.release();
    }
});
exports.deleteSettlement = deleteSettlement;
// ==========================================
// DAILY REPORT (التقرير اليومي)
// ==========================================
const getDailyReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    // Check both query and params for vehicleId
    const vehicleId = req.query.vehicleId || req.params.id;
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().slice(0, 10);
    if (!vehicleId) {
        return res.status(400).json({ error: 'Vehicle ID is required' });
    }
    try {
        // Get vehicle info
        const [vehicle] = yield db_1.pool.query(`
            SELECT v.*, s.name as salesmanName
            FROM vehicles v
            LEFT JOIN salesmen s ON v.salesmanId = s.id
            WHERE v.id = ?
                        `, [vehicleId]);
        if (vehicle.length === 0) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        // ✅ Find the latest approved settlement's approval time for this vehicle/date
        // This is used to filter out visits that were already settled
        // Use DATE() on both sides for consistent comparison
        console.log(`📊 Daily Report Request: vehicleId = ${vehicleId}, reportDate = ${reportDate} `);
        const [latestApproved] = yield db_1.pool.query(`
            SELECT id, settlementDate, COALESCE(approvedAt, updatedAt, createdAt) as approvalTime 
            FROM vehicle_settlements 
            WHERE vehicleId = ? AND status = 'APPROVED' 
            ORDER BY COALESCE(approvedAt, updatedAt, createdAt) DESC LIMIT 1
        `, [vehicleId]);
        const hasApprovedSettlements = latestApproved.length > 0;
        const cutoffTime = hasApprovedSettlements ? latestApproved[0].approvalTime : null;
        console.log(`📊 Daily Report: hasApprovedSettlements = ${hasApprovedSettlements}, cutoffTime = ${cutoffTime} `);
        if (hasApprovedSettlements) {
            console.log(`📊 Found approved settlement: id = ${latestApproved[0].id}, settlementDate = ${latestApproved[0].settlementDate} `);
        }
        // Build time filter for visits - only count visits AFTER last approved settlement
        // IMPORTANT: Use v.createdAt (when synced to server) instead of v.visitDate (when visit happened)
        // This handles cases where visits are synced late but should be counted in the new settlement
        let visitTimeFilter = '';
        const visitParams = [vehicleId];
        if (cutoffTime) {
            visitTimeFilter = ' AND v.createdAt > ?';
            visitParams.push(cutoffTime);
            console.log(`📊 Daily Report: Filtering visits by createdAt > ${cutoffTime}`);
        }
        else {
            console.log(`📊 Daily Report: No previous approved settlement. Fetching ALL visits.`);
        }
        // Visits statistics - now properly separating SALE and RETURN
        const [visits] = yield db_1.pool.query(`
                    SELECT
                    COUNT(*) as totalVisits,
                        SUM(CASE WHEN result = 'SALE' THEN 1 ELSE 0 END) as successfulVisits,
                        SUM(CASE WHEN result NOT IN('SALE', 'RETURN') THEN 1 ELSE 0 END) as unsuccessfulVisits,
                        SUM(CASE WHEN result = 'RETURN' THEN 1 ELSE 0 END) as returnVisits,
                        SUM(CASE WHEN result = 'SALE' THEN COALESCE(v.invoiceAmount, 0) ELSE 0 END) as totalSalesAmount,
                        
                        -- ✅ Calculate discounts from visits (invoiceAmount - paymentCollected)
                        -- No need to check payment method - if customer paid less than invoice, it's a discount
                        COALESCE(SUM(CASE 
                            WHEN result = 'SALE' 
                            AND v.invoiceAmount > v.paymentCollected 
                            AND v.paymentCollected > 0
                            THEN v.invoiceAmount - v.paymentCollected 
                            ELSE 0 
                        END), 0) as discountsFromVisits,
                        

                        -- Cash Sales: Only if paymentMethod is CASH (capped at invoice amount)
                        SUM(CASE 
                            WHEN result = 'SALE' AND (i.paymentMethod = 'CASH' OR i.paymentMethod IS NULL)
                            THEN LEAST(COALESCE(v.paymentCollected, 0), COALESCE(v.invoiceAmount, 0)) 
                            ELSE 0 
                        END) as cashSales,

                        -- Bank Sales: New field to track bank transfers
                        SUM(CASE 
                            WHEN result = 'SALE' AND (i.paymentMethod = 'BANK' OR i.paymentMethod = 'BANK_TRANSFER')
                            THEN LEAST(COALESCE(v.paymentCollected, 0), COALESCE(v.invoiceAmount, 0)) 
                            ELSE 0 
                        END) as bankSales,

                        SUM(CASE WHEN result = 'RETURN' THEN COALESCE(v.invoiceAmount, 0) ELSE 0 END) as totalReturnsAmount,
                        COUNT(CASE WHEN result = 'SALE' AND invoiceId IS NOT NULL THEN 1 END) as salesCount,
                        COUNT(CASE WHEN result = 'RETURN' AND invoiceId IS NOT NULL THEN 1 END) as returnsCount,
                        AVG(duration) as avgVisitDuration,
                        
                        -- Explicit debt collection (from visit form)
                        COALESCE(SUM(v.debtCollected), 0) as baseDebtCollected,
                        
                        -- Extra collected from CASH sales (overpayment)
                        COALESCE(SUM(CASE 
                            WHEN result = 'SALE' AND (i.paymentMethod = 'CASH' OR i.paymentMethod IS NULL) AND v.paymentCollected > v.invoiceAmount 
                            THEN v.paymentCollected - v.invoiceAmount 
                            ELSE 0 
                        END), 0) as extraFromCashSales,

                        -- Collected from CREDIT sales (down payments/partial payments)
                        -- These are NOT cash sales, they are debt collections
                        COALESCE(SUM(CASE 
                            WHEN result = 'SALE' AND i.paymentMethod = 'CREDIT'
                            THEN v.paymentCollected 
                            ELSE 0 
                        END), 0) as collectedFromCreditSales

            FROM vehicle_customer_visits v
            LEFT JOIN invoices i ON v.invoiceId = i.id
            WHERE v.vehicleId = ? ${visitTimeFilter}
                    `, visitParams);
        console.log('🐞 getDailyReport DEBUG:', {
            vehicleId,
            reportDate,
            visitData: visits[0]
        });
        // Fetch Total Discounts from Invoices (linked to visits) - also filter by cutoff time
        const discountParams = [vehicleId];
        let discountTimeFilter = '';
        if (cutoffTime) {
            discountTimeFilter = ' AND cv.createdAt > ?'; // Use createdAt for consistent cutoff
            discountParams.push(cutoffTime);
        }
        const [discounts] = yield db_1.pool.query(`
            SELECT COALESCE(SUM(COALESCE(i.globalDiscount, 0) + COALESCE(i.discount, 0)), 0) as totalDiscounts
            FROM vehicle_customer_visits cv
            JOIN invoices i ON cv.invoiceId = i.id
            WHERE cv.vehicleId = ? AND i.type = 'INVOICE_SALE'${discountTimeFilter}
                    `, discountParams);
        // Also check vehicle_returns table for older returns format - also filter by cutoff time
        const returnParams = [vehicleId];
        let returnTimeFilter = '';
        if (cutoffTime) {
            returnTimeFilter = ' AND createdAt > ?'; // Use createdAt for consistent cutoff
            returnParams.push(cutoffTime);
        }
        const [oldReturns] = yield db_1.pool.query(`
            SELECT COUNT(*) as returnsCount, COALESCE(SUM(totalValue), 0) as totalReturns
            FROM vehicle_returns 
            WHERE vehicleId = ? ${returnTimeFilter}
                    `, returnParams);
        // === NEW: Query Treasury Payment Receipts (سند قبض) ===
        // These are stored in invoices table with type='RECEIPT' and linked to salesman
        const salesmanId = vehicle[0].salesmanId;
        let treasuryReceiptsTotal = 0;
        if (salesmanId) {
            const receiptParams = [salesmanId];
            let receiptTimeFilter = '';
            if (cutoffTime) {
                receiptTimeFilter = ' AND createdAt > ?';
                receiptParams.push(cutoffTime);
            }
            const [treasuryReceipts] = yield db_1.pool.query(`
                SELECT COALESCE(SUM(total), 0) as totalReceipts
                FROM invoices 
                WHERE salesmanId = ? 
                AND type = 'RECEIPT' 
                AND status = 'POSTED'
                AND referenceInvoiceId IS NULL
                ${receiptTimeFilter}
            `, receiptParams);
            treasuryReceiptsTotal = Number(((_a = treasuryReceipts[0]) === null || _a === void 0 ? void 0 : _a.totalReceipts) || 0);
            console.log(`📊 Daily Report: Treasury receipts for salesman ${salesmanId}: ${treasuryReceiptsTotal}`);
        }
        // Fuel Logs (Expenses)
        const [fuelLogs] = yield db_1.pool.query(`
            SELECT COALESCE(SUM(totalCost), 0) as totalFuel,
                        JSON_ARRAYAGG(JSON_OBJECT(
                            'category', 'FUEL',
                            'description', CONCAT('بنزين: ', liters, ' لتر'),
                            'amount', totalCost,
                            'date', fuelDate
                        )) as fuelDetails
            FROM vehicle_fuel_logs
            WHERE vehicleId = ? AND fuelDate = ?
                        `, [vehicleId, reportDate]);
        // Maintenance Records (Expenses)
        const [maintenance] = yield db_1.pool.query(`
            SELECT COALESCE(SUM(cost), 0) as totalMaintenance,
                        JSON_ARRAYAGG(JSON_OBJECT(
                            'category', 'MAINTENANCE',
                            'description', COALESCE(description, 'صيانة'),
                            'amount', cost,
                            'date', completedDate
                        )) as maintenanceDetails
            FROM vehicle_maintenance
            WHERE vehicleId = ?
                        AND(DATE(completedDate) = ? OR(status = 'COMPLETED' AND DATE(scheduledDate) = ?))
                            `, [vehicleId, reportDate, reportDate]);
        // Operations
        const [operations] = yield db_1.pool.query(`
            SELECT
                    SUM(CASE WHEN vo.operationType = 'LOAD' THEN 1 ELSE 0 END) as loadCount,
                        COALESCE(SUM(CASE WHEN vo.operationType = 'LOAD' THEN voi.quantity END), 0) as loadedItems,
                        COALESCE(SUM(CASE WHEN vo.operationType = 'LOAD' THEN voi.quantity * voi.cost END), 0) as loadedValue,
                        SUM(CASE WHEN vo.operationType = 'UNLOAD' THEN 1 ELSE 0 END) as unloadCount,
                        COALESCE(SUM(CASE WHEN vo.operationType = 'UNLOAD' THEN voi.quantity END), 0) as unloadedItems,
                        COALESCE(SUM(CASE WHEN vo.operationType = 'UNLOAD' THEN voi.quantity * voi.cost END), 0) as unloadedValue
            FROM vehicle_operations vo
            LEFT JOIN vehicle_operation_items voi ON vo.id = voi.operationId
            WHERE vo.vehicleId = ? AND DATE(vo.date) = ?
                        `, [vehicleId, reportDate]);
        // Current inventory
        const [inventory] = yield db_1.pool.query(`
            SELECT COALESCE(SUM(vi.quantity * COALESCE(p.cost, 0)), 0) as currentInventoryValue
            FROM vehicle_inventory vi
            LEFT JOIN products p ON vi.productId = p.id
            WHERE vi.vehicleId = ?
                        `, [vehicleId]);
        const visitData = visits[0] || {};
        const successRate = visitData.totalVisits > 0
            ? ((visitData.successfulVisits / visitData.totalVisits) * 100).toFixed(1)
            : 0;
        // Combine returns from visits and old returns table
        const totalReturnsFromVisits = visitData.totalReturnsAmount || 0;
        const totalReturnsFromOldTable = ((_b = oldReturns[0]) === null || _b === void 0 ? void 0 : _b.totalReturns) || 0;
        const combinedReturns = totalReturnsFromVisits + totalReturnsFromOldTable;
        const combinedReturnsCount = (visitData.returnsCount || 0) + (((_c = oldReturns[0]) === null || _c === void 0 ? void 0 : _c.returnsCount) || 0);
        // Process Expenses
        const totalFuel = Number(((_d = fuelLogs[0]) === null || _d === void 0 ? void 0 : _d.totalFuel) || 0);
        const totalMaintenance = Number(((_e = maintenance[0]) === null || _e === void 0 ? void 0 : _e.totalMaintenance) || 0);
        const totalExpenses = totalFuel + totalMaintenance;
        let expenseDetails = [];
        // Helper to parse JSON array if needed
        const addExpenses = (details) => {
            if (!details)
                return;
            if (Array.isArray(details))
                expenseDetails = [...expenseDetails, ...details];
            else if (typeof details === 'string') {
                try {
                    const parsed = JSON.parse(details);
                    if (Array.isArray(parsed))
                        expenseDetails = [...expenseDetails, ...parsed];
                }
                catch (e) {
                    console.error('Error parsing expense details:', e);
                }
            }
        };
        addExpenses((_f = fuelLogs[0]) === null || _f === void 0 ? void 0 : _f.fuelDetails);
        addExpenses((_g = maintenance[0]) === null || _g === void 0 ? void 0 : _g.maintenanceDetails);
        // Check for existing SUBMITTED settlement to prepopulate manual data
        // Use date range to handle timezone issues (settlementDate is stored in UTC but represents local time)
        // A local date like '2026-01-31' needs to match UTC timestamps from '2026-01-30T22:00:00' to '2026-01-31T21:59:59' for UTC+2
        const [existingSubmitted] = yield db_1.pool.query(`
            SELECT *
            FROM vehicle_settlements 
            WHERE vehicleId = ? 
              AND settlementDate >= DATE(?) 
              AND settlementDate < DATE_ADD(DATE(?), INTERVAL 1 DAY)
              AND status = 'SUBMITTED'
            LIMIT 1
        `, [vehicleId, reportDate, reportDate]);
        let existingSettlementData = null;
        if (existingSubmitted.length > 0) {
            const submitted = existingSubmitted[0];
            // Fetch manual expenses (excluding auto-generated ones likely handled by Fuel/Maint logs)
            // We want to populate the "wizardExpenses" in frontend with these
            const [savedExpenses] = yield db_1.pool.query(`
                SELECT category, amount, description, receiptNumber 
                FROM settlement_expenses 
                WHERE settlementId = ?
            `, [submitted.id]);
            // Return ALL saved expenses so they can be edited/deleted in the wizard
            const manualExpenses = savedExpenses;
            // Calculate total expenses from all saved items (including FUEL/MAINTENANCE)
            const savedTotalExpenses = savedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
            existingSettlementData = {
                id: submitted.id,
                actualCash: submitted.actualCash,
                notes: submitted.notes,
                manualExpenses,
                calculatedTotalExpenses: savedTotalExpenses
            };
        }
        const report = {
            vehicleId,
            vehicleName: vehicle[0].plateNumber,
            salesmanId: vehicle[0].salesmanId,
            salesmanName: vehicle[0].salesmanName,
            reportDate,
            // Visits
            totalVisits: visitData.totalVisits || 0,
            successfulVisits: visitData.successfulVisits || 0,
            unsuccessfulVisits: visitData.unsuccessfulVisits || 0,
            visitSuccessRate: Number(successRate),
            // Sales (ONLY from SALE visits)
            totalSalesAmount: visitData.totalSalesAmount || 0,
            cashSales: (visitData === null || visitData === void 0 ? void 0 : visitData.cashSales) || 0,
            bankSales: (visitData === null || visitData === void 0 ? void 0 : visitData.bankSales) || 0, // NEW field
            creditSales: (visitData.totalSalesAmount || 0) - (visitData.cashSales || 0) - (visitData.bankSales || 0), // Exclude Bank from Credit
            salesCount: visitData.salesCount || 0,
            // Financials
            // ✅ FIX: Use MAX of invoice discounts and visit-based discounts (fallback)
            totalDiscounts: Math.max(Number(((_h = discounts[0]) === null || _h === void 0 ? void 0 : _h.totalDiscounts) || 0), Number((visitData === null || visitData === void 0 ? void 0 : visitData.discountsFromVisits) || 0)),
            totalExpenses,
            expenseDetails,
            // Collections (includes debt collection + treasury receipts)
            totalCollections: (visitData.cashSales || 0) + (visitData.bankSales || 0) + (visitData.baseDebtCollected || 0) + (visitData.extraFromCashSales || 0) + (visitData.collectedFromCreditSales || 0) + treasuryReceiptsTotal,
            totalDebtCollected: (visitData.baseDebtCollected || 0) + (visitData.extraFromCashSales || 0) + (visitData.collectedFromCreditSales || 0) + treasuryReceiptsTotal,
            collectionsCount: visitData.salesCount || 0,
            // Returns (from RETURN visits + old returns table)
            totalReturns: combinedReturns,
            returnsCount: combinedReturnsCount,
            // Inventory Movement
            loadedItems: ((_j = operations[0]) === null || _j === void 0 ? void 0 : _j.loadedItems) || 0,
            loadedValue: ((_k = operations[0]) === null || _k === void 0 ? void 0 : _k.loadedValue) || 0,
            unloadedItems: ((_l = operations[0]) === null || _l === void 0 ? void 0 : _l.unloadedItems) || 0,
            unloadedValue: ((_m = operations[0]) === null || _m === void 0 ? void 0 : _m.unloadedValue) || 0,
            currentInventoryValue: ((_o = inventory[0]) === null || _o === void 0 ? void 0 : _o.currentInventoryValue) || 0,
            // Performance
            avgVisitDuration: visitData.avgVisitDuration || 0,
            // Settlement status - indicates if there are approved settlements for this day
            hasApprovedSettlements,
            lastApprovalTime: cutoffTime,
            existingSettlement: existingSettlementData
        };
        if (existingSettlementData) {
            // Override calculated totals with stored values from the submitted settlement
            // IMPORTANT: When visits are made BEFORE the "last approved" settlement's approval time,
            // they are filtered OUT by the cutoff logic (visitDate > approvalTime).
            // In this case, the SUBMITTED settlement already has the correct values stored from when
            // those visits WERE visible. We MUST use the stored values, not the (incorrect) live zeros.
            const submitted = existingSubmitted[0];
            // Override with stored values from the SUBMITTED settlement
            report.totalSalesAmount = Number(submitted.totalSales || 0);
            report.cashSales = Number(submitted.totalCashSales || 0);
            report.bankSales = Number(submitted.totalBankTransfers || 0);
            report.creditSales = Number(submitted.totalCreditSales || 0);
            report.totalReturns = Number(submitted.totalReturns || 0);
            report.totalDiscounts = Number(submitted.totalDiscounts || 0);
            report.totalCollections = Number(submitted.cashCollected || 0);
            report.successfulVisits = Number(submitted.successfulVisits || 0);
            report.totalVisits = Number(submitted.totalVisits || 0);
            report.visitSuccessRate = report.totalVisits > 0 ? (report.successfulVisits / report.totalVisits) * 100 : 0;
            // CRITICAL FIX: totalDebtCollected is often stored as 0 incorrectly.
            // Calculate it from stored values: Debt = Total Collections - Cash Sales - Bank Sales
            // This represents money collected beyond what was owed for cash/bank sales (i.e., debt payments)
            const calculatedDebtCollected = Math.max(0, report.totalCollections - report.cashSales - report.bankSales);
            report.totalDebtCollected = calculatedDebtCollected;
            // Use the calculated total from the saved expenses (Manual + Auto)
            report.totalExpenses = existingSettlementData.calculatedTotalExpenses;
        }
        res.json(report);
    }
    catch (error) {
        console.error('Error generating daily report:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'generate daily report');
    }
});
exports.getDailyReport = getDailyReport;
// ==========================================
// CUSTOMER VEHICLE HISTORY (سجل عمليات السيارة للعميل)
// ==========================================
/**
 * Get all vehicle operations for a specific customer
 * Includes: visits, returns, and sales invoices from van sales
 */
const getCustomerVehicleHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { customerId } = req.params;
    const { startDate, endDate } = req.query;
    if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required' });
    }
    try {
        const params = [customerId];
        let dateFilter = '';
        if (startDate) {
            dateFilter += ' AND DATE(visitDate) >= ?';
            params.push(startDate);
        }
        if (endDate) {
            dateFilter += ' AND DATE(visitDate) <= ?';
            params.push(endDate);
        }
        // Get all visits for this customer
        const [visits] = yield db_1.pool.query(`
            SELECT
                    cv.id,
                        'VISIT' as recordType,
                        cv.visitDate as date,
                        cv.result,
                        cv.visitType,
                        cv.invoiceAmount,
                        cv.paymentCollected,
                        cv.notes,
                        cv.address,
                        v.plateNumber as vehicleName,
                        s.name as salesmanName
            FROM vehicle_customer_visits cv
            LEFT JOIN vehicles v ON cv.vehicleId = v.id
            LEFT JOIN salesmen s ON cv.salesmanId = s.id
            WHERE cv.customerId = ? ${dateFilter}
            ORDER BY cv.visitDate DESC
                        `, params);
        // Get all returns for this customer
        const returnParams = [customerId];
        let returnDateFilter = '';
        if (startDate) {
            returnDateFilter += ' AND DATE(returnDate) >= ?';
            returnParams.push(startDate);
        }
        if (endDate) {
            returnDateFilter += ' AND DATE(returnDate) <= ?';
            returnParams.push(endDate);
        }
        const [returns] = yield db_1.pool.query(`
                    SELECT
                    vr.id,
                        'RETURN' as recordType,
                        vr.returnDate as date,
                        'RETURN' as result,
                        vr.reason as visitType,
                        COALESCE(SUM(vri.quantity * vri.price), 0) as invoiceAmount,
                        0 as paymentCollected,
                        vr.notes,
                        '' as address,
                        v.plateNumber as vehicleName,
                        s.name as salesmanName
            FROM vehicle_returns vr
            LEFT JOIN vehicle_return_items vri ON vr.id = vri.returnId
            LEFT JOIN vehicles v ON vr.vehicleId = v.id
            LEFT JOIN salesmen s ON vr.salesmanId = s.id
            WHERE vr.customerId = ? ${returnDateFilter}
            GROUP BY vr.id
            ORDER BY vr.returnDate DESC
                        `, returnParams);
        // Get summary statistics
        const [summary] = yield db_1.pool.query(`
                    SELECT
                    COUNT(*) as totalVisits,
                        SUM(CASE WHEN result = 'SALE' THEN 1 ELSE 0 END) as salesCount,
                        SUM(CASE WHEN result = 'NO_SALE' THEN 1 ELSE 0 END) as noSaleCount,
                        SUM(CASE WHEN result = 'RETURN' THEN 1 ELSE 0 END) as returnsCount,
                        COALESCE(SUM(invoiceAmount), 0) as totalSalesAmount,
                        COALESCE(SUM(paymentCollected), 0) as totalCollections
            FROM vehicle_customer_visits
            WHERE customerId = ?
                        `, [customerId]);
        res.json({
            visits,
            returns,
            summary: summary[0] || {
                totalVisits: 0,
                salesCount: 0,
                noSaleCount: 0,
                returnsCount: 0,
                totalSalesAmount: 0,
                totalCollections: 0
            }
        });
    }
    catch (error) {
        console.error('Error fetching customer vehicle history:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch customer vehicle hi');
    }
});
exports.getCustomerVehicleHistory = getCustomerVehicleHistory;
// ==========================================
// VEHICLE TARGETS (أهداف السيارات)
// ==========================================
const getVehicleTargets = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, isActive, periodType } = req.query;
    const userSalesmanFilter = getUserSalesmanFilter(req);
    try {
        let query = `
            SELECT vt.*,
                        v.plateNumber as vehiclePlateNumber,
                        v.name as vehicleName,
                        s.name as salesmanName,
                        ROUND((vt.achievedValue / vt.targetValue) * 100, 1) as progressPercent
            FROM vehicle_targets vt
            LEFT JOIN vehicles v ON vt.vehicleId = v.id
            LEFT JOIN salesmen s ON vt.salesmanId = s.id
            WHERE 1 = 1
                        `;
        const params = [];
        if (userSalesmanFilter) {
            query += ` AND vt.salesmanId = ? `;
            params.push(userSalesmanFilter);
        }
        if (vehicleId) {
            query += ` AND vt.vehicleId = ? `;
            params.push(vehicleId);
        }
        if (isActive !== undefined) {
            query += ` AND vt.isActive = ? `;
            params.push(isActive === 'true' || isActive === '1');
        }
        if (periodType) {
            query += ` AND vt.periodType = ? `;
            params.push(periodType);
        }
        query += ` ORDER BY vt.periodEnd DESC, vt.createdAt DESC LIMIT 200`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching vehicle targets:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch targets');
    }
});
exports.getVehicleTargets = getVehicleTargets;
const createVehicleTarget = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, salesmanId, targetType, periodType, targetValue, periodStart, periodEnd, notes } = req.body;
    const user = req.user;
    if (!vehicleId || !targetValue || !periodStart || !periodEnd) {
        return res.status(400).json({ error: 'Vehicle, target value, and period dates are required' });
    }
    try {
        const id = (0, uuid_1.v4)();
        yield db_1.pool.query(`
            INSERT INTO vehicle_targets(
                            id, vehicleId, salesmanId, targetType, periodType,
                            targetValue, periodStart, periodEnd, achievedValue, isActive, notes, createdBy
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, 0, TRUE, ?, ?)
        `, [
            id, vehicleId, salesmanId,
            targetType || 'SALES_AMOUNT',
            periodType || 'DAILY',
            targetValue, periodStart, periodEnd,
            notes, (user === null || user === void 0 ? void 0 : user.name) || 'System'
        ]);
        res.status(201).json({ id, message: 'Target created successfully' });
    }
    catch (error) {
        console.error('Error creating vehicle target:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create target');
    }
});
exports.createVehicleTarget = createVehicleTarget;
const updateVehicleTarget = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { targetValue, achievedValue, isActive, notes } = req.body;
    try {
        const updates = [];
        const params = [];
        if (targetValue !== undefined) {
            updates.push('targetValue = ?');
            params.push(targetValue);
        }
        if (achievedValue !== undefined) {
            updates.push('achievedValue = ?');
            params.push(achievedValue);
        }
        if (isActive !== undefined) {
            updates.push('isActive = ?');
            params.push(isActive);
        }
        if (notes !== undefined) {
            updates.push('notes = ?');
            params.push(notes);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }
        params.push(id);
        yield db_1.pool.query(`UPDATE vehicle_targets SET ${updates.join(', ')} WHERE id = ? `, params);
        res.json({ message: 'Target updated successfully' });
    }
    catch (error) {
        console.error('Error updating vehicle target:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update target');
    }
});
exports.updateVehicleTarget = updateVehicleTarget;
const deleteVehicleTarget = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM vehicle_targets WHERE id = ?', [id]);
        res.json({ message: 'Target deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting vehicle target:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete target');
    }
});
exports.deleteVehicleTarget = deleteVehicleTarget;
// ==========================================
// VEHICLE MAINTENANCE (صيانة السيارات)
// ==========================================
const getVehicleMaintenance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, status, startDate, endDate } = req.query;
    try {
        let query = `
            SELECT vm.*,
                        v.plateNumber as vehiclePlateNumber,
                        v.name as vehicleName
            FROM vehicle_maintenance vm
            LEFT JOIN vehicles v ON vm.vehicleId = v.id
            WHERE 1 = 1
                        `;
        const params = [];
        if (vehicleId) {
            query += ` AND vm.vehicleId = ? `;
            params.push(vehicleId);
        }
        if (status) {
            query += ` AND vm.status = ? `;
            params.push(status);
        }
        if (startDate) {
            query += ` AND(vm.scheduledDate >= ? OR vm.completedDate >= ?)`;
            params.push(startDate, startDate);
        }
        if (endDate) {
            query += ` AND(vm.scheduledDate <= ? OR vm.completedDate <= ?)`;
            params.push(endDate, endDate);
        }
        query += ` ORDER BY COALESCE(vm.scheduledDate, vm.completedDate) DESC LIMIT 200`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching vehicle maintenance:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch maintenance records');
    }
});
exports.getVehicleMaintenance = getVehicleMaintenance;
const createVehicleMaintenance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, maintenanceType, description, scheduledDate, completedDate, cost, mileage, nextMaintenanceDate, nextMaintenanceMileage, status, notes } = req.body;
    const user = req.user;
    if (!vehicleId) {
        return res.status(400).json({ error: 'Vehicle ID is required' });
    }
    try {
        const id = (0, uuid_1.v4)();
        yield db_1.pool.query(`
            INSERT INTO vehicle_maintenance(
                            id, vehicleId, maintenanceType, description, scheduledDate, completedDate,
                            cost, mileage, nextMaintenanceDate, nextMaintenanceMileage, status, notes, createdBy
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
            id, vehicleId,
            maintenanceType || 'SCHEDULED',
            description,
            scheduledDate || null,
            completedDate || null,
            cost || 0,
            mileage || null,
            nextMaintenanceDate || null,
            nextMaintenanceMileage || null,
            status || 'SCHEDULED',
            notes,
            (user === null || user === void 0 ? void 0 : user.name) || 'System'
        ]);
        // Update vehicle mileage if provided
        if (mileage) {
            yield db_1.pool.query('UPDATE vehicles SET currentMileage = ? WHERE id = ? AND (currentMileage IS NULL OR currentMileage < ?)', [mileage, vehicleId, mileage]);
        }
        res.status(201).json({ id, message: 'Maintenance record created successfully' });
    }
    catch (error) {
        console.error('Error creating maintenance record:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create maintenance record');
    }
});
exports.createVehicleMaintenance = createVehicleMaintenance;
const updateVehicleMaintenance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { maintenanceType, description, scheduledDate, completedDate, cost, mileage, nextMaintenanceDate, nextMaintenanceMileage, status, notes } = req.body;
    try {
        yield db_1.pool.query(`
            UPDATE vehicle_maintenance SET
                    maintenanceType = COALESCE(?, maintenanceType),
                        description = ?,
                        scheduledDate = ?,
                        completedDate = ?,
                        cost = COALESCE(?, cost),
                        mileage = ?,
                        nextMaintenanceDate = ?,
                        nextMaintenanceMileage = ?,
                        status = COALESCE(?, status),
                        notes = ?
                            WHERE id = ?
                                `, [
            maintenanceType, description, scheduledDate, completedDate,
            cost, mileage, nextMaintenanceDate, nextMaintenanceMileage,
            status, notes, id
        ]);
        res.json({ message: 'Maintenance record updated successfully' });
    }
    catch (error) {
        console.error('Error updating maintenance record:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update maintenance record');
    }
});
exports.updateVehicleMaintenance = updateVehicleMaintenance;
const deleteVehicleMaintenance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM vehicle_maintenance WHERE id = ?', [id]);
        res.json({ message: 'Maintenance record deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting maintenance record:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete maintenance record');
    }
});
exports.deleteVehicleMaintenance = deleteVehicleMaintenance;
// ==========================================
// VEHICLE FUEL LOGS (سجل الوقود)
// ==========================================
const getVehicleFuelLogs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, startDate, endDate } = req.query;
    try {
        let query = `
            SELECT vf.*,
                        v.plateNumber as vehiclePlateNumber,
                        v.name as vehicleName
            FROM vehicle_fuel_logs vf
            LEFT JOIN vehicles v ON vf.vehicleId = v.id
            WHERE 1 = 1
                        `;
        const params = [];
        if (vehicleId) {
            query += ` AND vf.vehicleId = ? `;
            params.push(vehicleId);
        }
        if (startDate) {
            query += ` AND vf.fuelDate >= ? `;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND vf.fuelDate <= ? `;
            params.push(endDate);
        }
        query += ` ORDER BY vf.fuelDate DESC, vf.createdAt DESC LIMIT 200`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching fuel logs:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch fuel logs');
    }
});
exports.getVehicleFuelLogs = getVehicleFuelLogs;
const createVehicleFuelLog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, fuelDate, fuelType, liters, pricePerLiter, totalCost, mileage, fullTank, notes } = req.body;
    const user = req.user;
    if (!vehicleId || !liters) {
        return res.status(400).json({ error: 'Vehicle ID and liters are required' });
    }
    try {
        const id = (0, uuid_1.v4)();
        // Calculate km per liter if we have previous full tank record
        let kmPerLiter = null;
        if (fullTank && mileage) {
            const [prevLogs] = yield db_1.pool.query(`
                SELECT mileage, fuelDate FROM vehicle_fuel_logs 
                WHERE vehicleId = ? AND fullTank = TRUE AND mileage IS NOT NULL 
                ORDER BY fuelDate DESC LIMIT 1
                        `, [vehicleId]);
            if (prevLogs.length > 0 && prevLogs[0].mileage < mileage) {
                const kmDriven = mileage - prevLogs[0].mileage;
                kmPerLiter = (kmDriven / liters).toFixed(2);
            }
        }
        yield db_1.pool.query(`
            INSERT INTO vehicle_fuel_logs(
                            id, vehicleId, fuelDate, fuelType, liters, pricePerLiter,
                            totalCost, mileage, kmPerLiter, fullTank, notes, createdBy
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
            id, vehicleId,
            fuelDate || new Date().toISOString().slice(0, 10),
            fuelType || 'بنزين 92',
            liters,
            pricePerLiter || null,
            totalCost || (liters * (pricePerLiter || 0)),
            mileage || null,
            kmPerLiter,
            fullTank || false,
            notes,
            (user === null || user === void 0 ? void 0 : user.name) || 'System'
        ]);
        // Update vehicle mileage if provided
        if (mileage) {
            yield db_1.pool.query('UPDATE vehicles SET currentMileage = ? WHERE id = ? AND (currentMileage IS NULL OR currentMileage < ?)', [mileage, vehicleId, mileage]);
        }
        res.status(201).json({ id, kmPerLiter, message: 'Fuel log created successfully' });
    }
    catch (error) {
        console.error('Error creating fuel log:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create fuel log');
    }
});
exports.createVehicleFuelLog = createVehicleFuelLog;
const deleteVehicleFuelLog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM vehicle_fuel_logs WHERE id = ?', [id]);
        res.json({ message: 'Fuel log deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting fuel log:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete fuel log');
    }
});
exports.deleteVehicleFuelLog = deleteVehicleFuelLog;
// ==========================================
// VEHICLE LOW STOCK ALERTS (تنبيهات نقص المخزون)
// ==========================================
const getVehicleLowStockAlerts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { minQtyThreshold = 5 } = req.query;
    try {
        const [alerts] = yield db_1.pool.query(`
                    SELECT
                    vi.vehicleId,
                        v.plateNumber as vehicleName,
                        v.plateNumber,
                        v.name,
                        vi.productId,
                        p.name as productName,
                        p.sku as productSku,
                        vi.quantity as currentQty,
                        COALESCE(p.minStock, ?) as minQty,
                        GREATEST(COALESCE(p.minStock, ?) * 2 - vi.quantity, 0) as suggestedReorderQty
            FROM vehicle_inventory vi
            JOIN vehicles v ON vi.vehicleId = v.id
            JOIN products p ON vi.productId = p.id
            WHERE vi.quantity <= COALESCE(p.minStock, ?)
            ORDER BY vi.quantity ASC, v.plateNumber
                        `, [minQtyThreshold, minQtyThreshold, minQtyThreshold]);
        res.json(alerts);
    }
    catch (error) {
        console.error('Error fetching low stock alerts:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch alerts');
    }
});
exports.getVehicleLowStockAlerts = getVehicleLowStockAlerts;
// ==========================================
// VEHICLE PERFORMANCE REPORTS (تقارير أداء السيارات)
// ==========================================
const getVehiclePerformanceReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { startDate, endDate, vehicleId } = req.query;
    // Default to last 30 days if no dates provided
    const end = endDate || new Date().toISOString().slice(0, 10);
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
        let query = `
                    SELECT
                    v.id as vehicleId,
                        v.plateNumber as vehicleName,
                        v.plateNumber,
                        s.name as salesmanName,
                        
                        COALESCE(SUM(CASE WHEN cv.result = 'SALE' THEN cv.invoiceAmount ELSE 0 END), 0) as totalSales,
                        COUNT(CASE WHEN cv.result = 'SALE' THEN 1 END) as salesCount,
                        COALESCE(AVG(CASE WHEN cv.result = 'SALE' THEN cv.invoiceAmount END), 0) as avgSaleValue,

                        COUNT(cv.id) as totalVisits,
                        COUNT(CASE WHEN cv.result = 'SALE' THEN 1 END) as successfulVisits,
                        ROUND(COUNT(CASE WHEN cv.result = 'SALE' THEN 1 END) * 100.0 / NULLIF(COUNT(cv.id), 0), 1) as visitSuccessRate,

                        COALESCE(SUM(cv.paymentCollected), 0) as totalCollections,
                        ROUND(COALESCE(SUM(cv.paymentCollected), 0) * 100.0 /
                            NULLIF(COALESCE(SUM(CASE WHEN cv.result = 'SALE' THEN cv.invoiceAmount ELSE 0 END), 0), 0), 1) as collectionRate
                
            FROM vehicles v
            LEFT JOIN salesmen s ON v.salesmanId = s.id
            LEFT JOIN vehicle_customer_visits cv ON v.id = cv.vehicleId 
                AND DATE(cv.visitDate) BETWEEN ? AND ?
                        WHERE 1 = 1
                            `;
        const params = [start, end];
        if (vehicleId) {
            query += ` AND v.id = ? `;
            params.push(vehicleId);
        }
        query += ` GROUP BY v.id, v.plateNumber, v.name, s.name ORDER BY totalSales DESC`;
        const [rows] = yield db_1.pool.query(query, params);
        // Add period info to each row
        const result = rows.map(row => (Object.assign(Object.assign({}, row), { periodStart: start, periodEnd: end })));
        res.json(result);
    }
    catch (error) {
        console.error('Error generating performance report:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'generate report');
    }
});
exports.getVehiclePerformanceReport = getVehiclePerformanceReport;
const getProductPerformanceReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { startDate, endDate, vehicleId, limit = 20 } = req.query;
    const end = endDate || new Date().toISOString().slice(0, 10);
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
        let query = `
                    SELECT
                    il.productId,
                        il.productName,
                        p.sku as productSku,
                        SUM(il.quantity) as totalQtySold,
                        SUM(il.total) as totalRevenue,
                        AVG(il.price) as avgPrice,
                        COUNT(DISTINCT cv.vehicleId) as vehicleCount
            FROM invoice_lines il
            JOIN invoices i ON il.invoiceId = i.id
            JOIN vehicle_customer_visits cv ON i.id = cv.invoiceId
            LEFT JOIN products p ON il.productId = p.id
            WHERE i.type = 'INVOICE_SALE'
                AND DATE(cv.visitDate) BETWEEN ? AND ?
                        `;
        const params = [start, end];
        if (vehicleId) {
            query += ` AND cv.vehicleId = ? `;
            params.push(vehicleId);
        }
        query += ` GROUP BY il.productId, il.productName, p.sku
                   ORDER BY totalRevenue DESC
                    LIMIT ? `;
        params.push(Number(limit));
        const [rows] = yield db_1.pool.query(query, params);
        // Add rank
        const result = rows.map((row, index) => (Object.assign(Object.assign({}, row), { rank: index + 1 })));
        res.json(result);
    }
    catch (error) {
        console.error('Error generating product performance report:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'generate report');
    }
});
exports.getProductPerformanceReport = getProductPerformanceReport;
// ==========================================
// UPDATE VEHICLE LOCATION (تحديث موقع السيارة - GPS)
// ==========================================
const updateVehicleLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { latitude, longitude, mileage } = req.body;
    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    try {
        let query = 'UPDATE vehicles SET latitude = ?, longitude = ?, lastLocationUpdate = NOW()';
        const params = [latitude, longitude];
        if (mileage) {
            query += ', currentMileage = ?';
            params.push(mileage);
        }
        query += ' WHERE id = ?';
        params.push(id);
        yield db_1.pool.query(query, params);
        res.json({ message: 'Location updated successfully' });
    }
    catch (error) {
        console.error('Error updating vehicle location:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update location');
    }
});
exports.updateVehicleLocation = updateVehicleLocation;
// ==========================================
// ROUTES MANAGEMENT (خطوط السير)
// ==========================================
/**
 * Get routes for logged-in salesman's vehicles (for mobile sync)
 * Returns routes WITH stops array for offline storage
 */
const getSalesmanRoutes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { limit = 50 } = req.query;
    console.log(`📋 getSalesmanRoutes called for user: `, {
        id: user === null || user === void 0 ? void 0 : user.id,
        name: user === null || user === void 0 ? void 0 : user.name,
        salesmanId: user === null || user === void 0 ? void 0 : user.salesmanId,
        email: user === null || user === void 0 ? void 0 : user.email
    });
    try {
        // Find vehicles assigned to this user
        // Check: 1) direct salesmanId match, 2) salesman's userId, 3) user's linked salesmanId
        const [vehicles] = yield db_1.pool.query(`
            SELECT DISTINCT v.id, v.plateNumber
            FROM vehicles v
            LEFT JOIN salesmen s ON v.salesmanId = s.id
            WHERE v.salesmanId = ?
                        OR s.userId = ?
                            OR v.salesmanId IN(SELECT id FROM salesmen WHERE userId = ?)
               OR v.salesmanId = ?
                        `, [user === null || user === void 0 ? void 0 : user.id, user === null || user === void 0 ? void 0 : user.id, user === null || user === void 0 ? void 0 : user.id, user === null || user === void 0 ? void 0 : user.salesmanId]);
        console.log(`📋 Vehicles found for user ${user === null || user === void 0 ? void 0 : user.id}: `, vehicles.map((v) => `${v.id} (${v.plateNumber})`));
        if (vehicles.length === 0) {
            console.log(`📋 No vehicles found for user ${user === null || user === void 0 ? void 0 : user.id}(salesmanId: ${user === null || user === void 0 ? void 0 : user.salesmanId})`);
            return res.json([]);
        }
        const vehicleIds = vehicles.map((v) => v.id);
        console.log(`📋 Found ${vehicleIds.length} vehicles for user ${user === null || user === void 0 ? void 0 : user.id}: ${vehicleIds.join(', ')} `);
        // Get ALL routes for these vehicles (no date filter for mobile sync)
        const [routes] = yield db_1.pool.query(`
            SELECT r.*,
                        v.plateNumber,
                        v.name as vehicleName
            FROM vehicle_routes r
            LEFT JOIN vehicles v ON r.vehicleId = v.id
            WHERE r.vehicleId IN(${vehicleIds.map(() => '?').join(',')})
            ORDER BY r.routeDate DESC, r.createdAt DESC
                    LIMIT ?
                        `, [...vehicleIds, Number(limit)]);
        // Load stops for each route
        for (const route of routes) {
            const [stops] = yield db_1.pool.query(`
                SELECT s.*,
                        p.name as partnerName,
                        p.phone as phone,
                        p.address as partnerAddress
                FROM vehicle_route_stops s
                LEFT JOIN partners p ON s.customerId = p.id
                WHERE s.routeId = ?
                        ORDER BY s.stopOrder
            `, [route.id]);
            route.stops = stops.map(s => ({
                id: s.id,
                customerId: s.customerId,
                customerName: s.customerName || s.partnerName,
                address: s.address || s.partnerAddress,
                phone: s.phone,
                sequence: s.stopOrder,
                status: s.status || 'PENDING',
                visitId: s.visitId,
                invoiceId: s.invoiceId,
                saleAmount: s.amountCollected
            }));
        }
        console.log(`📋 Returning ${routes.length} routes with stops for user ${user === null || user === void 0 ? void 0 : user.id}`);
        res.json(routes);
    }
    catch (error) {
        console.error('Error fetching salesman routes:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch salesman routes');
    }
});
exports.getSalesmanRoutes = getSalesmanRoutes;
const getRoutes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, startDate, endDate, status } = req.query;
    try {
        let query = `
            SELECT r.*,
                        v.plateNumber,
                        s.name as salesmanName,
                        (SELECT COUNT(*) FROM vehicle_route_stops WHERE routeId = r.id) as stopCount,
                            (SELECT COUNT(*) FROM vehicle_route_stops WHERE routeId = r.id AND status = 'VISITED') as completedStops
            FROM vehicle_routes r
            LEFT JOIN vehicles v ON r.vehicleId = v.id
            LEFT JOIN salesmen s ON v.salesmanId = s.id
            WHERE 1 = 1
                        `;
        const params = [];
        if (vehicleId) {
            query += ` AND r.vehicleId = ? `;
            params.push(vehicleId);
        }
        if (status) {
            query += ` AND r.status = ? `;
            params.push(status);
        }
        if (startDate) {
            query += ` AND r.routeDate >= ? `;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND r.routeDate <= ? `;
            params.push(endDate);
        }
        query += ` ORDER BY r.routeDate DESC, r.createdAt DESC LIMIT 100`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching routes:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch routes');
    }
});
exports.getRoutes = getRoutes;
const getRoute = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        // Get route
        const [routes] = yield db_1.pool.query(`
            SELECT r.*,
                        v.plateNumber,
                        s.name as salesmanName
            FROM vehicle_routes r
            LEFT JOIN vehicles v ON r.vehicleId = v.id
            LEFT JOIN salesmen s ON v.salesmanId = s.id
            WHERE r.id = ?
                        `, [id]);
        if (routes.length === 0) {
            return res.status(404).json({ error: 'Route not found' });
        }
        // Get stops
        const [stops] = yield db_1.pool.query(`
            SELECT s.*, p.name as partnerName
            FROM vehicle_route_stops s
            LEFT JOIN partners p ON s.customerId = p.id
            WHERE s.routeId = ?
                        ORDER BY s.stopOrder
                            `, [id]);
        res.json(Object.assign(Object.assign({}, routes[0]), { stops }));
    }
    catch (error) {
        console.error('Error fetching route:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch route');
    }
});
exports.getRoute = getRoute;
const createRoute = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { vehicleId, routeName, routeDate, stops, notes } = req.body;
    const user = req.user;
    if (!vehicleId) {
        return res.status(400).json({ error: 'Vehicle ID is required' });
    }
    if (!routeName) {
        return res.status(400).json({ error: 'Route name is required' });
    }
    if (!routeDate) {
        return res.status(400).json({ error: 'Route date is required' });
    }
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        const routeId = (0, uuid_1.v4)();
        yield conn.query(`
            INSERT INTO vehicle_routes(id, vehicleId, routeName, routeDate, status, notes, createdBy)
                    VALUES(?, ?, ?, ?, 'PLANNED', ?, ?)
                        `, [routeId, vehicleId, routeName, routeDate, notes, (user === null || user === void 0 ? void 0 : user.name) || 'System']);
        // Create stops if provided
        if (stops && Array.isArray(stops)) {
            for (let i = 0; i < stops.length; i++) {
                const stop = stops[i];
                const stopId = (0, uuid_1.v4)();
                yield conn.query(`
                    INSERT INTO vehicle_route_stops(id, routeId, stopOrder, customerId, customerName, address, plannedArrival, notes)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                        `, [stopId, routeId, i + 1, stop.customerId, stop.customerName, stop.address, stop.plannedArrival, stop.notes]);
            }
        }
        yield conn.commit();
        res.status(201).json({ id: routeId, message: 'Route created successfully' });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error creating route:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create route');
    }
    finally {
        conn.release();
    }
});
exports.createRoute = createRoute;
const updateRoute = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { vehicleId, routeName, routeDate, status, plannedDistance, actualDistance, startTime, endTime, notes, stops } = req.body;
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        // Update the route basic info
        yield conn.query(`
            UPDATE vehicle_routes SET
                    vehicleId = COALESCE(?, vehicleId),
                        routeName = COALESCE(?, routeName),
                        routeDate = COALESCE(?, routeDate),
                        status = COALESCE(?, status),
                        plannedDistance = COALESCE(?, plannedDistance),
                        actualDistance = COALESCE(?, actualDistance),
                        startTime = COALESCE(?, startTime),
                        endTime = COALESCE(?, endTime),
                        notes = ?
                            WHERE id = ?
                                `, [vehicleId, routeName, routeDate, status, plannedDistance, actualDistance, startTime, endTime, notes, id]);
        // If stops are provided, update them (delete old and insert new)
        if (stops && Array.isArray(stops)) {
            // Delete existing stops for this route
            yield conn.query('DELETE FROM vehicle_route_stops WHERE routeId = ?', [id]);
            // Insert new stops
            for (let i = 0; i < stops.length; i++) {
                const stop = stops[i];
                const stopId = (0, uuid_1.v4)();
                yield conn.query(`
                    INSERT INTO vehicle_route_stops(id, routeId, customerId, customerName, address, stopOrder, status)
                    VALUES(?, ?, ?, ?, ?, ?, 'PENDING')
                        `, [stopId, id, stop.customerId, stop.customerName, stop.address || '', i + 1]);
            }
        }
        yield conn.commit();
        res.json({ message: 'Route updated successfully' });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error updating route:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update route');
    }
    finally {
        conn.release();
    }
});
exports.updateRoute = updateRoute;
const deleteRoute = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM vehicle_routes WHERE id = ?', [id]);
        res.json({ message: 'Route deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting route:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete route');
    }
});
exports.deleteRoute = deleteRoute;
// Route Stops Management
const addRouteStop = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { routeId } = req.params;
    const { customerId, customerName, address, plannedArrival, notes, latitude, longitude } = req.body;
    try {
        // Get max stopOrder
        const [maxOrder] = yield db_1.pool.query('SELECT MAX(stopOrder) as maxOrder FROM vehicle_route_stops WHERE routeId = ?', [routeId]);
        const nextOrder = (((_a = maxOrder[0]) === null || _a === void 0 ? void 0 : _a.maxOrder) || 0) + 1;
        const stopId = (0, uuid_1.v4)();
        yield db_1.pool.query(`
            INSERT INTO vehicle_route_stops(id, routeId, stopOrder, customerId, customerName, address, plannedArrival, notes, latitude, longitude)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [stopId, routeId, nextOrder, customerId, customerName, address, plannedArrival, notes, latitude, longitude]);
        res.status(201).json({ id: stopId, message: 'Stop added successfully' });
    }
    catch (error) {
        console.error('Error adding route stop:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'add stop');
    }
});
exports.addRouteStop = addRouteStop;
const updateRouteStop = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { stopId } = req.params;
    const { stopOrder, actualArrival, status, visitId, notes, result } = req.body;
    try {
        // If marking as VISITED or SKIPPED, auto-set arrival time if not provided
        let arrival = actualArrival;
        if ((status === 'VISITED' || status === 'SKIPPED') && !actualArrival) {
            arrival = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }
        yield db_1.pool.query(`
            UPDATE vehicle_route_stops SET
                    stopOrder = COALESCE(?, stopOrder),
                        actualArrival = COALESCE(?, actualArrival),
                        status = COALESCE(?, status),
                        visitId = COALESCE(?, visitId),
                        notes = COALESCE(?, notes)
            WHERE id = ?
                        `, [stopOrder, arrival, status, visitId, notes, stopId]);
        res.json({ message: 'Stop updated successfully', actualArrival: arrival });
    }
    catch (error) {
        console.error('Error updating route stop:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update stop');
    }
});
exports.updateRouteStop = updateRouteStop;
// Mark a route stop as visited (quick action)
const markStopVisited = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { stopId } = req.params;
    const { result, notes, invoiceId, amountCollected } = req.body;
    try {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        yield db_1.pool.query(`
            UPDATE vehicle_route_stops SET
                    status = 'VISITED',
                        actualArrival = ?,
                        result = ?,
                        notes = COALESCE(?, notes),
                        invoiceId = ?,
                        amountCollected = ?
                            WHERE id = ?
                                `, [now, result || 'SALE', notes, invoiceId || null, amountCollected || 0, stopId]);
        res.json({ message: 'Stop marked as visited', actualArrival: now });
    }
    catch (error) {
        console.error('Error marking stop as visited:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'mark stop');
    }
});
exports.markStopVisited = markStopVisited;
const deleteRouteStop = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { stopId } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM vehicle_route_stops WHERE id = ?', [stopId]);
        res.json({ message: 'Stop deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting route stop:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete stop');
    }
});
exports.deleteRouteStop = deleteRouteStop;
// Start a route (change status to IN_PROGRESS)
const startRoute = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        yield db_1.pool.query(`
            UPDATE vehicle_routes SET
                    status = 'IN_PROGRESS',
                        startTime = ?
                            WHERE id = ? AND status = 'PLANNED'
                                `, [now, id]);
        res.json({ message: 'Route started successfully' });
    }
    catch (error) {
        console.error('Error starting route:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'start route');
    }
});
exports.startRoute = startRoute;
// Complete a route
const completeRoute = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { actualDistance } = req.body;
    try {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        let query = `UPDATE vehicle_routes SET status = 'COMPLETED', endTime = ? `;
        const params = [now];
        if (actualDistance) {
            query += ', actualDistance = ?';
            params.push(actualDistance);
        }
        query += ' WHERE id = ?';
        params.push(id);
        yield db_1.pool.query(query, params);
        res.json({ message: 'Route completed successfully' });
    }
    catch (error) {
        console.error('Error completing route:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'complete route');
    }
});
exports.completeRoute = completeRoute;
// DEBUG: Get full discount details for a date - accessible via browser
const debugDiscounts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { date } = req.query;
    const dateStr = date || new Date().toISOString().slice(0, 10);
    try {
        // Get ALL invoices for this date (not filtered by type)
        const [allInvoices] = yield db_1.pool.query(`
            SELECT id, type, globalDiscount, discount, total, status, partnerName, DATE(date) as invoiceDate
            FROM invoices 
            WHERE DATE(date) = ?
                        `, [dateStr]);
        // Get only sale invoices with the settlement filter
        const [saleInvoices] = yield db_1.pool.query(`
            SELECT id, type, globalDiscount, discount, total, status, partnerName
            FROM invoices 
            WHERE DATE(date) = ?
                        AND(type LIKE '%SALE%' AND type NOT LIKE '%RETURN%')
            AND status = 'POSTED'
                        `, [dateStr]);
        // Calculate total
        let totalDiscounts = 0;
        const saleDetails = saleInvoices.map((inv) => {
            const discountAmount = (Number(inv.globalDiscount) || 0) + (Number(inv.discount) || 0);
            totalDiscounts += discountAmount;
            return {
                id: inv.id,
                type: inv.type,
                globalDiscount: inv.globalDiscount,
                discount: inv.discount,
                calculatedDiscount: discountAmount,
                total: inv.total,
                partnerName: inv.partnerName,
                status: inv.status
            };
        });
        res.json({
            queryDate: dateStr,
            totalInvoicesOnDate: allInvoices.length,
            allInvoiceTypes: allInvoices.map((i) => ({ type: i.type, total: i.total, status: i.status })),
            saleInvoicesWithDiscounts: saleDetails,
            calculatedTotalDiscounts: totalDiscounts,
            message: `Found ${saleInvoices.length} sale invoices with ${totalDiscounts} total discounts`
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'debug discounts');
    }
});
exports.debugDiscounts = debugDiscounts;
