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
function checkStockSource() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const conn = yield pool.getConnection();
            console.log('Connected to DB');
            // 1. Find Products by Name (Ram Kit, RTX 5060)
            const [products] = yield conn.query("SELECT id, name, stock, warehouseId FROM products WHERE name LIKE '%Ram%' OR name LIKE '%RTX%'");
            console.log('\n--- Products ---');
            console.log(JSON.stringify(products, null, 2));
            if (products.length === 0) {
                console.log('No matching products found.');
                return;
            }
            const productIds = products.map(p => p.id);
            const placeholders = productIds.map(() => '?').join(',');
            // 2. Check Product Stocks
            const [stocks] = yield conn.query(`SELECT * FROM product_stocks WHERE productId IN (${placeholders})`, productIds);
            console.log('\n--- Product Stocks ---');
            console.log(JSON.stringify(stocks, null, 2));
            // 3. Check Invoices (Purchase)
            const [invoiceLines] = yield conn.query(`
            SELECT il.productId, il.quantity, i.id as invoiceId, i.date, i.warehouseId 
            FROM invoice_lines il
            JOIN invoices i ON il.invoiceId = i.id
            WHERE il.productId IN (${placeholders}) AND i.type = 'INVOICE_PURCHASE'
        `, productIds);
            console.log('\n--- Purchase Invoice Lines ---');
            console.log(JSON.stringify(invoiceLines, null, 2));
            // 4. Check Stock Permits
            try {
                const [permits] = yield conn.query(`SELECT * FROM stock_permits WHERE productId IN (${placeholders})`, productIds);
                console.log('\n--- Stock Permits ---');
                console.log(JSON.stringify(permits, null, 2));
            }
            catch (e) {
                console.log('\n(Stock Permits table might not exist or has different name)');
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
checkStockSource();
