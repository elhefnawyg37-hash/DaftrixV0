"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const salesmanTargetController_1 = require("../controllers/salesmanTargetController");
const router = express_1.default.Router();
// Get stats for all salesmen (التحصيل، المديونيه، العجز)
router.get('/stats', salesmanTargetController_1.getAllSalesmanStats);
// Get stats for a specific salesman
router.get('/stats/:salesmanId', salesmanTargetController_1.getSalesmanStats);
// Get all active targets
router.get('/active', salesmanTargetController_1.getAllActiveTargets);
// Get targets for a specific salesman
router.get('/salesman/:salesmanId', salesmanTargetController_1.getSalesmanTargets);
// Get progress report for a salesman
router.get('/salesman/:salesmanId/progress', salesmanTargetController_1.getTargetProgressReport);
// Create new target
router.post('/', salesmanTargetController_1.createSalesmanTarget);
// Update target
router.put('/:id', salesmanTargetController_1.updateSalesmanTarget);
// Delete target
router.delete('/:id', salesmanTargetController_1.deleteSalesmanTarget);
exports.default = router;
