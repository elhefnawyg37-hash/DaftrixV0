"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const batchController_1 = require("../controllers/batchController");
const router = express_1.default.Router();
// Batch Management
router.get('/', batchController_1.getBatches);
router.get('/near-expiry', batchController_1.getNearExpiryBatches);
router.get('/:id', batchController_1.getBatch);
router.post('/', batchController_1.createBatch);
router.put('/:id', batchController_1.updateBatch);
// Genealogy & Traceability
router.post('/genealogy', batchController_1.recordGenealogy);
router.get('/:batchId/forward-trace', batchController_1.forwardTrace);
router.get('/:batchId/backward-trace', batchController_1.backwardTrace);
router.get('/:batchId/history', batchController_1.getBatchHistory);
exports.default = router;
