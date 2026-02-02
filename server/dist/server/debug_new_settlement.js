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
function debugSettlement() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const conn = yield promise_1.default.createConnection(dbConfig);
        try {
            console.log('--- Debugging Latest Settlement ---');
            // 1. Get the SUBMITTED settlement with ~250 sales (from screenshot)
            const [rows] = yield conn.query(`
            SELECT id, settlementDate, status, totalSales, totalDiscounts, totalBankTransfers, createdAt, vehicleId 
            FROM vehicle_settlements 
            WHERE totalSales = 250 
            ORDER BY createdAt DESC LIMIT 1
        `);
            if (rows.length === 0) {
                console.log('No SUBMITTED settlement found.');
                return;
            }
            const s = rows[0];
            console.log('Settlement Found:');
            console.table([s]);
            // 2. Find the Previous Settlement (Cutoff)
            const [prev] = yield conn.query(`
            SELECT createdAt as cutoff FROM vehicle_settlements 
            WHERE status IN ('APPROVED', 'SUBMITTED') 
            AND createdAt < ? 
            ORDER BY createdAt DESC LIMIT 1
        `, [s.createdAt]);
            const cutoff = (_a = prev[0]) === null || _a === void 0 ? void 0 : _a.cutoff;
            console.log(`Previous Settlement Cutoff: ${cutoff}`);
            // 3. Find Invoices that SHOULD be in this settlement
            // Range: (Cutoff, Settlement.createdAt]
            console.log('--- Invoices in Range ---');
            let iQuery = `
            SELECT id, date, createdAt, discount, globalDiscount, total, type, paymentMethod, status, salesmanId
            FROM invoices 
            WHERE DATE(date) = ? 
            AND type LIKE '%SALE%' AND type NOT LIKE '%RETURN%'
        `;
            const params = [s.settlementDate]; // This is YYYY-MM-DD string roughly
            if (cutoff) {
                iQuery += ` AND createdAt > ?`;
                params.push(cutoff);
            }
            iQuery += ` AND createdAt <= ?`;
            params.push(s.createdAt);
            const [invoices] = yield conn.query(iQuery, params);
            // Check Vehicle Salesman
            const [vRows] = yield conn.query('SELECT salesmanId FROM vehicles WHERE id = ?', [s.vehicleId]);
            const vehicleSalesman = (_b = vRows[0]) === null || _b === void 0 ? void 0 : _b.salesmanId;
            console.log(`Vehicle Salesman ID: ${vehicleSalesman}`);
            console.log('--- Invoices in Range ---');
            for (const inv of invoices) {
                console.log(`Inv: ${inv.id.slice(0, 5)} | Status: ${inv.status} | Salesman: ${inv.salesmanId} | Disc: ${inv.discount} | Global: ${inv.globalDiscount}`);
                if (inv.status !== 'POSTED')
                    console.log('⚠️ WARNING: Invoice NOT POSTED');
                if (inv.salesmanId !== vehicleSalesman)
                    console.log('⚠️ WARNING: Salesman ID Mismatch');
            }
            // 4. Calculate total expected discount
            const totalDisc = invoices.reduce((acc, inv) => acc + (Number(inv.discount || 0) + Number(inv.globalDiscount || 0)), 0);
            console.log(`Calculated Discount from Invoices: ${totalDisc}`);
            console.log(`Stored Discount in Settlement: ${s.totalDiscounts}`);
        }
        catch (e) {
            console.error(e);
        }
        finally {
            yield conn.end();
        }
    });
}
debugSettlement();
