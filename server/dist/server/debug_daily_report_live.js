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
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'cloud_erp_db',
};
function checkDailyStats() {
    return __awaiter(this, void 0, void 0, function* () {
        const pool = (0, promise_1.createPool)(dbConfig);
        const date = new Date().toISOString().split('T')[0];
        console.log(`Checking stats for date: ${date}`);
        try {
            // 1. Get all vehicles
            const [vehicles] = yield pool.query('SELECT id, plateNumber, salesmanId FROM vehicles');
            console.log(`Found ${vehicles.length} vehicles.`);
            for (const v of vehicles) {
                console.log(`\n--- Vehicle: ${v.plateNumber} (${v.salesmanName}) [${v.id}] ---`);
                // 2. Count visits
                const [visits] = yield pool.query(`
                SELECT COUNT(*) as count, 
                       SUM(CASE WHEN result = 'SALE' THEN 1 ELSE 0 END) as sales,
                       COALESCE(SUM(invoiceAmount), 0) as totalAmount,
                       COALESCE(SUM(paymentCollected), 0) as cashCollected
                FROM vehicle_customer_visits
                WHERE vehicleId = ? AND DATE(visitDate) = ?
            `, [v.id, date]);
                console.log(`Visits: ${visits[0].count}, Sales: ${visits[0].sales}`);
                console.log(`Total Amount: ${visits[0].totalAmount}, Cash Collected: ${visits[0].cashCollected}`);
                // 3. Check for Settlements
                const [settlements] = yield pool.query(`
                SELECT id, status, totalSales, totalCashSales, totalCreditSales, notes, createdBy
                FROM vehicle_settlements
                WHERE vehicleId = ? AND DATE(settlementDate) = ?
            `, [v.id, date]);
                if (settlements.length > 0) {
                    console.log('Existing Settlements:', settlements);
                }
                else {
                    console.log('No settlements found for today.');
                }
            }
        }
        catch (e) {
            console.error(e);
        }
        finally {
            yield pool.end();
        }
    });
}
checkDailyStats();
