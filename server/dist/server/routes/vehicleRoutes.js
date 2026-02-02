"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const vehicleController_1 = require("../controllers/vehicleController");
const router = express_1.default.Router();
// ==========================================
// SPECIFIC ROUTES (must come before /:id)
// ==========================================
// Root and list routes
router.get('/', vehicleController_1.getVehicles);
router.post('/', vehicleController_1.createVehicle);
// Inventory - all vehicles
router.get('/inventory', vehicleController_1.getAllVehicleInventory);
// Operations - all vehicles
router.get('/operations', vehicleController_1.getAllOperations);
router.get('/operations/:operationId', vehicleController_1.getOperationDetails);
router.delete('/operations/:operationId', vehicleController_1.deleteOperation);
// Report
router.get('/report', vehicleController_1.getVehicleReport);
// Customer Visits (تتبع زيارات العملاء)
router.get('/visits', vehicleController_1.getCustomerVisits);
router.post('/visits', vehicleController_1.createCustomerVisit);
router.post('/visits/sale', vehicleController_1.createVanSaleVisit); // Create full sale invoice from visit
router.post('/visits/return', vehicleController_1.createVanReturnVisit); // NEW: Create return invoice from visit
router.put('/visits/:visitId', vehicleController_1.updateCustomerVisit);
router.delete('/visits/:visitId', vehicleController_1.deleteCustomerVisit);
// Vehicle Returns (مرتجعات المبيعات المتنقلة)
router.get('/returns', vehicleController_1.getVehicleReturns);
router.post('/returns', vehicleController_1.createVehicleReturn);
router.put('/returns/:returnId/process', vehicleController_1.processVehicleReturn);
// Diagnostic endpoint - check bank invoices (temp debug)
router.get('/debug-bank-invoices', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { pool } = yield Promise.resolve().then(() => __importStar(require('../db')));
        const [invoices] = yield pool.query(`
            SELECT id, date, partnerId, total, paymentMethod, status, type 
            FROM invoices 
            WHERE paymentMethod = 'BANK' 
            AND status = 'POSTED'
            ORDER BY date DESC
            LIMIT 20
        `);
        const [settlements] = yield pool.query(`
            SELECT id, settlementDate, totalBankTransfers 
            FROM vehicle_settlements 
            ORDER BY settlementDate DESC 
            LIMIT 10
        `);
        res.json({
            bankInvoices: invoices,
            settlements,
            summary: `Found ${invoices.length} BANK invoices`
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}));
// End of Day Settlement (تسوية نهاية اليوم)
router.get('/settlements', vehicleController_1.getSettlements);
router.post('/settlements', vehicleController_1.createSettlement);
router.put('/settlements/:settlementId', vehicleController_1.updateSettlement);
router.delete('/settlements/:settlementId', vehicleController_1.deleteSettlement);
router.post('/settlements/:settlementId/approve', vehicleController_1.approveSettlement);
router.post('/settlements/:settlementId/dispute', vehicleController_1.disputeSettlement);
router.post('/settlements/:settlementId/submit', vehicleController_1.submitSettlement);
router.get('/settlements/approved', vehicleController_1.getApprovedSettlements);
// Daily Report (التقرير اليومي)
router.get('/daily-report', vehicleController_1.getDailyReport);
// Customer Vehicle History (سجل عمليات السيارة للعميل)
router.get('/customer/:customerId/history', vehicleController_1.getCustomerVehicleHistory);
// ==========================================
// VAN SALES ENHANCEMENT ROUTES (2025-12-24)
// ==========================================
// Vehicle Targets (أهداف السيارات)
router.get('/targets', vehicleController_1.getVehicleTargets);
router.post('/targets', vehicleController_1.createVehicleTarget);
router.put('/targets/:id', vehicleController_1.updateVehicleTarget);
router.delete('/targets/:id', vehicleController_1.deleteVehicleTarget);
// Vehicle Maintenance (صيانة السيارات)
router.get('/maintenance', vehicleController_1.getVehicleMaintenance);
router.post('/maintenance', vehicleController_1.createVehicleMaintenance);
router.put('/maintenance/:id', vehicleController_1.updateVehicleMaintenance);
router.delete('/maintenance/:id', vehicleController_1.deleteVehicleMaintenance);
// Fuel Logs (سجل الوقود)
router.get('/fuel-logs', vehicleController_1.getVehicleFuelLogs);
router.post('/fuel-logs', vehicleController_1.createVehicleFuelLog);
router.delete('/fuel-logs/:id', vehicleController_1.deleteVehicleFuelLog);
// Alerts (تنبيهات)
router.get('/alerts/low-stock', vehicleController_1.getVehicleLowStockAlerts);
// Enhanced Reports (تقارير متقدمة)
router.get('/reports/performance', vehicleController_1.getVehiclePerformanceReport);
router.get('/reports/products', vehicleController_1.getProductPerformanceReport);
// Routes / خطوط السير
router.get('/salesman-routes', vehicleController_1.getSalesmanRoutes); // Mobile sync - user's routes with stops
router.get('/routes', vehicleController_1.getRoutes);
router.post('/routes', vehicleController_1.createRoute);
router.get('/routes/:id', vehicleController_1.getRoute);
router.put('/routes/:id', vehicleController_1.updateRoute);
router.delete('/routes/:id', vehicleController_1.deleteRoute);
router.post('/routes/:id/start', vehicleController_1.startRoute);
router.post('/routes/:id/complete', vehicleController_1.completeRoute);
// DEBUG endpoint - accessible via browser
router.get('/debug-discounts', vehicleController_1.debugDiscounts);
// Route Stops (محطات خط السير)
router.post('/routes/:routeId/stops', vehicleController_1.addRouteStop);
router.put('/routes/stops/:stopId', vehicleController_1.updateRouteStop);
router.post('/routes/stops/:stopId/visited', vehicleController_1.markStopVisited); // Mark stop as visited/completed
router.delete('/routes/stops/:stopId', vehicleController_1.deleteRouteStop);
// ==========================================
// PARAMETERIZED ROUTES (must come after specific routes)
// ==========================================
// Vehicle by ID
router.get('/:id', vehicleController_1.getVehicle);
router.put('/:id', vehicleController_1.updateVehicle);
router.delete('/:id', vehicleController_1.deleteVehicle);
// Vehicle Inventory
router.get('/:id/inventory', vehicleController_1.getVehicleInventory);
// Vehicle Operations
router.post('/:id/load', vehicleController_1.loadVehicle);
router.post('/:id/unload', vehicleController_1.unloadVehicle);
router.get('/:id/operations', vehicleController_1.getVehicleOperations);
// Vehicle Location (GPS)
router.put('/:id/location', vehicleController_1.updateVehicleLocation);
exports.default = router;
