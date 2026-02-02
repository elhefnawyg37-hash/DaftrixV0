"use strict";
/**
 * Delta Sync Routes
 * =================
 * API routes for mobile delta synchronization
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const deltaSyncController_1 = require("../controllers/deltaSyncController");
const router = (0, express_1.Router)();
// Health check (no auth required)
router.get('/health', deltaSyncController_1.healthCheck);
// Sync status (auth required)
router.get('/sync/status', authMiddleware_1.authenticateToken, deltaSyncController_1.getSyncStatus);
router.get('/sync/status/enhanced', authMiddleware_1.authenticateToken, deltaSyncController_1.getEnhancedSyncStatus);
// Core delta sync endpoints
router.get('/products/delta', authMiddleware_1.authenticateToken, deltaSyncController_1.getProductsDelta);
router.get('/partners/delta', authMiddleware_1.authenticateToken, deltaSyncController_1.getPartnersDelta);
router.get('/invoices/delta', authMiddleware_1.authenticateToken, deltaSyncController_1.getInvoicesDelta);
router.get('/vehicles/delta', authMiddleware_1.authenticateToken, deltaSyncController_1.getVehiclesDelta);
// New delta sync endpoints for enhanced offline support
router.get('/payments/delta', authMiddleware_1.authenticateToken, deltaSyncController_1.getPaymentsDelta);
router.get('/price-lists/delta', authMiddleware_1.authenticateToken, deltaSyncController_1.getPriceListsDelta);
router.get('/price-list-items/delta', authMiddleware_1.authenticateToken, deltaSyncController_1.getPriceListItemsDelta);
router.get('/stock-movements/delta', authMiddleware_1.authenticateToken, deltaSyncController_1.getStockMovementsDelta);
router.get('/settings/delta', authMiddleware_1.authenticateToken, deltaSyncController_1.getSettingsDelta);
exports.default = router;
