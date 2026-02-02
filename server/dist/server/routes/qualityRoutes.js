"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const qualityController_1 = require("../controllers/qualityController");
const router = express_1.default.Router();
// QC Templates
router.get('/templates', qualityController_1.getQCTemplates);
router.get('/templates/:id', qualityController_1.getQCTemplate);
router.post('/templates', qualityController_1.createQCTemplate);
router.put('/templates/:id', qualityController_1.updateQCTemplate);
router.delete('/templates/:id', qualityController_1.deleteQCTemplate);
// Quality Checks
router.get('/checks', qualityController_1.getQualityChecks);
router.get('/checks/:id', qualityController_1.getQualityCheck);
router.post('/checks', qualityController_1.createQualityCheck);
router.put('/checks/:id/complete', qualityController_1.completeQualityCheck);
router.delete('/checks/:id', qualityController_1.deleteQualityCheck);
// Statistics
router.get('/stats', qualityController_1.getQualityStats);
exports.default = router;
