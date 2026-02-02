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
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
// Mock params based on the user scenario
const vehicleId = '962c1a83-e2c4-498b-8724-c6d225431461'; // Plate 9865
const date = '2026-01-30'; // The date of the settlement in the screenshot (or Today 2026-01-30 if context allows)
function testDailyReport() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            console.log(`Testing getDailyReport for Vehicle: ${vehicleId} on Date: ${date}`);
            const conn = yield db_1.pool.getConnection();
            // 1. Check for existing settlement
            const [existing] = yield conn.query('SELECT * FROM vehicle_settlements WHERE vehicleId = ? AND settlementDate = ?', [vehicleId, date]);
            console.log('Existing Settlement:', existing.length > 0 ? existing[0] : 'None');
            // 2. Run logic similar to getDailyReport
            // There is complex logic about "cutoff" time.
            // Let's see if calculateRefinedSettlementStats returns anything.
            try {
                // Need to mock the function call context or just run the query logic directly?
                // Since calculateRefinedSettlementStats is not exported or complex to import with context, 
                // I'll try to run the queries it likely runs.
                // Is there ANY APPROVED settlement before this date?
                const [lastSettlement] = yield conn.query(`
                SELECT * FROM vehicle_settlements 
                WHERE vehicleId = ? 
                AND status = 'APPROVED'
                AND settlementDate <= ?
                ORDER BY settlementDate DESC, createdAt DESC LIMIT 1
            `, [vehicleId, date]);
                console.log('Last Approved Settlement:', lastSettlement[0] || 'None');
                const cutoff = ((_a = lastSettlement[0]) === null || _a === void 0 ? void 0 : _a.approvedAt) || null;
                console.log('Cutoff Time:', cutoff);
                // Check Visits
                const [visits] = yield conn.query(`
                SELECT count(*) as count FROM vehicle_customer_visits 
                WHERE vehicleId = ? AND DATE(visitDate) = ?
            `, [vehicleId, date]);
                console.log('Visits Count:', visits[0].count);
                if (visits[0].count === 0 && existing.length === 0) {
                    console.log('RESULT: likely returning NULL because no visits and no existing settlement.');
                }
                else {
                    console.log('RESULT: Should return data.');
                }
            }
            catch (innerErr) {
                console.error('Inner Logic Error:', innerErr);
            }
        }
        catch (err) {
            console.error('Test Error:', err);
        }
        finally {
            db_1.pool.end();
        }
    });
}
testDailyReport();
