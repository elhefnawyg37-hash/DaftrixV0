"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mrpController_1 = require("../controllers/mrpController");
const router = (0, express_1.Router)();
// MRP Routes
router.get('/calculate', mrpController_1.calculateMRP);
router.post('/generate-suggestions', mrpController_1.generateSuggestions);
router.get('/suggestions', mrpController_1.getSuggestions);
router.put('/suggestions/:id', mrpController_1.updateSuggestion);
router.delete('/suggestions/:id', mrpController_1.deleteSuggestion);
router.post('/convert-to-orders', mrpController_1.convertToOrders);
exports.default = router;
