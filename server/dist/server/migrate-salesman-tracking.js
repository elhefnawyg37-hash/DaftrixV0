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
exports.migrateSalesmanTracking = migrateSalesmanTracking;
const db_1 = require("./db");
function migrateSalesmanTracking() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield db_1.pool.getConnection();
        try {
            console.log('🔄 Starting salesman tracking migration...');
            // Add salesmanId to invoices
            console.log('Adding salesmanId to invoices table...');
            yield conn.query(`
            ALTER TABLE invoices 
            ADD COLUMN IF NOT EXISTS salesmanId VARCHAR(36)
        `).catch(() => {
                console.log('⚠️ salesmanId column may already exist in invoices');
            });
            // Add index for invoices.salesmanId
            yield conn.query(`
            CREATE INDEX idx_invoices_salesmanId ON invoices(salesmanId)
        `).catch(() => {
                console.log('⚠️ Index idx_invoices_salesmanId may already exist');
            });
            // Add salesmanId to journal_entries
            console.log('Adding salesmanId to journal_entries table...');
            yield conn.query(`
            ALTER TABLE journal_entries 
            ADD COLUMN IF NOT EXISTS salesmanId VARCHAR(36)
        `).catch(() => {
                console.log('⚠️ salesmanId column may already exist in journal_entries');
            });
            // Add index for journal_entries.salesmanId
            yield conn.query(`
            CREATE INDEX idx_journal_entries_salesmanId ON journal_entries(salesmanId)
        `).catch(() => {
                console.log('⚠️ Index idx_journal_entries_salesmanId may already exist');
            });
            // Add type to salesmen table
            console.log('Adding type field to salesmen table...');
            yield conn.query(`
            ALTER TABLE salesmen 
            ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'SALES'
        `).catch(() => {
                console.log('⚠️ type column may already exist in salesmen');
            });
            // Add index for salesmen.type
            yield conn.query(`
            CREATE INDEX idx_salesmen_type ON salesmen(type)
        `).catch(() => {
                console.log('⚠️ Index idx_salesmen_type may already exist');
            });
            // Populate salesmanId in existing invoices from partner's salesmanId
            console.log('Populating salesmanId in existing invoices from partners...');
            try {
                // Check if partners table has salesmanId column
                const [columns] = yield conn.query(`
                SHOW COLUMNS FROM partners LIKE 'salesmanId'
            `);
                if (columns && columns.length > 0) {
                    yield conn.query(`
                    UPDATE invoices i
                    JOIN partners p ON i.partnerId = p.id
                    SET i.salesmanId = p.salesmanId
                    WHERE i.salesmanId IS NULL AND p.salesmanId IS NOT NULL
                `);
                    console.log('✅ Successfully populated salesmanId from partners');
                }
                else {
                    console.log('ℹ️ partners.salesmanId column not found, skipping population');
                }
            }
            catch (error) {
                console.log('⚠️ Could not populate salesmanId from partners:', error.message);
            }
            console.log('✅ Salesman tracking migration completed successfully!');
            // Show statistics
            const [invoiceStats] = yield conn.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN salesmanId IS NOT NULL THEN 1 ELSE 0 END) as with_salesman,
                SUM(CASE WHEN salesmanId IS NULL THEN 1 ELSE 0 END) as without_salesman
            FROM invoices
        `);
            console.log('\n📊 Invoice Statistics:');
            console.log(`   Total invoices: ${invoiceStats[0].total}`);
            console.log(`   With salesman: ${invoiceStats[0].with_salesman}`);
            console.log(`   Without salesman: ${invoiceStats[0].without_salesman}`);
        }
        catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
        finally {
            conn.release();
        }
    });
}
// Run migration if called directly
if (require.main === module) {
    migrateSalesmanTracking()
        .then(() => {
        console.log('Migration completed, exiting...');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
}
