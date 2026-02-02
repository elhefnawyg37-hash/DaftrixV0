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
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vehicleId = '962c1a83-e2c4-498b-8724-c6d225431461';
        // Get ALL visits for this vehicle sorted by date
        console.log('=== All Recent Visits ===');
        const [visits] = yield db_1.pool.query(`
      SELECT v.id, v.visitDate, v.result, v.invoiceAmount, v.paymentCollected, i.paymentMethod, i.id as invoiceId, i.number as invoiceNumber
      FROM vehicle_customer_visits v
      LEFT JOIN invoices i ON v.invoiceId = i.id
      WHERE v.vehicleId = ?
      ORDER BY v.visitDate DESC
      LIMIT 10
    `, [vehicleId]);
        console.log(`Found ${visits.length} visits:`);
        for (const v of visits) {
            console.log(`  ${v.visitDate} | ${v.result} | Amount: ${v.invoiceAmount} | Collected: ${v.paymentCollected} | Invoice: ${v.invoiceNumber || '(none)'}`);
        }
        // Check for duplicate visits (same invoiceId appearing multiple times)
        console.log('\n=== Check for Duplicate Visits (same invoiceId) ===');
        const [dupeVisits] = yield db_1.pool.query(`
      SELECT invoiceId, COUNT(*) as cnt
      FROM vehicle_customer_visits
      WHERE vehicleId = ? AND invoiceId IS NOT NULL
      GROUP BY invoiceId
      HAVING cnt > 1
    `, [vehicleId]);
        console.log(`Found ${dupeVisits.length} duplicate visits:`, dupeVisits);
        // Check all settlements for this vehicle
        console.log('\n=== All Settlements ===');
        const [settlements] = yield db_1.pool.query(`
      SELECT id, settlementDate, status, totalSales, cashCollected, createdAt
      FROM vehicle_settlements
      WHERE vehicleId = ?
      ORDER BY createdAt DESC
      LIMIT 5
    `, [vehicleId]);
        console.log(`Found ${settlements.length} settlements:`);
        for (const s of settlements) {
            console.log(`  ${s.status} | ${s.settlementDate} | Sales: ${s.totalSales} | Collected: ${s.cashCollected}`);
        }
    }
    catch (e) {
        console.error(e);
    }
    finally {
        db_1.pool.end();
    }
}))();
