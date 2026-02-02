"use strict";
/**
 * POS Routes (نقطة البيع)
 * ========================
 * API endpoints for Point of Sale operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const posController_1 = require("../controllers/posController");
const router = (0, express_1.Router)();
// ============================================
// SHIFT MANAGEMENT
// ============================================
// Open a new shift
router.post('/shift/open', posController_1.openShift);
// Get current open shift for logged-in user
router.get('/shift/current', posController_1.getCurrentShift);
// Close a shift
router.post('/shift/close', posController_1.closeShift);
// Get all shifts (with filters)
router.get('/shifts', posController_1.getShifts);
// Get shift report (X/Z report)
router.get('/shift/:shiftId/report', posController_1.getShiftReport);
// Get shift cash movements
router.get('/shift/:shiftId/movements', posController_1.getShiftMovements);
// Get hourly sales report
router.get('/reports/hourly', posController_1.getHourlySales);
// ============================================
// CASH OPERATIONS
// ============================================
// Add cash movement (deposit/withdrawal)
router.post('/cash-movement', posController_1.addCashMovement);
// ============================================
// SALES
// ============================================
// Process a POS sale
router.post('/sale', posController_1.processPOSSale);
// ============================================
// PRODUCTS
// ============================================
// Get products optimized for POS
router.get('/products', posController_1.getPOSProducts);
// Look up product by barcode
router.get('/product/barcode/:barcode', posController_1.getProductByBarcode);
// ============================================
// HELD ORDERS
// ============================================
// Hold an order for later
router.post('/hold', posController_1.holdOrder);
// Get held orders for a shift
router.get('/held/:shiftId', posController_1.getHeldOrders);
// Recall a held order (and delete it from held)
router.delete('/held/:holdId', posController_1.recallHeldOrder);
exports.default = router;
