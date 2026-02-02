"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productStockController_1 = require("../controllers/productStockController");
const router = express_1.default.Router();
router.get('/', productStockController_1.getProductStocks);
router.get('/product/:productId', productStockController_1.getProductStocksByProduct);
router.get('/warehouse/:warehouseId', productStockController_1.getProductStocksByWarehouse);
router.post('/', productStockController_1.upsertProductStock);
router.delete('/:id', productStockController_1.deleteProductStock);
exports.default = router;
