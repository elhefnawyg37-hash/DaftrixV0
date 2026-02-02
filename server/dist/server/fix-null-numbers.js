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
function fixNullInvoiceNumbers() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield db_1.pool.getConnection();
        try {
            console.log('🔧 Fixing invoices with NULL numbers...\n');
            // Find all invoices with NULL numbers
            const [rows] = yield conn.query(`
            SELECT id, type, date, partnerId 
            FROM invoices 
            WHERE number IS NULL OR number = ''
            ORDER BY type, date
        `);
            if (rows.length === 0) {
                console.log('✅ No invoices with NULL numbers found!');
                return;
            }
            console.log(`Found ${rows.length} invoices with NULL numbers:\n`);
            yield conn.beginTransaction();
            for (const inv of rows) {
                // Determine prefix based on type
                const prefixMap = {
                    'INVOICE_SALE': 'INV-',
                    'INVOICE_PURCHASE': 'PUR-',
                    'RETURN_SALE': 'RET-S-',
                    'RETURN_PURCHASE': 'RET-P-',
                    'RECEIPT': 'REC-',
                    'PAYMENT': 'PAY-',
                };
                const prefix = prefixMap[inv.type] || 'TRX-';
                // Find max number for this prefix
                const [maxRows] = yield conn.query(`
                SELECT number FROM invoices 
                WHERE number LIKE ? 
                AND number IS NOT NULL
                ORDER BY number DESC
                LIMIT 1
            `, [`${prefix}%`]);
                let maxNum = 0;
                if (maxRows.length > 0) {
                    const numPart = maxRows[0].number.substring(prefix.length);
                    if (/^\d+$/.test(numPart)) {
                        maxNum = parseInt(numPart, 10);
                    }
                }
                const newNumber = `${prefix}${String(maxNum + 1).padStart(5, '0')}`;
                yield conn.query('UPDATE invoices SET number = ? WHERE id = ?', [newNumber, inv.id]);
                console.log(`  ✅ ${inv.id} (${inv.type}) → ${newNumber}`);
            }
            yield conn.commit();
            console.log('\n🎉 Done!');
        }
        catch (error) {
            yield conn.rollback();
            console.error('❌ Error:', error);
            throw error;
        }
        finally {
            conn.release();
            yield db_1.pool.end();
        }
    });
}
fixNullInvoiceNumbers().catch(console.error);
