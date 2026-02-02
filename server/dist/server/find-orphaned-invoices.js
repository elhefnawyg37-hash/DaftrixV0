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
function findAllOrphanedInvoices() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield (0, db_1.getConnection)();
        try {
            console.log('🔍 Scanning database for orphaned invoices...\n');
            console.log('An "orphaned invoice" is an invoice with a total > 0 but no line items.\n');
            console.log('='.repeat(80));
            // Find all invoices with no lines but non-zero totals
            const [results] = yield conn.query(`
            SELECT 
                i.id,
                i.date,
                i.type,
                i.partnerName,
                i.total,
                i.status,
                i.posted,
                COUNT(l.id) as line_count
            FROM invoices i
            LEFT JOIN invoice_lines l ON i.id = l.invoiceId
            GROUP BY i.id, i.date, i.type, i.partnerName, i.total, i.status, i.posted
            HAVING line_count = 0 AND ABS(i.total) > 0
            ORDER BY i.date DESC
        `);
            const orphaned = results;
            if (orphaned.length === 0) {
                console.log('\n✅ No orphaned invoices found! Database integrity is good.\n');
                return;
            }
            console.log(`\n⚠️ Found ${orphaned.length} orphaned invoice(s):\n`);
            const typeMap = {
                'SALE_INVOICE': 'فاتورة بيع',
                'PURCHASE_INVOICE': 'فاتورة شراء',
                'SALE_RETURN': 'مرتجع مبيعات',
                'PURCHASE_RETURN': 'مرتجع مشتريات',
                'RECEIPT': 'سند قبض',
                'PAYMENT': 'سند صرف',
            };
            let index = 1;
            for (const inv of orphaned) {
                const date = new Date(inv.date).toLocaleDateString('ar-EG');
                const type = typeMap[inv.type] || inv.type;
                console.log(`${index}. ${type}`);
                console.log(`   ID: ${inv.id}`);
                console.log(`   التاريخ: ${date}`);
                console.log(`   الشريك: ${inv.partnerName || 'غير محدد'}`);
                console.log(`   المبلغ: ${Number(inv.total).toLocaleString('ar-EG')} ج.م`);
                console.log(`   الحالة: ${inv.status}${inv.posted ? ' (مرحل)' : ' (غير مرحل)'}`);
                console.log(`   عدد الأصناف: 0 ⚠️`);
                console.log('');
                index++;
            }
            console.log('='.repeat(80));
            console.log('\n📝 Recommendations:\n');
            console.log('1. For each orphaned invoice, you have two options:');
            console.log('   a) Open it in the UI and manually re-enter the line items');
            console.log('   b) Delete it using the fix-orphaned-invoice.ts script\n');
            console.log('2. To fix a specific invoice, run:');
            console.log('   npx ts-node fix-orphaned-invoice.ts\n');
            console.log('3. The sync prevention logic has been added to prevent future occurrences.\n');
            // Export list to file for reference
            const fs = require('fs');
            const reportPath = './orphaned-invoices-report.json';
            fs.writeFileSync(reportPath, JSON.stringify(orphaned, null, 2));
            console.log(`💾 Full report saved to: ${reportPath}\n`);
        }
        catch (error) {
            console.error('❌ Error:', error);
        }
        finally {
            conn.release();
            process.exit(0);
        }
    });
}
findAllOrphanedInvoices();
