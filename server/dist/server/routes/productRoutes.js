"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const productController_1 = require("../controllers/productController");
const productUnitController_1 = require("../controllers/productUnitController");
const router = (0, express_1.Router)();
router.get('/', productController_1.getProducts);
router.get('/paginated', productController_1.getPaginatedProducts);
router.get('/search', productController_1.searchProducts); // Search products by name/sku/barcode
router.get('/next-sku', productController_1.getNextSku);
router.get('/unit-by-barcode/:barcode', productUnitController_1.getUnitByBarcode); // For POS barcode scanning
// Product Units Routes (وحدات قياس المنتج) - MUST be before /:id to avoid conflicts
router.get('/:productId/units', productUnitController_1.getProductUnits);
router.get('/:productId/units/stock', productUnitController_1.getStockInAllUnits);
router.post('/:productId/units', productUnitController_1.createProductUnit);
router.post('/:productId/units/bulk', productUnitController_1.bulkCreateUnits);
router.post('/:productId/units/convert', productUnitController_1.convertQuantity);
router.put('/:productId/units/:unitId', productUnitController_1.updateProductUnit);
router.delete('/:productId/units/:unitId', productUnitController_1.deleteProductUnit);
// Product Prices Routes
router.get('/:id/prices', productController_1.getProductPrices);
router.put('/:id/prices', productController_1.updateProductPrices);
// Generic Product CRUD - MUST be after specific routes
router.get('/:id', productController_1.getProduct);
router.post('/', productController_1.createProduct);
router.put('/:id', productController_1.updateProduct);
router.delete('/:id', productController_1.deleteProduct);
exports.default = router;
