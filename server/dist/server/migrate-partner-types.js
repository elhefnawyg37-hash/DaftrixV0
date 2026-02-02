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
/**
 * Migration: Add partner type flags for flexible customer/supplier designation
 * This allows partners to be both customers AND suppliers simultaneously
 */
function migratePartnerTypes() {
    return __awaiter(this, void 0, void 0, function* () {
        let conn;
        try {
            conn = yield db_1.pool.getConnection();
            console.log('🔄 Starting partner type migration...');
            // Check if columns already exist
            const [columns] = yield conn.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'partners' 
            AND COLUMN_NAME IN ('isCustomer', 'isSupplier')
        `);
            if (columns.length === 0) {
                // Add new boolean columns for flexible partner typing
                console.log('  📝 Adding isCustomer and isSupplier columns...');
                yield conn.query(`
                ALTER TABLE partners 
                ADD COLUMN isCustomer BOOLEAN DEFAULT FALSE,
                ADD COLUMN isSupplier BOOLEAN DEFAULT FALSE
            `);
                console.log('  ✅ Columns added successfully');
            }
            else {
                console.log('  ℹ️  Columns already exist, skipping creation');
            }
            // Migrate existing data based on current type field
            console.log('  📝 Migrating existing partner data...');
            const [updateCustomers] = yield conn.query(`
            UPDATE partners SET isCustomer = 1 WHERE type = 'CUSTOMER'
        `);
            console.log(`  ✅ Updated ${updateCustomers.affectedRows} customers`);
            const [updateSuppliers] = yield conn.query(`
            UPDATE partners SET isSupplier = 1 WHERE type = 'SUPPLIER'
        `);
            console.log(`  ✅ Updated ${updateSuppliers.affectedRows} suppliers`);
            // Verify migration
            const [rows] = yield conn.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN isCustomer = 1 THEN 1 ELSE 0 END) as customers,
                SUM(CASE WHEN isSupplier = 1 THEN 1 ELSE 0 END) as suppliers,
                SUM(CASE WHEN isCustomer = 1 AND isSupplier = 1 THEN 1 ELSE 0 END) as both
            FROM partners
        `);
            const stats = rows[0];
            console.log('\n📊 Migration Statistics:');
            console.log(`  Total partners: ${stats.total}`);
            console.log(`  Customers: ${stats.customers}`);
            console.log(`  Suppliers: ${stats.suppliers}`);
            console.log(`  Both: ${stats.both}`);
            console.log('\n✅ Migration completed successfully!');
        }
        catch (err) {
            console.error('❌ Error during migration:', err);
            throw err;
        }
        finally {
            if (conn)
                conn.release();
            yield db_1.pool.end();
        }
    });
}
// Run migration
migratePartnerTypes()
    .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
})
    .catch((err) => {
    console.error('\n💥 Migration failed:', err);
    process.exit(1);
});
