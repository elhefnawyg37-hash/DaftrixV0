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
function debugSettlement() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        console.log('🔍 Starting Diagnostic...');
        const PLATE_NUMBER = 'م ط ف 9865';
        const TARGET_DATE = '2026-01-28';
        try {
            // 1. Get Vehicle
            const [vehicles] = yield db_1.pool.query('SELECT * FROM vehicles WHERE plateNumber = ?', [PLATE_NUMBER]);
            if (vehicles.length === 0) {
                console.log('❌ Vehicle not found!');
                process.exit(1);
            }
            const vehicle = vehicles[0];
            console.log(`✅ Found Vehicle: ${vehicle.plateNumber} (ID: ${vehicle.id})`);
            console.log(`   Salesman: ${vehicle.salesmanId}`);
            // 2. Get Settlement
            const [settlements] = yield db_1.pool.query(`
            SELECT * FROM vehicle_settlements 
            WHERE vehicleId = ? AND settlementDate = ?
        `, [vehicle.id, TARGET_DATE]);
            if (settlements.length === 0) {
                console.log('❌ No settlement found for this date.');
            }
            else {
                const s = settlements[0];
                console.log(`✅ Found Settlement: ${s.id}`);
                console.log(`   Status: ${s.status}`);
                console.log(`   Created At: ${s.createdAt}`);
                console.log(`   Stored Discounts: ${s.totalDiscounts}`);
            }
            const settlementCreatedAt = (_a = settlements[0]) === null || _a === void 0 ? void 0 : _a.createdAt;
            // 3. Get Invoices (Strict)
            console.log('\n--- Checking Invoices (ALL for that day) ---');
            const [invoices] = yield db_1.pool.query(`
            SELECT id, number, date, total, discount, globalDiscount, paymentMethod, createdAt, vehicleId 
            FROM invoices 
            WHERE (vehicleId = ? OR (salesmanId = ? AND vehicleId IS NULL))
            AND DATE(date) = ?
        `, [vehicle.id, vehicle.salesmanId, TARGET_DATE]);
            console.log(`Found ${invoices.length} invoices.`);
            let calcDisc = 0;
            let calcBank = 0;
            let futureCount = 0;
            invoices.forEach((inv) => {
                const disc = Number(inv.discount || 0) + Number(inv.globalDiscount || 0);
                let timeStatus = '✅ OK';
                if (settlementCreatedAt && new Date(inv.createdAt) > new Date(settlementCreatedAt)) {
                    timeStatus = '⚠️ FUTURE (Late Sync)';
                    futureCount++;
                }
                console.log(`[${inv.number}] Time: ${inv.createdAt.toISOString()} | Disc: ${disc} | Bank: ${inv.paymentMethod === 'BANK' ? 'YES' : 'NO'} | ${timeStatus}`);
                calcDisc += disc;
                if (inv.paymentMethod === 'BANK')
                    calcBank += Number(inv.total);
            });
            console.log(`\n📊 Manual Calculation Result:`);
            console.log(`   Total Discounts: ${calcDisc}`);
            console.log(`   Total Bank: ${calcBank}`);
            console.log(`   Late Invoices: ${futureCount}`);
        }
        catch (e) {
            console.error(e);
        }
        finally {
            process.exit();
        }
    });
}
debugSettlement();
