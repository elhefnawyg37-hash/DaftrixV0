"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const installmentController_1 = require("../controllers/installmentController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(authMiddleware_1.authenticateToken);
// Dashboard / Stats
router.get('/stats', installmentController_1.getInstallmentStats);
router.get('/overdue', installmentController_1.getOverdueInstallments);
router.get('/upcoming', installmentController_1.getUpcomingInstallments);
// Installment Plans CRUD
router.get('/plans', installmentController_1.getInstallmentPlans);
router.get('/plans/:id', installmentController_1.getInstallmentPlan);
router.post('/plans', installmentController_1.createInstallmentPlan);
router.put('/plans/:id/cancel', installmentController_1.cancelInstallmentPlan);
// Partner-specific
router.get('/partner/:partnerId', installmentController_1.getPartnerInstallments);
// Individual installment payment
router.post('/pay/:id', installmentController_1.payInstallment);
exports.default = router;
