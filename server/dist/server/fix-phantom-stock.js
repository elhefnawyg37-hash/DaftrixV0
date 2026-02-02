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
function fixPhantomStock() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const conn = yield pool.getConnection();
            console.log('Connected to DB');
            // Target Products
            const targetNames = ['Ram Kit 2*8', 'RTX 5060'];
            // 1. Find Product IDs
            const [products] = yield conn.query("SELECT id, name FROM products WHERE name IN (?)", [targetNames]);
            const productIds = products.map(p => p.id);
            if (productIds.length === 0) {
                console.log('No matching products found.');
                return;
            }
            console.log(`Found ${productIds.length} products to fix.`);
            // 2. Update product_stocks to 0
            const [result] = yield conn.query("UPDATE product_stocks SET stock = 0 WHERE productId IN (?)", [productIds]);
            console.log(`Updated product_stocks: ${result.affectedRows} rows affected.`);
            // 3. Update legacy products table stock to 0 (just in case)
            const [resultLegacy] = yield conn.query("UPDATE products SET stock = 0 WHERE id IN (?)", [productIds]);
            console.log(`Updated products (legacy): ${resultLegacy.affectedRows} rows affected.`);
            console.log('✓ Phantom stock cleared.');
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
fixPhantomStock();
