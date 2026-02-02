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
exports.togglePriceListStatus = exports.deletePriceList = exports.updatePriceList = exports.createPriceList = exports.getPriceLists = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const errorHandler_1 = require("../utils/errorHandler");
const getPriceLists = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const [rows] = yield conn.query('SELECT * FROM price_lists ORDER BY createdAt DESC');
        conn.release();
        res.json(rows);
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'price lists');
    }
});
exports.getPriceLists = getPriceLists;
const createPriceList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, isActive } = req.body;
        const id = (0, uuid_1.v4)();
        const conn = yield (0, db_1.getConnection)();
        yield conn.query('INSERT INTO price_lists (id, name, description, isActive) VALUES (?, ?, ?, ?)', [id, name, description || null, isActive !== undefined ? isActive : true]);
        // When creating a new price list, automatically add it to all existing products
        yield conn.query(`
            INSERT INTO product_prices (productId, priceListId, price)
            SELECT id, ?, 0 FROM products
        `, [id]);
        conn.release();
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'price_lists', updatedBy: 'System' });
        }
        res.status(201).json({ id, name, description, isActive });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'creating price list');
    }
});
exports.createPriceList = createPriceList;
const updatePriceList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;
        const conn = yield (0, db_1.getConnection)();
        yield conn.query('UPDATE price_lists SET name = ?, description = ?, isActive = ? WHERE id = ?', [name, description || null, isActive, id]);
        conn.release();
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'price_lists', updatedBy: 'System' });
        }
        res.json({ id, name, description, isActive });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'updating price list');
    }
});
exports.updatePriceList = updatePriceList;
const deletePriceList = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const conn = yield (0, db_1.getConnection)();
        // CASCADE delete will automatically remove related product_prices
        yield conn.query('DELETE FROM price_lists WHERE id = ?', [id]);
        conn.release();
        // Broadcast real-time deletion
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:deleted', { entityType: 'price_lists', entityId: id, deletedBy: 'System' });
        }
        res.json({ message: 'Price list deleted' });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'deleting price list');
    }
});
exports.deletePriceList = deletePriceList;
const togglePriceListStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const conn = yield (0, db_1.getConnection)();
        yield conn.query('UPDATE price_lists SET isActive = NOT isActive WHERE id = ?', [id]);
        const [rows] = yield conn.query('SELECT * FROM price_lists WHERE id = ?', [id]);
        conn.release();
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'price_lists', updatedBy: 'System' });
        }
        res.json(rows[0]);
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'toggling price list statu');
    }
});
exports.togglePriceListStatus = togglePriceListStatus;
