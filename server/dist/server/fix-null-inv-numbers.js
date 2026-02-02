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
function fixNullNumbers() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield db_1.pool.getConnection();
        try {
            // Find invoices with null numbers
            const [rows] = yield conn.query(`
            SELECT id, type, date FROM invoices WHERE number IS NULL
        `);
            console.log(`Found ${rows.length} invoices with NULL numbers`);
            for (const inv of rows) {
                const prefixMap = {
                    'INVOICE_SALE': 'INV-',
                    'INVOICE_PURCHASE': 'PUR-',
                    'RETURN_SALE': 'RET-S-',
                    'RETURN_PURCHASE': 'RET-P-',
                    'RECEIPT': 'REC-',
                    'PAYMENT': 'PAY-',
                };
                const prefix = prefixMap[inv.type] || 'TRX-';
                // Find max number
                const [maxRows] = yield conn.query(`
                SELECT number FROM invoices 
                WHERE number LIKE ? 
                AND number IS NOT NULL
                AND number NOT REGEXP '-[a-z0-9]{8}$'
            `, [`${prefix}%`]);
                let maxNum = 0;
                for (const r of maxRows) {
                    const numPart = r.number.substring(prefix.length);
                    if (/^\d+$/.test(numPart)) {
                        const n = parseInt(numPart, 10);
                        if (n > maxNum)
                            maxNum = n;
                    }
                }
                const newNumber = `${prefix}${String(maxNum + 1).padStart(5, '0')}`;
                yield conn.query('UPDATE invoices SET number = ? WHERE id = ?', [newNumber, inv.id]);
                console.log(`  Fixed: ${inv.id} -> ${newNumber}`);
            }
            console.log('Done!');
        }
        finally {
            conn.release();
            yield db_1.pool.end();
        }
    });
}
fixNullNumbers().catch(console.error);
