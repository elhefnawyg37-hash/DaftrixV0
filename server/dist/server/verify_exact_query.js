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
function verifyExactQuery() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const conn = yield promise_1.default.createConnection(dbConfig);
        try {
            console.log('--- Verifying Exact Query from Controller ---');
            // 1. Get the Target Settlement (250 sales)
            const [rows] = yield conn.query(`
            SELECT id, vehicleId, settlementDate, createdAt 
            FROM vehicle_settlements 
            WHERE totalSales = 250 
            ORDER BY createdAt DESC LIMIT 1
        `);
            const s = rows[0];
            if (!s) {
                console.log('Settlement not found');
                return;
            }
            console.log(`Target Vehicle: ${s.vehicleId}`);
            console.log(`Target Date: ${s.settlementDate}`);
            // 2. Get Cutoff (Logic from Controller)
            const [lastSettlement] = yield conn.query(`
            SELECT createdAt as cutoff 
            FROM vehicle_settlements 
            WHERE vehicleId = ? 
            AND settlementDate = ?
            AND (status = 'APPROVED' OR status = 'SUBMITTED')
            AND createdAt < ? -- mimic finding previous
            ORDER BY createdAt DESC LIMIT 1
        `, [s.vehicleId, s.settlementDate, s.createdAt]); // Note: Controller finds "latest for this day". 
            // Logic in controller: 
            // const [lastSettlement] = query(..., [vehicleId, date]);
            // The controller runs BEFORE the new settlement is inserted (passed to calculateRefinedSettlementStats).
            // So it finds any PREVIOUS one.
            // Since the user deleted old ones, this might be empty, or find the "Approved" one from history repair.
            // Let's see what the "Approved" one is.
            const [approved] = yield conn.query(`SELECT createdAt, status FROM vehicle_settlements WHERE vehicleId = ? AND status='APPROVED' ORDER BY createdAt DESC LIMIT 1`, [s.vehicleId]);
            const cutoff = (_a = approved[0]) === null || _a === void 0 ? void 0 : _a.createdAt;
            console.log(`Cutoff (Approved): ${cutoff}`);
            const discountParams = [s.settlementDate, s.vehicleId];
            if (cutoff)
                discountParams.push(cutoff);
            const discountQuery = `
            SELECT COALESCE(SUM(COALESCE(globalDiscount, 0) + COALESCE(discount, 0)), 0) as totalDiscounts
            FROM invoices 
            WHERE DATE(date) = ? 
            AND salesmanId = (SELECT salesmanId FROM vehicles WHERE id = ?)
            AND (type LIKE '%SALE%' AND type NOT LIKE '%RETURN%')
            AND status = 'POSTED'
            ${cutoff ? 'AND createdAt > ?' : ''}
        `;
            console.log('Query:', discountQuery);
            console.log('Params:', discountParams);
            const [res] = yield conn.query(discountQuery, discountParams);
            console.log(`Result: ${res[0].totalDiscounts}`);
        }
        catch (e) {
            console.error(e);
        }
        finally {
            yield conn.end();
        }
    });
}
verifyExactQuery();
