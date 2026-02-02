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
function verifyDailyReport() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const vehicleId = '7';
            const [vehicles] = yield db_1.pool.query(`SELECT id, plateNumber FROM vehicles WHERE plateNumber LIKE '%6469%'`);
            if (vehicles.length === 0) {
                console.log('Vehicle not found');
                return;
            }
            const targetVehicleId = vehicles[0].id;
            console.log(`Found Vehicle: ${vehicles[0].plateNumber} (ID: ${targetVehicleId})`);
            // 1. Fetch ALL recent visits for this vehicle to see their dates
            console.log('\n--- Recent Visits ---');
            const [recentVisits] = yield db_1.pool.query(`
            SELECT v.id, v.visitDate, v.invoiceId, i.total, i.discount, i.globalDiscount
            FROM vehicle_customer_visits v
            LEFT JOIN invoices i ON v.invoiceId = i.id
            WHERE v.vehicleId = ?
            ORDER BY v.visitDate DESC
            LIMIT 10
        `, [targetVehicleId]);
            console.table(recentVisits);
            // 2. Check for existing settlement for today
            const today = new Date().toISOString().slice(0, 10);
            console.log(`\n--- Settlement for ${today} ---`);
            const [settlement] = yield db_1.pool.query(`
            SELECT * FROM vehicle_settlements 
            WHERE vehicleId = ? AND settlementDate = ?
        `, [targetVehicleId, today]);
            if (settlement.length > 0) {
                console.log('Found Settlement:', settlement[0]);
            }
            else {
                console.log('No settlement found for today.');
            }
        }
        catch (err) {
            console.error('Error:', err);
        }
        finally {
            db_1.pool.end();
        }
    });
}
verifyDailyReport();
