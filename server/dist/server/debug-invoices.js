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
function debugInvoices() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield db_1.pool.getConnection();
        try {
            console.log('Last 5 invoices created:');
            const [rows] = yield conn.query(`
            SELECT id, number, type, status, paymentMethod, total, partnerId, partnerName, bankTransfers
            FROM invoices 
            ORDER BY date DESC, id DESC
            LIMIT 5
        `);
            for (const inv of rows) {
                console.log('\n---');
                console.log(`Number: ${inv.number}`);
                console.log(`Type: ${inv.type}`);
                console.log(`Status: ${inv.status}`);
                console.log(`Payment Method: ${inv.paymentMethod}`);
                console.log(`Total: ${inv.total}`);
                console.log(`Partner: ${inv.partnerName}`);
                console.log(`Bank Transfers: ${inv.bankTransfers}`);
            }
        }
        finally {
            conn.release();
            yield db_1.pool.end();
        }
    });
}
debugInvoices().catch(console.error);
