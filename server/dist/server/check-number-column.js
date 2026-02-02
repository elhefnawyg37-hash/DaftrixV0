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
function check() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield db_1.pool.getConnection();
        try {
            // Check for VAN invoices specifically
            const [vanInvoices] = yield conn.query(`
            SELECT id, number, date, partnerName, total, notes 
            FROM invoices 
            WHERE notes LIKE '%بيع متنقل%' OR number LIKE 'VAN-%'
            ORDER BY date DESC
            LIMIT 10
        `);
            console.log('Van Sale Invoices:');
            console.log(vanInvoices);
            // Check most recent invoices
            const [recent] = yield conn.query(`
            SELECT id, number, type, date, total, notes 
            FROM invoices 
            ORDER BY date DESC
            LIMIT 5
        `);
            console.log('\nMost Recent Invoices:');
            console.log(recent);
        }
        catch (err) {
            console.error('Error:', err);
        }
        finally {
            conn.release();
            process.exit(0);
        }
    });
}
check();
