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
        console.log('🔍 Starting cleanup of duplicate receipts...');
        // Find pairs: RCV (Server) and RECEIPT (Client) matching Partner, Amount, Date
        const query = `
            SELECT 
                r1.id as ServerId, r1.number as ServerNumber, r1.paymentMethod as ServerMethod,
                r2.id as ClientId, r2.number as ClientNumber, r2.paymentMethod as ClientMethod,
                r1.total, r1.date
            FROM invoices r1
            JOIN invoices r2 ON r1.partnerId = r2.partnerId 
                AND ABS(r1.total - r2.total) < 0.01 
                AND DATE(r1.date) = DATE(r2.date)
            WHERE r1.type = 'RECEIPT' AND r2.type = 'RECEIPT'
            AND r1.number LIKE 'RCV-%'
            AND (r2.number LIKE 'RECEIPT_%' OR r2.id LIKE 'RECEIPT_%') -- ID is mostly RECEIPT_..., Number is usually NULL
            AND r1.id != r2.id
        `;
        const [rows] = yield db_1.pool.query(query);
        console.log(`📋 Found ${rows.length} duplicate pairs.`);
        for (const row of rows) {
            console.log(`🛠️ Fixing pair: Server ${row.ServerNumber} (${row.ServerMethod}) vs Client ${row.ClientId} (${row.ClientMethod}) - Amount ${row.total}`);
            // 1. Update Server Receipt to match Client Method (if Client is BANK)
            if (row.ClientMethod === 'BANK' && row.ServerMethod !== 'BANK') {
                yield db_1.pool.query('UPDATE invoices SET paymentMethod = "BANK" WHERE id = ?', [row.ServerId]);
                console.log(`   ✅ Updated Server Receipt to BANK`);
            }
            // 2. Delete Client Receipt
            yield db_1.pool.query('DELETE FROM invoice_lines WHERE invoiceId = ?', [row.ClientId]); // Just in case
            yield db_1.pool.query('DELETE FROM invoices WHERE id = ?', [row.ClientId]);
            console.log(`   🗑️ Deleted Client Receipt (Duplicate)`);
        }
        console.log('✨ Cleanup complete.');
    }
    catch (e) {
        console.error(e);
    }
    finally {
        db_1.pool.end();
    }
}))();
