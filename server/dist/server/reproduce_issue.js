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
const uuid_1 = require("uuid");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '.env') });
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cloud_erp',
};
function runTest() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Connecting to DB...');
        const conn = yield promise_1.default.createConnection(dbConfig);
        const vehicleId = 'TEST_VEH_LATE';
        const salesmanId = 'TEST_SAL_LATE';
        const date = new Date().toISOString().slice(0, 10);
        // Times
        const t0930 = `${date} 09:30:00`; // Transaction Time
        const t1000 = `${date} 10:00:00`; // Settlement A Cutoff
        const t1010 = `${date} 10:10:00`; // Sync Time
        const t1200 = `${date} 12:00:00`; // Settlement B Cutoff
        try {
            yield conn.query('DELETE FROM vehicle_settlements WHERE vehicleId = ?', [vehicleId]);
            yield conn.query('DELETE FROM invoices WHERE partnerName = ?', ['TEST_LATE_SYNC']);
            yield conn.query('DELETE FROM vehicles WHERE id = ?', [vehicleId]);
            // Dummy Vehicle
            yield conn.query(`INSERT INTO vehicles (id, plateNumber, name, status) VALUES (?, 'TEST-LATE', 'Late Test', 'ACTIVE')`, [vehicleId]);
            // 1. Settlement A (Approved @ 10:00) -> Should NOT have the invoice
            yield conn.query(`
            INSERT INTO vehicle_settlements (id, vehicleId, settlementDate, status, createdAt, totalSales)
            VALUES (?, ?, ?, 'APPROVED', ?, 0)
        `, [(0, uuid_1.v4)(), vehicleId, date, t1000]);
            // 2. Late Sync Invoice (Date 09:30, Synced 10:10)
            // Note: syncedAt is inserted as string here
            yield conn.query(`
            INSERT INTO invoices (id, type, date, total, discount, status, partnerName, salesmanId, paymentMethod, syncedAt)
            VALUES (?, 'INVOICE_SALE', ?, 100, 50, 'POSTED', 'TEST_LATE_SYNC', ?, 'CASH', ?)
        `, [(0, uuid_1.v4)(), t0930, salesmanId, t1010]);
            // 3. Verify Settlement A Logic
            // Should use COALESCE(syncedAt, date) <= 10:00
            // syncedAt(10:10) <= 10:00 is FALSE.
            const [resA] = yield conn.query(`
            SELECT COALESCE(SUM(COALESCE(discount, 0)), 0) as val
            FROM invoices 
            WHERE DATE(date) = ? AND partnerName = 'TEST_LATE_SYNC'
            AND COALESCE(syncedAt, date) <= ?
        `, [date, t1000]);
            console.log(`Settlement A Discount (Expected 0): ${resA[0].val}`);
            // 4. Verify Settlement B (Open @ 12:00) Logic
            // Should use COALESCE(syncedAt, date) > 10:00 AND <= 12:00
            // 10:10 > 10:00 is TRUE.
            const [resB] = yield conn.query(`
            SELECT COALESCE(SUM(COALESCE(discount, 0)), 0) as val
            FROM invoices 
            WHERE DATE(date) = ? AND partnerName = 'TEST_LATE_SYNC'
            AND COALESCE(syncedAt, date) > ?
            AND COALESCE(syncedAt, date) <= ?
        `, [date, t1000, t1200]);
            console.log(`Settlement B Discount (Expected 50): ${resB[0].val}`);
            if (resA[0].val == 0 && resB[0].val == 50) {
                console.log('✅ PASS: Late sync invoice correctly routed to next settlement.');
            }
            else {
                console.log('❌ FAIL: Logic incorrect.');
            }
        }
        catch (e) {
            console.error(e);
        }
        finally {
            yield conn.query('DELETE FROM vehicle_settlements WHERE vehicleId = ?', [vehicleId]);
            yield conn.query('DELETE FROM invoices WHERE partnerName = ?', ['TEST_LATE_SYNC']);
            yield conn.query('DELETE FROM vehicles WHERE id = ?', [vehicleId]);
            yield conn.end();
        }
    });
}
runTest();
