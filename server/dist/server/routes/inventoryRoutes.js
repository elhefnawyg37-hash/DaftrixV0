"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventoryController_1 = require("../controllers/inventoryController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Stock Taking - requires inventory.stock_taking permission
router.get('/stock-taking', (0, authMiddleware_1.requirePermission)('inventory.stock_taking'), inventoryController_1.getStockTakingSessions);
router.post('/stock-taking', (0, authMiddleware_1.requirePermission)('inventory.stock_taking'), inventoryController_1.createStockTakingSession);
router.put('/stock-taking/:id', (0, authMiddleware_1.requirePermission)('inventory.stock_taking'), inventoryController_1.updateStockTakingSession);
router.delete('/stock-taking/:id', (0, authMiddleware_1.requirePermission)('inventory.stock_taking'), inventoryController_1.deleteStockTakingSession);
// Recalculate Stock - admin/system settings only
router.post('/recalculate-stock', (0, authMiddleware_1.requirePermission)('system.settings'), inventoryController_1.recalculateStock);
// Flow Report - inventory view permission
router.get('/flow-report', (0, authMiddleware_1.requirePermission)('inventory.view'), inventoryController_1.getInventoryFlowReport);
exports.default = router;
