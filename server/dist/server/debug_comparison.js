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
function debugCompare() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const conn = yield promise_1.default.createConnection(dbConfig);
        try {
            console.log('--- Timestamp Comparison ---');
            // 1. Get the SUBMITTED settlement
            const [rows] = yield conn.query(`
            SELECT id, vehicleId, settlementDate, createdAt, totalDiscounts, salesmanId, status
            FROM vehicle_settlements 
            WHERE status = 'SUBMITTED' 
            ORDER BY createdAt DESC LIMIT 1
        `);
            const s = rows[0];
            console.log(`Current Settlement (Sales=600): CreatedAt=${s.createdAt}, ID=${s.id}`);
            // 2. Get Previous Cutoff
            const [prev] = yield conn.query(`
            SELECT createdAt 
            FROM vehicle_settlements 
            WHERE vehicleId = ? 
            AND status IN ('APPROVED', 'SUBMITTED')
            AND createdAt < ?
            ORDER BY createdAt DESC LIMIT 1
        `, [s.vehicleId, s.createdAt]);
            const cutoff = (_a = prev[0]) === null || _a === void 0 ? void 0 : _a.createdAt;
            console.log(`Previous Cutoff (Approved):     ${cutoff || 'NONE'}`);
            // 3. Get Invoices for the day
            const [invoices] = yield conn.query(`
            SELECT id, createdAt, discount, globalDiscount, total, salesmanId
            FROM invoices 
            WHERE DATE(date) = ?
            AND type LIKE '%SALE%' 
            ORDER BY createdAt ASC
        `, [s.settlementDate]);
            console.log('--- Invoices ---');
            let calculatedDisc = 0;
            for (const inv of invoices) {
                const disc = Number(inv.discount || 0) + Number(inv.globalDiscount || 0);
                let status = '❌ OUT';
                // Logic Check
                let inRange = true;
                if (cutoff && inv.createdAt <= cutoff)
                    inRange = false;
                // Note: createSettlement logic includes everything > cutoff.
                // It doesn't have an upper bound of "now" implicitly except when query runs.
                if (inRange) {
                    status = '✅ IN';
                    calculatedDisc += disc;
                }
                console.log(`[${status}] Inv ${inv.id.slice(0, 5)}... | CreatedAt: ${inv.createdAt.toISOString()} | Disc: ${disc} | Salesman: ${inv.salesmanId}`);
            }
            console.log('----------------');
            console.log(`Debug Logic Calculated Discount: ${calculatedDisc}`);
            console.log(`DB Stored Discount: ${s.totalDiscounts}`);
            // Check Salesman Match
            const start = (_b = invoices[0]) === null || _b === void 0 ? void 0 : _b.salesmanId;
            const sId = s.salesmanId;
            console.log(`Settlement Salesman: ${sId}, Invoice Salesman: ${start}`);
            if (start !== sId)
                console.log('⚠️ SALESMAN MISMATCH DETECTED');
        }
        catch (e) {
            console.error(e);
        }
        finally {
            yield conn.end();
        }
    });
}
debugCompare();
