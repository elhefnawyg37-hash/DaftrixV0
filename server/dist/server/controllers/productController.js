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
exports.searchProducts = exports.getNextSku = exports.updateProductPrices = exports.getProductPrices = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getPaginatedProducts = exports.getProduct = exports.getProducts = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const auditController_1 = require("./auditController");
const errorHandler_1 = require("../utils/errorHandler");
const getProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        const [rows] = yield conn.query('SELECT * FROM products');
        conn.release();
        res.json(rows);
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getProducts');
    }
});
exports.getProducts = getProducts;
const getProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const conn = yield (0, db_1.getConnection)();
        const [rows] = yield conn.query('SELECT * FROM products WHERE id = ?', [id]);
        if (rows.length === 0) {
            conn.release();
            return res.status(404).json({ message: 'Product not found' });
        }
        const product = rows[0];
        // Fetch prices
        const [prices] = yield conn.query(`
            SELECT pp.*, pl.name as priceListName 
            FROM product_prices pp
            JOIN price_lists pl ON pp.priceListId = pl.id
            WHERE pp.productId = ?
        `, [id]);
        conn.release();
        product.pricingTiers = prices.map(price => ({
            id: price.priceListId,
            label: price.priceListName,
            price: price.price
        }));
        res.json(product);
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getProduct');
    }
});
exports.getProduct = getProduct;
const getPaginatedProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;
        const conn = yield (0, db_1.getConnection)();
        let query = 'SELECT * FROM products';
        let countQuery = 'SELECT COUNT(*) as total FROM products';
        let params = [];
        if (search) {
            const searchCondition = ' WHERE name LIKE ? OR sku LIKE ?';
            query += searchCondition;
            countQuery += searchCondition;
            const searchParam = `%${search}%`;
            params = [searchParam, searchParam];
        }
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const [rows] = yield conn.query(query, params);
        const [countResult] = yield conn.query(countQuery, search ? [params[0], params[1]] : []);
        // Attach pricing tiers
        const products = rows;
        if (products.length > 0) {
            const productIds = products.map(p => p.id);
            const [prices] = yield conn.query(`
                SELECT pp.*, pl.name as priceListName 
                FROM product_prices pp
                JOIN price_lists pl ON pp.priceListId = pl.id
                WHERE pp.productId IN (?)
            `, [productIds]);
            const pricesList = prices;
            products.forEach(p => {
                p.pricingTiers = pricesList
                    .filter(price => price.productId === p.id)
                    .map(price => ({
                    id: price.priceListId,
                    label: price.priceListName,
                    price: price.price
                }));
            });
        }
        conn.release();
        res.json({
            products: rows,
            total: countResult[0].total,
            page,
            totalPages: Math.ceil(countResult[0].total / limit)
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getProductsPaginated');
    }
});
exports.getPaginatedProducts = getPaginatedProducts;
const createProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        // =====================================================
        // Use transaction for atomicity - all operations must
        // succeed together or rollback together
        // =====================================================
        yield conn.beginTransaction();
        const { id: reqId, name, sku, price, cost, stock, warehouseId, categoryId, bomId, type, unit, isManufactured, leadTimeDays } = req.body;
        const id = reqId || (0, uuid_1.v4)();
        // Auto-populate barcode with SKU if not provided
        const barcode = req.body.barcode || sku || null;
        // Insert product with barcode
        yield conn.query('INSERT INTO products (id, name, sku, barcode, price, cost, stock, warehouseId, categoryId, bomId, type, unit, isManufactured, leadTimeDays) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, name, sku, barcode, price, cost, stock, warehouseId, categoryId, bomId, type, unit, isManufactured ? 1 : 0, leadTimeDays || 0]);
        // Auto-create product_prices entries for all active price lists
        yield conn.query(`
            INSERT IGNORE INTO product_prices (productId, priceListId, price)
            SELECT ?, id, 0 FROM price_lists WHERE isActive = TRUE
        `, [id]);
        // Update with provided pricing tiers
        const { pricingTiers } = req.body;
        if (pricingTiers && Array.isArray(pricingTiers)) {
            for (const tier of pricingTiers) {
                yield conn.query(`
                    INSERT INTO product_prices (productId, priceListId, price)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE price = VALUES(price)
                `, [id, tier.id, tier.price]);
            }
        }
        // Create product_stocks entry if product has opening balance and assigned warehouse
        if (warehouseId && stock && Number(stock) > 0) {
            const stockId = (0, uuid_1.v4)();
            yield conn.query(`
                INSERT INTO product_stocks (id, productId, warehouseId, stock)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)
            `, [stockId, id, warehouseId, stock]);
            console.log(`✓ Created warehouse stock entry: Product ${name} -> ${stock} units in warehouse ${warehouseId}`);
        }
        // Commit transaction
        yield conn.commit();
        conn.release();
        const user = req.body.user || 'System';
        yield (0, auditController_1.logAction)(user, 'PRODUCT', 'CREATE', `Created Product: ${name}`, `SKU: ${sku}, Price: ${price}`);
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            const newProduct = Object.assign(Object.assign({}, req.body), { id });
            io.emit('product:changed', { product: newProduct, updatedBy: user });
        }
        console.log(`✅ Product created: ${name} (transaction committed)`);
        res.status(201).json(Object.assign(Object.assign({}, req.body), { id }));
    }
    catch (error) {
        yield conn.rollback();
        conn.release();
        console.error('❌ Error creating product (transaction rolled back):', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'createProduct');
    }
});
exports.createProduct = createProduct;
const updateProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const conn = yield (0, db_1.getConnection)();
    try {
        yield conn.beginTransaction();
        const { id } = req.params;
        const { name, sku, price, cost, stock, warehouseId, categoryId, bomId, type, unit, isManufactured, leadTimeDays } = req.body;
        // Sync barcode with SKU if barcode is not explicitly provided or is empty
        const barcode = req.body.barcode || sku || null;
        // Update product record including barcode
        yield conn.query('UPDATE products SET name = ?, sku = ?, barcode = ?, price = ?, cost = ?, stock = ?, warehouseId = ?, categoryId = ?, bomId = ?, type = ?, unit = ?, isManufactured = ?, leadTimeDays = ? WHERE id = ?', [name, sku, barcode, price, cost, stock, warehouseId, categoryId, bomId, type, unit, isManufactured ? 1 : 0, leadTimeDays || 0, id]);
        // CASCADE: Update product name in all invoice lines
        // This ensures name changes are reflected everywhere in the system
        if (name) {
            try {
                yield conn.query('UPDATE invoice_lines SET productName = ? WHERE productId = ?', [name, id]);
            }
            catch (e) {
                // Ignore if invoice_lines table doesn't exist or has different schema
                console.log('Note: Could not update invoice_lines productName:', e);
            }
        }
        // Update pricing tiers
        const { pricingTiers } = req.body;
        if (pricingTiers && Array.isArray(pricingTiers)) {
            for (const tier of pricingTiers) {
                yield conn.query(`
                    INSERT INTO product_prices (productId, priceListId, price)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE price = VALUES(price)
                `, [id, tier.id, tier.price]);
            }
        }
        yield conn.commit();
        conn.release();
        const user = req.body.user || 'System';
        yield (0, auditController_1.logAction)(user, 'PRODUCT', 'UPDATE', `Updated Product: ${name}`, `ID: ${id}`);
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            const updatedProduct = Object.assign({ id }, req.body);
            io.emit('product:changed', { product: updatedProduct, updatedBy: user });
            io.emit('entity:changed', { entityType: 'product', updatedBy: user });
            io.emit('entity:changed', { entityType: 'invoice', updatedBy: user }); // Invoices may have updated names
        }
        res.json(Object.assign({ id }, req.body));
    }
    catch (error) {
        yield conn.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'updateProduct');
    }
    finally {
        conn.release();
    }
});
exports.updateProduct = updateProduct;
const deleteProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const user = (req.body.user || req.query.user) || 'System';
        const conn = yield (0, db_1.getConnection)();
        // Get product details before deletion
        const [products] = yield conn.query('SELECT name, sku FROM products WHERE id = ?', [id]);
        const product = products[0];
        const productName = (product === null || product === void 0 ? void 0 : product.name) || 'Unknown Product';
        const productSku = (product === null || product === void 0 ? void 0 : product.sku) || '';
        // CASCADE delete will automatically remove product_prices entries
        yield conn.query('DELETE FROM products WHERE id = ?', [id]);
        conn.release();
        yield (0, auditController_1.logAction)(user, 'PRODUCT', 'DELETE', `حذف منتج - ${productName}`, `تم حذف المنتج | الرمز: ${productSku} | رقم المرجع: ${id}`);
        // Broadcast real-time deletion
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:deleted', { entityType: 'product', entityId: id, deletedBy: user });
        }
        res.json({ message: 'Product deleted' });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'deleteProduct');
    }
});
exports.deleteProduct = deleteProduct;
// Get all prices for a specific product across all price lists
const getProductPrices = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const conn = yield (0, db_1.getConnection)();
        const [rows] = yield conn.query(`
            SELECT 
                pp.id,
                pp.productId,
                pp.priceListId,
                pp.price,
                pl.name as priceListName,
                pl.isActive
            FROM product_prices pp
            JOIN price_lists pl ON pp.priceListId = pl.id
            WHERE pp.productId = ?
                ORDER BY pl.name
                `, [id]);
        conn.release();
        res.json(rows);
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getProductPrices');
    }
});
exports.getProductPrices = getProductPrices;
// Batch update all prices for a product
const updateProductPrices = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { prices } = req.body; // Array of { priceListId, price }
        if (!Array.isArray(prices)) {
            return res.status(400).json({ message: 'Prices must be an array' });
        }
        const conn = yield (0, db_1.getConnection)();
        // Update each price
        for (const priceData of prices) {
            yield conn.query(`
                INSERT INTO product_prices(productId, priceListId, price)
                VALUES(?, ?, ?)
                ON DUPLICATE KEY UPDATE price = VALUES(price)
                `, [id, priceData.priceListId, priceData.price]);
        }
        conn.release();
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'product', updatedBy: 'System' });
        }
        res.json({ message: 'Product prices updated successfully' });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'updateProductPrices');
    }
});
exports.updateProductPrices = updateProductPrices;
const getNextSku = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conn = yield (0, db_1.getConnection)();
        // Find the maximum numeric SKU
        const [rows] = yield conn.query('SELECT MAX(CAST(sku AS UNSIGNED)) as maxSku FROM products WHERE sku REGEXP "^[0-9]+$"');
        conn.release();
        const maxSku = rows[0].maxSku || 1000;
        const nextSku = (maxSku + 1).toString();
        res.json({ nextSku });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'getNextSku');
    }
});
exports.getNextSku = getNextSku;
// Search products by name, sku, or barcode
const searchProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const query = req.query.query || '';
        const limit = parseInt(req.query.limit) || 50;
        const conn = yield (0, db_1.getConnection)();
        let sql = 'SELECT id, name, sku, barcode, price, cost, stock, unit, categoryId FROM products';
        let params = [];
        if (query.trim()) {
            sql += ' WHERE name LIKE ? OR sku LIKE ? OR barcode LIKE ?';
            const searchParam = `%${query}%`;
            params = [searchParam, searchParam, searchParam];
        }
        sql += ' ORDER BY name LIMIT ?';
        params.push(limit);
        const [rows] = yield conn.query(sql, params);
        conn.release();
        res.json(rows);
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'searchProducts');
    }
});
exports.searchProducts = searchProducts;
