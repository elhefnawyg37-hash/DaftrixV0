"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const routingController_1 = require("../controllers/routingController");
const router = express_1.default.Router();
// Routing routes
router.get('/', routingController_1.getRoutings);
router.get('/:id', routingController_1.getRouting);
router.get('/:id/calculate-cost', routingController_1.calculateRoutingCost);
router.post('/', routingController_1.createRouting);
router.put('/:id', routingController_1.updateRouting);
router.delete('/:id', routingController_1.deleteRouting);
exports.default = router;
