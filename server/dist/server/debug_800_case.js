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
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '.env') });
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cloud_erp',
};
function debug800Case() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield promise_1.default.createConnection(dbConfig);
        try {
            console.log('--- Debugging 800 Sales Case ---');
            // 1. Find the 800 Sales Settlement
            const [rows] = yield conn.query(`
            SELECT id, vehicleId, settlementDate, createdAt, updatedAt, totalSales, totalDiscounts, status
            FROM vehicle_settlements 
            WHERE totalSales = 800
            ORDER BY createdAt DESC LIMIT 1
        `);
            const s800 = rows[0];
            if (!s800) {
                console.log('Settlement 800 not found');
                return;
            }
            console.log(`Settlement: ID=${s800.id} CreatedAt=${s800.createdAt.toISOString()} UpdatedAt=${s800.updatedAt.toISOString()} Status=${s800.status}`);
            console.log(`Stored Sales: ${s800.totalSales} | Stored Discount: ${s800.totalDiscounts}`);
            // 2. Find Invoices
            const [invoices] = yield conn.query(`
            SELECT id, createdAt, discount, globalDiscount, status
            FROM invoices
            WHERE vehicleId = ? AND DATE(date) = ? AND status = 'POSTED'
            ORDER BY createdAt DESC
            LIMIT 5
        `, [s800.vehicleId, s800.settlementDate]);
            console.log('\n--- Recent Invoices ---');
            invoices.forEach((inv) => {
                console.log(`Inv: ${inv.id.slice(0, 5)} | CreatedAt: ${inv.createdAt.toISOString()} | Disc: ${Number(inv.discount) + Number(inv.globalDiscount)}`);
            });
        }
        catch (e) {
            console.error(e);
        }
        finally {
            yield conn.end();
        }
    });
}
debug800Case();
