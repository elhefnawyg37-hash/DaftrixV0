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
exports.getNearExpiryBatches = exports.getBatchHistory = exports.backwardTrace = exports.forwardTrace = exports.recordGenealogy = exports.updateBatch = exports.createBatch = exports.getBatch = exports.getBatches = void 0;
const db_1 = require("../db");
const errorHandler_1 = require("../utils/errorHandler");
/**
 * Batch Tracking & Traceability Controller
 * Manages inventory batches and genealogy tracking
 */
// ========================================
// BATCH MANAGEMENT
// ========================================
// Get all batches
const getBatches = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productId, warehouseId, status, nearExpiry } = req.query;
        let query = `
            SELECT ib.*, 
                   p.name as product_name,
                   p.sku as product_sku,
                   w.name as warehouse_name,
                   po.order_number as production_order_number
            FROM inventory_batches ib
            LEFT JOIN products p ON ib.product_id = p.id
            LEFT JOIN warehouses w ON ib.warehouse_id = w.id
            LEFT JOIN production_orders po ON ib.production_order_id = po.id
            WHERE 1=1
        `;
        const params = [];
        if (productId) {
            query += ' AND ib.product_id = ?';
            params.push(productId);
        }
        if (warehouseId) {
            query += ' AND ib.warehouse_id = ?';
            params.push(warehouseId);
        }
        if (status) {
            query += ' AND ib.status = ?';
            params.push(status);
        }
        if (nearExpiry === 'true') {
            query += ' AND ib.expiry_date IS NOT NULL AND ib.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)';
        }
        query += ' ORDER BY ib.created_at DESC';
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching batches:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getBatches = getBatches;
// Get batch by ID with full details
const getBatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const [batchRows] = yield db_1.pool.query(`
            SELECT ib.*, 
                   p.name as product_name,
                   p.sku as product_sku,
                   w.name as warehouse_name,
                   po.order_number as production_order_number
            FROM inventory_batches ib
            LEFT JOIN products p ON ib.product_id = p.id
            LEFT JOIN warehouses w ON ib.warehouse_id = w.id
            LEFT JOIN production_orders po ON ib.production_order_id = po.id
            WHERE ib.id = ?
        `, [id]);
        if (batchRows.length === 0) {
            return res.status(404).json({ message: 'Batch not found' });
        }
        const batch = batchRows[0];
        // Get parent batches (what raw materials went into this)
        const [parents] = yield db_1.pool.query(`
            SELECT bg.*, 
                   ib.batch_number as parent_batch_number,
                   p.name as parent_product_name
            FROM batch_genealogy bg
            LEFT JOIN inventory_batches ib ON bg.parent_batch_id = ib.id
            LEFT JOIN products p ON ib.product_id = p.id
            WHERE bg.child_batch_id = ?
        `, [id]);
        batch.parent_batches = parents;
        // Get child batches (what finished goods used this batch)
        const [children] = yield db_1.pool.query(`
            SELECT bg.*, 
                   ib.batch_number as child_batch_number,
                   p.name as child_product_name
            FROM batch_genealogy bg
            LEFT JOIN inventory_batches ib ON bg.child_batch_id = ib.id
            LEFT JOIN products p ON ib.product_id = p.id
            WHERE bg.parent_batch_id = ?
        `, [id]);
        batch.child_batches = children;
        // Get quality checks for this batch
        const [qcChecks] = yield db_1.pool.query(`
            SELECT * FROM quality_checks
            WHERE batch_number = ?
            ORDER BY check_date DESC
        `, [batch.batch_number]);
        batch.quality_checks = qcChecks;
        // Get stock movements
        const [movements] = yield db_1.pool.query(`
            SELECT * FROM stock_movements
            WHERE batch_id = ?
            ORDER BY movement_date DESC
        `, [id]);
        batch.stock_movements = movements;
        res.json(batch);
    }
    catch (error) {
        console.error('Error fetching batch:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getBatch = getBatch;
// Create batch
const createBatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, batchNumber, productId, warehouseId, quantity, unitCost, manufactureDate, expiryDate, supplierBatch, supplierId, productionOrderId, status, notes } = req.body;
        // Check if batch number exists
        const [existing] = yield db_1.pool.query('SELECT id FROM inventory_batches WHERE batch_number = ?', [batchNumber]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Batch number already exists' });
        }
        yield db_1.pool.query(`
            INSERT INTO inventory_batches (
                id, batch_number, product_id, warehouse_id, quantity,
                available_quantity, unit_cost, manufacture_date, expiry_date,
                supplier_batch, supplier_id, production_order_id, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            batchNumber,
            productId,
            warehouseId || null,
            quantity,
            quantity, // Initially all available
            unitCost || null,
            manufactureDate || null,
            expiryDate || null,
            supplierBatch || null,
            supplierId || null,
            productionOrderId || null,
            status || 'ACTIVE',
            notes || null
        ]);
        const [result] = yield db_1.pool.query('SELECT * FROM inventory_batches WHERE id = ?', [id]);
        res.json(result[0]);
    }
    catch (error) {
        console.error('Error creating batch:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.createBatch = createBatch;
// Update batch
const updateBatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { quantity, availableQuantity, status, notes } = req.body;
        yield db_1.pool.query(`
            UPDATE inventory_batches
            SET quantity = COALESCE(?, quantity),
                available_quantity = COALESCE(?, available_quantity),
                status = COALESCE(?, status),
                notes = COALESCE(?, notes)
            WHERE id = ?
        `, [quantity, availableQuantity, status, notes, id]);
        const [result] = yield db_1.pool.query('SELECT * FROM inventory_batches WHERE id = ?', [id]);
        res.json(result[0]);
    }
    catch (error) {
        console.error('Error updating batch:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.updateBatch = updateBatch;
// ========================================
// GENEALOGY & TRACEABILITY
// ========================================
// Record batch genealogy (link parent to child)
const recordGenealogy = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, childBatchId, parentBatchId, productionOrderId, quantityConsumed } = req.body;
        yield db_1.pool.query(`
            INSERT INTO batch_genealogy (
                id, child_batch_id, parent_batch_id, 
                production_order_id, quantity_consumed
            ) VALUES (?, ?, ?, ?, ?)
        `, [id, childBatchId, parentBatchId, productionOrderId, quantityConsumed]);
        // Update parent batch available quantity
        yield db_1.pool.query(`
            UPDATE inventory_batches
            SET available_quantity = available_quantity - ?
            WHERE id = ?
        `, [quantityConsumed, parentBatchId]);
        res.json({ message: 'Genealogy recorded successfully' });
    }
    catch (error) {
        console.error('Error recording genealogy:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.recordGenealogy = recordGenealogy;
// Forward traceability (where did this batch go?)
const forwardTrace = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { batchId } = req.params;
        // Get all child batches recursively
        const [children] = yield db_1.pool.query(`
            WITH RECURSIVE batch_tree AS (
                -- Base case: direct children
                SELECT 
                    bg.child_batch_id as batch_id,
                    bg.parent_batch_id,
                    bg.production_order_id,
                    bg.quantity_consumed,
                    1 as level
                FROM batch_genealogy bg
                WHERE bg.parent_batch_id = ?
                
                UNION ALL
                
                -- Recursive case: children of children
                SELECT 
                    bg.child_batch_id,
                    bg.parent_batch_id,
                    bg.production_order_id,
                    bg.quantity_consumed,
                    bt.level + 1
                FROM batch_genealogy bg
                INNER JOIN batch_tree bt ON bg.parent_batch_id = bt.batch_id
                WHERE bt.level < 10 -- Prevent infinite recursion
            )
            SELECT 
                bt.*,
                ib.batch_number,
                ib.product_id,
                p.name as product_name,
                po.order_number,
                ib.status,
                ib.warehouse_id,
                w.name as warehouse_name
            FROM batch_tree bt
            LEFT JOIN inventory_batches ib ON bt.batch_id = ib.id
            LEFT JOIN products p ON ib.product_id = p.id
            LEFT JOIN production_orders po ON bt.production_order_id = po.id
            LEFT JOIN warehouses w ON ib.warehouse_id = w.id
            ORDER BY bt.level, ib.created_at
        `, [batchId]);
        res.json(children);
    }
    catch (error) {
        console.error('Error in forward trace:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.forwardTrace = forwardTrace;
// Backward traceability (where did this batch come from?)
const backwardTrace = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { batchId } = req.params;
        // Get all parent batches recursively
        const [parents] = yield db_1.pool.query(`
            WITH RECURSIVE batch_tree AS (
                -- Base case: direct parents
                SELECT 
                    bg.parent_batch_id as batch_id,
                    bg.child_batch_id,
                    bg.production_order_id,
                    bg.quantity_consumed,
                    1 as level
                FROM batch_genealogy bg
                WHERE bg.child_batch_id = ?
                
                UNION ALL
                
                -- Recursive case: parents of parents
                SELECT 
                    bg.parent_batch_id,
                    bg.child_batch_id,
                    bg.production_order_id,
                    bg.quantity_consumed,
                    bt.level + 1
                FROM batch_genealogy bg
                INNER JOIN batch_tree bt ON bg.child_batch_id = bt.batch_id
                WHERE bt.level < 10 -- Prevent infinite recursion
            )
            SELECT 
                bt.*,
                ib.batch_number,
                ib.product_id,
                p.name as product_name,
                po.order_number,
                ib.supplier_batch,
                ib.manufacture_date,
                ib.status
            FROM batch_tree bt
            LEFT JOIN inventory_batches ib ON bt.batch_id = ib.id
            LEFT JOIN products p ON ib.product_id = p.id
            LEFT JOIN production_orders po ON bt.production_order_id = po.id
            ORDER BY bt.level, ib.created_at
        `, [batchId]);
        res.json(parents);
    }
    catch (error) {
        console.error('Error in backward trace:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.backwardTrace = backwardTrace;
// Get complete batch history timeline
const getBatchHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { batchId } = req.params;
        // Get batch info
        const [batchRows] = yield db_1.pool.query('SELECT * FROM inventory_batches WHERE id = ?', [batchId]);
        if (batchRows.length === 0) {
            return res.status(404).json({ message: 'Batch not found' });
        }
        const batch = batchRows[0];
        // Build timeline from multiple sources
        const timeline = [];
        // 1. Creation event
        timeline.push({
            date: batch.created_at,
            type: 'CREATED',
            description: 'Batch created',
            details: {
                quantity: batch.quantity,
                supplier_batch: batch.supplier_batch
            }
        });
        // 2. Stock movements
        const [movements] = yield db_1.pool.query('SELECT * FROM stock_movements WHERE batch_id = ? ORDER BY movement_date', [batchId]);
        movements.forEach(m => {
            timeline.push({
                date: m.movement_date,
                type: 'STOCK_MOVEMENT',
                description: `${m.movement_type}: ${m.quantity} ${m.unit}`,
                details: m
            });
        });
        // 3. Quality checks
        const [qcChecks] = yield db_1.pool.query('SELECT * FROM quality_checks WHERE batch_number = ? ORDER BY check_date', [batch.batch_number]);
        qcChecks.forEach(qc => {
            timeline.push({
                date: qc.check_date,
                type: 'QUALITY_CHECK',
                description: `QC Check: ${qc.result}`,
                details: qc
            });
        });
        // 4. Genealogy links (consumed in production)
        const [consumed] = yield db_1.pool.query('SELECT * FROM batch_genealogy WHERE parent_batch_id = ?', [batchId]);
        consumed.forEach(g => {
            timeline.push({
                date: g.created_at,
                type: 'CONSUMED',
                description: `Consumed ${g.quantity_consumed} in production`,
                details: g
            });
        });
        // Sort timeline by date
        timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        res.json({
            batch,
            timeline
        });
    }
    catch (error) {
        console.error('Error fetching batch history:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getBatchHistory = getBatchHistory;
// Get batches near expiry
const getNearExpiryBatches = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { days = 30 } = req.query;
        const [rows] = yield db_1.pool.query(`
            SELECT ib.*, 
                   p.name as product_name,
                   w.name as warehouse_name,
                   DATEDIFF(ib.expiry_date, CURDATE()) as days_to_expiry
            FROM inventory_batches ib
            LEFT JOIN products p ON ib.product_id = p.id
            LEFT JOIN warehouses w ON ib.warehouse_id = w.id
            WHERE ib.expiry_date IS NOT NULL 
            AND ib.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
            AND ib.status = 'ACTIVE'
            AND ib.available_quantity > 0
            ORDER BY ib.expiry_date ASC
        `, [days]);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching near-expiry batches:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getNearExpiryBatches = getNearExpiryBatches;
