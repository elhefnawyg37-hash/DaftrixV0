"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const workCenterController_1 = require("../controllers/workCenterController");
const router = express_1.default.Router();
// Work Center routes
router.get('/', workCenterController_1.getWorkCenters);
router.get('/:id', workCenterController_1.getWorkCenter);
router.post('/', workCenterController_1.createWorkCenter);
router.put('/:id', workCenterController_1.updateWorkCenter);
router.delete('/:id', workCenterController_1.deleteWorkCenter);
exports.default = router;
