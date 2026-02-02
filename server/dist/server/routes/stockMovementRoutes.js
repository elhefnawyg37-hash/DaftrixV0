"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stockMovementController_1 = require("../controllers/stockMovementController");
const router = (0, express_1.Router)();
// Stock Movement Routes
router.get('/', stockMovementController_1.getStockMovements);
router.get('/product/:productId', stockMovementController_1.getProductMovementHistory);
router.get('/stats', stockMovementController_1.getMovementStats);
router.post('/', stockMovementController_1.createStockMovement);
router.post('/reconcile', stockMovementController_1.reconcileStock);
exports.default = router;
