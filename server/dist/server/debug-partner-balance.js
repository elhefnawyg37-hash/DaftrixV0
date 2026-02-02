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
function debugPartnerBalance() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield db_1.pool.getConnection();
        try {
            // Get the partner "اختبار مورد جديد"
            const [partners] = yield conn.query(`
            SELECT id, name, openingBalance, balance, isSupplier, isCustomer
            FROM partners 
            WHERE name LIKE '%اختبار مورد%'
            LIMIT 1
        `);
            if (partners.length === 0) {
                console.log('Partner not found');
                return;
            }
            const partner = partners[0];
            console.log('Partner:');
            console.log(`  Name: ${partner.name}`);
            console.log(`  Opening Balance: ${partner.openingBalance}`);
            console.log(`  Stored Balance: ${partner.balance}`);
            console.log(`  Is Supplier: ${partner.isSupplier}`);
            console.log(`  Is Customer: ${partner.isCustomer}`);
            // Get all invoices for this partner
            console.log('\nInvoices for this partner:');
            const [invoices] = yield conn.query(`
            SELECT number, type, status, total, paymentMethod
            FROM invoices 
            WHERE partnerId = ?
            ORDER BY date DESC
        `, [partner.id]);
            let calculatedBalance = Number(partner.openingBalance || 0);
            for (const inv of invoices) {
                let impact = 0;
                if (inv.status === 'POSTED') {
                    if (inv.type === 'INVOICE_PURCHASE') {
                        impact = -Number(inv.total);
                    }
                    else if (inv.type === 'PAYMENT') {
                        impact = Number(inv.total);
                    }
                    else if (inv.type === 'RETURN_PURCHASE') {
                        impact = Number(inv.total);
                    }
                }
                calculatedBalance += impact;
                console.log(`  ${inv.number || 'NO NUMBER'}: ${inv.type} | Status: ${inv.status} | Total: ${inv.total} | Impact: ${impact > 0 ? '+' : ''}${impact}`);
            }
            console.log(`\nCalculated Balance: ${calculatedBalance}`);
            console.log(`Stored Balance: ${partner.balance}`);
        }
        finally {
            conn.release();
            yield db_1.pool.end();
        }
    });
}
debugPartnerBalance().catch(console.error);
