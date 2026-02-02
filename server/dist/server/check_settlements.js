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
        // Get recent settlements
        const [settlements] = yield db_1.pool.query('SELECT id, vehicleId, status, settlementDate, createdAt, approvedAt, totalSales FROM vehicle_settlements ORDER BY createdAt DESC LIMIT 5');
        console.log('=== Recent Settlements ===');
        console.log(JSON.stringify(settlements, null, 2));
        // Get recent visits for the vehicle 9865
        const [visits] = yield db_1.pool.query(`
      SELECT v.id, v.vehicleId, v.visitDate, v.result, v.invoiceAmount, v.paymentCollected, i.paymentMethod
      FROM vehicle_customer_visits v
      LEFT JOIN invoices i ON v.invoiceId = i.id
      ORDER BY v.visitDate DESC
      LIMIT 10
    `);
        console.log('=== Recent Visits ===');
        console.log(JSON.stringify(visits, null, 2));
    }
    catch (e) {
        console.error(e);
    }
    finally {
        db_1.pool.end();
    }
}))();
