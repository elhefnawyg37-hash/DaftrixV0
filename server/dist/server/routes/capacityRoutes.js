"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const capacityController_1 = require("../controllers/capacityController");
const router = (0, express_1.Router)();
// Capacity Planning Routes
router.get('/load', capacityController_1.getCapacityLoad);
router.get('/summary', capacityController_1.getCapacitySummary);
router.get('/bottlenecks', capacityController_1.getBottlenecks);
router.get('/work-center/:id/schedule', capacityController_1.getWorkCenterSchedule);
exports.default = router;
