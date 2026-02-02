"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = require("mysql2/promise");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = (0, promise_1.createPool)({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
function checkDB() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const conn = yield pool.getConnection();
            console.log('Connected to DB');
            // Check invoices columns
            const [invoiceCols] = yield conn.query("SHOW COLUMNS FROM invoices");
            const hasWarehouse = invoiceCols.some(c => c.Field === 'warehouseId');
            console.log('Invoices table has warehouseId:', hasWarehouse);
            // Check recent invoices
            if (hasWarehouse) {
                const [invoices] = yield conn.query("SELECT id, warehouseId FROM invoices ORDER BY date DESC LIMIT 3");
                console.log('Recent Invoices:', invoices);
            }
            // Check products columns
            const [productCols] = yield conn.query("SHOW COLUMNS FROM products");
            const hasProdWarehouse = productCols.some(c => c.Field === 'warehouseId');
            console.log('Products table has warehouseId:', hasProdWarehouse);
            // Check product_stocks table
            try {
                const [stockCols] = yield conn.query("SHOW COLUMNS FROM product_stocks");
                console.log('product_stocks table exists');
                const [stocks] = yield conn.query("SELECT * FROM product_stocks LIMIT 5");
                console.log('Sample product_stocks:', stocks);
            }
            catch (e) {
                console.log('product_stocks table does NOT exist');
            }
            conn.release();
        }
        catch (e) {
            console.error(e);
        }
        finally {
            yield pool.end();
        }
    });
}
checkDB();
