"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const productionController_1 = require("../controllers/productionController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Production Order Routes - view requires manufacturing.view, CRUD requires manufacturing.production
router.get('/', (0, authMiddleware_1.requirePermission)('manufacturing.view'), productionController_1.getProductionOrders);
router.get('/:id', (0, authMiddleware_1.requirePermission)('manufacturing.view'), productionController_1.getProductionOrder);
router.post('/', (0, authMiddleware_1.requirePermission)('manufacturing.production'), productionController_1.createProductionOrder);
router.put('/:id', (0, authMiddleware_1.requirePermission)('manufacturing.production'), productionController_1.updateProductionOrder);
router.delete('/:id', (0, authMiddleware_1.requirePermission)('manufacturing.production'), productionController_1.deleteProductionOrder);
// Production Operations - requires manufacturing.production permission
router.post('/:id/start', (0, authMiddleware_1.requirePermission)('manufacturing.production'), productionController_1.startProduction);
router.post('/:id/finish', (0, authMiddleware_1.requirePermission)('manufacturing.production'), productionController_1.finishProduction);
router.post('/:id/cancel', (0, authMiddleware_1.requirePermission)('manufacturing.production'), productionController_1.cancelProduction);
exports.default = router;
