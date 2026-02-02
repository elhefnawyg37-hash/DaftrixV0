"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const treasuryController_1 = require("../controllers/treasuryController");
const router = express_1.default.Router();
// Receipts (for mobile app)
router.post('/receipts', treasuryController_1.createReceipt);
// Banks
router.get('/banks', treasuryController_1.getBanks);
router.post('/banks', treasuryController_1.createBank);
router.put('/banks/:id', treasuryController_1.updateBank);
router.post('/banks/:id/resync', treasuryController_1.resyncBankGL);
router.delete('/banks/:id', treasuryController_1.deleteBank);
// Cheques
router.get('/cheques', treasuryController_1.getCheques);
router.put('/cheques/:id', treasuryController_1.updateCheque);
exports.default = router;
