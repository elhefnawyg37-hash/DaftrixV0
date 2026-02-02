"use strict";
/**
 * Script to reset database - removes all data but keeps structure and essential seeds
 * ⚠️ WARNING: This will delete ALL your data!
 */
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
const resetDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('⚠️  WARNING: This will DELETE ALL DATA from the database!');
        console.log('📋 The following will be deleted:');
        console.log('   - All products');
        console.log('   - All invoices');
        console.log('   - All partners (customers/suppliers)');
        console.log('   - All journal entries');
        console.log('   - All cheques');
        console.log('   - All stock permits');
        console.log('   - All warehouse stocks');
        console.log('\n✓ The following will be KEPT:');
        console.log('   - Chart of accounts');
        console.log('   - System configuration');
        console.log('   - Database structure (tables)');
        console.log('   - Warehouses, Categories, Price Lists');
        console.log('\n🔄 Starting database reset...\n');
        const conn = yield db_1.pool.getConnection();
        // Disable foreign key checks temporarily
        yield conn.query('SET FOREIGN_KEY_CHECKS = 0');
        // Delete transactional data (in correct order to respect foreign keys)
        console.log('🗑️  Deleting invoices and related data...');
        yield conn.query('DELETE FROM journal_lines');
        yield conn.query('DELETE FROM journal_entries');
        yield conn.query('DELETE FROM invoice_lines');
        yield conn.query('DELETE FROM invoices');
        console.log('   ✓ Invoices cleared');
        console.log('🗑️  Deleting cheques...');
        yield conn.query('DELETE FROM cheques');
        console.log('   ✓ Cheques cleared');
        console.log('🗑️  Deleting stock-related data...');
        yield conn.query('DELETE FROM stock_permit_items');
        yield conn.query('DELETE FROM stock_permits');
        yield conn.query('DELETE FROM stock_taking_items');
        yield conn.query('DELETE FROM stock_taking_sessions');
        yield conn.query('DELETE FROM product_stocks');
        console.log('   ✓ Stock data cleared');
        console.log('🗑️  Deleting products and prices...');
        yield conn.query('DELETE FROM product_prices');
        yield conn.query('DELETE FROM products');
        console.log('   ✓ Products cleared');
        console.log('🗑️  Deleting partners...');
        yield conn.query('DELETE FROM partners');
        console.log('   ✓ Partners cleared');
        console.log('🗑️  Deleting audit logs...');
        yield conn.query('DELETE FROM audit_logs');
        console.log('   ✓ Audit logs cleared');
        // Reset account balances to opening balances
        console.log('🔄 Resetting account balances to opening balances...');
        yield conn.query('UPDATE accounts SET balance = openingBalance');
        console.log('   ✓ Account balances reset');
        // Re-enable foreign key checks
        yield conn.query('SET FOREIGN_KEY_CHECKS = 1');
        conn.release();
        console.log('\n✅ Database reset complete!');
        console.log('\n📝 Next steps:');
        console.log('   1. Refresh your browser (Ctrl+Shift+R)');
        console.log('   2. Create products via Product Master (كارت الصنف)');
        console.log('   3. Create partners via Partners Master');
        console.log('   4. Start creating invoices\n');
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ Error resetting database:', error);
        process.exit(1);
    }
});
resetDatabase();
