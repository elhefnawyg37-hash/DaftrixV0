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
function debug200Case() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const conn = yield promise_1.default.createConnection(dbConfig);
        try {
            console.log('--- Debugging 200 Sales Case ---');
            // 1. Find the 200 Sales Settlement (Submitted)
            const [rows] = yield conn.query(`
            SELECT id, vehicleId, settlementDate, createdAt, totalSales, totalDiscounts, status
            FROM vehicle_settlements 
            WHERE totalSales = 200
            ORDER BY createdAt DESC LIMIT 1
        `);
            const s200 = rows[0];
            if (!s200) {
                console.log('Settlement 200 not found');
                return;
            }
            console.log(`Settlement 200: ID=${s200.id} CreatedAt=${s200.createdAt.toISOString()} Status=${s200.status}`);
            // 2. Find the Previous Cutoff (Approved Settlement)
            const [prevRows] = yield conn.query(`
            SELECT id, createdAt 
            FROM vehicle_settlements 
            WHERE vehicleId = ? 
            AND settlementDate = ?
            AND status = 'APPROVED'
            AND createdAt < ?
            ORDER BY createdAt DESC LIMIT 1
        `, [s200.vehicleId, s200.settlementDate, s200.createdAt]);
            const cutoff = (_a = prevRows[0]) === null || _a === void 0 ? void 0 : _a.createdAt;
            console.log(`Cutoff (Approved): ${cutoff ? cutoff.toISOString() : 'NONE'}`);
            // 3. Find Visits in this Range (Source of Sales)
            // Range: (Cutoff, s200.createdAt]
            console.log('\n--- Visits in Range ---');
            const vQuery = `
            SELECT id, visitDate, createdAt, invoiceAmount, result, invoiceId
            FROM vehicle_customer_visits
            WHERE vehicleId = ? AND DATE(visitDate) = ?
            ${cutoff ? 'AND createdAt > ?' : ''}
            AND createdAt <= ?
        `;
            const vParams = [s200.vehicleId, s200.settlementDate];
            if (cutoff)
                vParams.push(cutoff);
            vParams.push(s200.createdAt);
            const [visits] = yield conn.query(vQuery, vParams);
            console.table(visits.map((v) => ({
                id: v.id.slice(0, 5),
                createdAt: v.createdAt.toISOString(),
                amount: v.invoiceAmount,
                invoiceId: v.invoiceId
            })));
            // 4. Find Invoices in this Range (Source of Discounts)
            // Range: (Cutoff, s200.createdAt]
            console.log('\n--- Invoices in Range ---');
            // We look for invoices LINKED to the visits found above, to compare timestamps
            const invoiceIds = visits.map((v) => v.invoiceId).filter((id) => id);
            if (invoiceIds.length > 0) {
                const placeholders = invoiceIds.map(() => '?').join(',');
                const [invoices] = yield conn.query(`
                SELECT id, date, createdAt, discount, globalDiscount, total, status
                FROM invoices 
                WHERE id IN (${placeholders})
            `, invoiceIds);
                for (const inv of invoices) {
                    const inRange = !cutoff || (new Date(inv.createdAt) > new Date(cutoff));
                    console.log(`Inv: ${inv.id.slice(0, 5)} | CreatedAt: ${inv.createdAt.toISOString()} | Status: ${inv.status} | Disc: ${Number(inv.discount) + Number(inv.globalDiscount)} | >Cutoff? ${inRange ? 'YES' : 'NO'}`);
                    if (!inRange) {
                        console.log('⚠️ CRITICAL: Invoice CreatedAt is OLDER than Cutoff! It will be excluded from discounts.');
                    }
                }
            }
            else {
                console.log('No invoices linked to these visits.');
            }
        }
        catch (e) {
            console.error(e);
        }
        finally {
            yield conn.end();
        }
    });
}
debug200Case();
