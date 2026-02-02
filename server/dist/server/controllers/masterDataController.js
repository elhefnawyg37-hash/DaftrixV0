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
exports.cashCategories = exports.partnerGroups = exports.costCenters = exports.taxes = exports.salesmen = exports.categories = exports.warehouses = exports.branches = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const errorHandler_1 = require("../utils/errorHandler");
// Generic Helper for CRUD operations with real-time sync
const createCrudHandlers = (tableName) => ({
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const [rows] = yield db_1.pool.query(`SELECT * FROM ${tableName}`);
            res.json(rows);
        }
        catch (error) {
            return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
        }
    }),
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const data = req.body;
            const id = data.id || (0, uuid_1.v4)();
            const keys = Object.keys(data).filter(k => k !== 'id');
            const values = keys.map(k => data[k]);
            const query = `INSERT INTO ${tableName} (id, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`;
            yield db_1.pool.query(query, [id, ...values]);
            // Broadcast real-time update
            const io = req.app.get('io');
            if (io) {
                io.emit('entity:changed', { entityType: tableName, updatedBy: 'System' });
            }
            res.status(201).json(Object.assign(Object.assign({}, data), { id }));
        }
        catch (error) {
            return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
        }
    }),
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const data = req.body;
            const keys = Object.keys(data).filter(k => k !== 'id');
            const values = keys.map(k => data[k]);
            const query = `UPDATE ${tableName} SET ${keys.map(k => `${k}=?`).join(', ')} WHERE id=?`;
            yield db_1.pool.query(query, [...values, id]);
            // Broadcast real-time update
            const io = req.app.get('io');
            if (io) {
                io.emit('entity:changed', { entityType: tableName, updatedBy: 'System' });
            }
            res.json(Object.assign(Object.assign({}, data), { id }));
        }
        catch (error) {
            return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
        }
    }),
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            yield db_1.pool.query(`DELETE FROM ${tableName} WHERE id=?`, [id]);
            // Broadcast real-time deletion
            const io = req.app.get('io');
            if (io) {
                io.emit('entity:deleted', { entityType: tableName, entityId: id, deletedBy: 'System' });
            }
            res.json({ message: 'Deleted successfully' });
        }
        catch (error) {
            return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
        }
    })
});
exports.branches = createCrudHandlers('branches');
exports.warehouses = createCrudHandlers('warehouses');
exports.categories = createCrudHandlers('categories');
exports.salesmen = Object.assign(Object.assign({}, createCrudHandlers('salesmen')), { getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const query = `
                SELECT s.*, 
                (
                    CASE 
                        WHEN s.type = 'COLLECTION' THEN (
                            SELECT COALESCE(SUM(total), 0)
                            FROM invoices i 
                            WHERE i.salesmanId = s.id AND i.type = 'RECEIPT'
                        )
                        ELSE (
                            SELECT 
                                COALESCE(SUM(CASE WHEN type = 'INVOICE_SALE' THEN total ELSE 0 END), 0) - 
                                COALESCE(SUM(CASE WHEN type = 'RETURN_SALE' THEN total ELSE 0 END), 0)
                            FROM invoices i 
                            WHERE i.salesmanId = s.id 
                        )
                    END
                ) as achieved
                FROM salesmen s
            `;
            const [rows] = yield db_1.pool.query(query);
            res.json(rows);
        }
        catch (error) {
            return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
        }
    }) });
exports.taxes = createCrudHandlers('taxes');
exports.costCenters = createCrudHandlers('cost_centers');
exports.partnerGroups = createCrudHandlers('partner_groups');
// Custom handler for cash_categories to support subcategories
exports.cashCategories = Object.assign(Object.assign({}, createCrudHandlers('cash_categories')), { getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const [rows] = yield db_1.pool.query('SELECT * FROM cash_categories');
            // Build hierarchy: parent categories with nested subcategories
            const parentCategories = rows.filter((cat) => !cat.parentId);
            const childCategories = rows.filter((cat) => cat.parentId);
            const categoriesWithSubs = parentCategories.map((parent) => (Object.assign(Object.assign({}, parent), { subcategories: childCategories.filter((child) => child.parentId === parent.id) })));
            res.json(categoriesWithSubs);
        }
        catch (error) {
            return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
        }
    }) });
