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
 * Migration to add missing columns to stock_permits and stock_permit_items tables
 */
function migrateStockPermitTables() {
    return __awaiter(this, void 0, void 0, function* () {
        let conn;
        try {
            conn = yield db_1.pool.getConnection();
            console.log('Starting stock permit tables migration...');
            // Add createdAt column to stock_permits if it doesn't exist
            yield conn.query(`
            ALTER TABLE stock_permits 
            ADD COLUMN IF NOT EXISTS createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        `).catch((err) => {
                console.log('createdAt column may already exist:', err.message);
            });
            // Add productName column to stock_permit_items if it doesn't exist
            yield conn.query(`
            ALTER TABLE stock_permit_items 
            ADD COLUMN IF NOT EXISTS productName VARCHAR(255)
        `).catch((err) => {
                console.log('productName column may already exist:', err.message);
            });
            console.log('✅ Stock permit tables migration completed successfully');
        }
        catch (error) {
            console.error('❌ Error during migration:', error);
            throw error;
        }
        finally {
            if (conn)
                conn.release();
            yield db_1.pool.end();
        }
    });
}
// Run migration
migrateStockPermitTables()
    .then(() => {
    console.log('Migration finished');
    process.exit(0);
})
    .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
