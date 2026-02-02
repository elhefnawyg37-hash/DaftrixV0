"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bomController_1 = require("../controllers/bomController");
const router = (0, express_1.Router)();
// BOM Routes
router.get('/', bomController_1.getBOMs);
router.get('/:id', bomController_1.getBOMById);
router.post('/', bomController_1.createBOM);
router.put('/:id', bomController_1.updateBOM);
router.delete('/:id', bomController_1.deleteBOM);
// BOM Calculations
router.post('/calculate-requirements', bomController_1.calculateBOMRequirements);
exports.default = router;
