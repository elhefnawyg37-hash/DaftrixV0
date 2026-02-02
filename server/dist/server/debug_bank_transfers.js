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
function debugBankTransfersMismatch() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('Searching for vehicle 9865...');
            const [vehicles] = yield db_1.pool.query(`SELECT id, plateNumber, salesmanId FROM vehicles WHERE plateNumber LIKE '%9865%'`);
            if (vehicles.length === 0) {
                console.log('Vehicle not found');
                return;
            }
            const vehicle = vehicles[0];
            console.log(`Found Vehicle: ${vehicle.plateNumber} (ID: ${vehicle.id})`);
            console.log(`Salesman ID: ${vehicle.salesmanId}`);
            const date = '2026-01-30'; // From user context
            // 1. Query by Salesman (Logic in calculateRefinedSettlementStats)
            console.log('\n--- Query 1: By Salesman ID ---');
            const [salesmanInvoices] = yield db_1.pool.query(`
            SELECT id, total, paymentMethod, vehicleId, type
            FROM invoices 
            WHERE DATE(date) = ?
            AND salesmanId = ?
            AND paymentMethod = 'BANK'
            AND status = 'POSTED'
        `, [date, vehicle.salesmanId]);
            console.table(salesmanInvoices);
            const sumSalesman = salesmanInvoices.reduce((acc, curr) => acc + Number(curr.total), 0);
            console.log('Total by Salesman:', sumSalesman);
            // 2. Query by Vehicle Visits (Logic in getDailyReport / Visits)
            console.log('\n--- Query 2: By Vehicle Visits ---');
            const [visitInvoices] = yield db_1.pool.query(`
            SELECT i.id, i.total, i.paymentMethod, v.vehicleId, i.type
            FROM vehicle_customer_visits v
            JOIN invoices i ON v.invoiceId = i.id
            WHERE v.vehicleId = ?
            AND DATE(v.visitDate) = ?
            AND i.paymentMethod = 'BANK'
        `, [vehicle.id, date]);
            console.table(visitInvoices);
            const sumVisits = visitInvoices.reduce((acc, curr) => acc + Number(curr.total), 0);
            console.log('Total by Visits:', sumVisits);
        }
        catch (err) {
            console.error('Error:', err);
        }
        finally {
            db_1.pool.end();
        }
    });
}
debugBankTransfersMismatch();
