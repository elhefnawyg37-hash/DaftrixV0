"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adminController_1 = require("../controllers/adminController");
const router = express_1.default.Router();
// Reset database
router.post('/reset-database', adminController_1.resetDatabase);
// Fiscal Year Rollover
router.post('/fiscal-year-rollover', adminController_1.fiscalYearRollover);
exports.default = router;
