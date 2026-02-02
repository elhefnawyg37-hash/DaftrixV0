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
function addColumns() {
    return __awaiter(this, void 0, void 0, function* () {
        let conn;
        try {
            conn = yield db_1.pool.getConnection();
            // Try to add the columns
            try {
                yield conn.query('ALTER TABLE partners ADD COLUMN isCustomer BOOLEAN DEFAULT FALSE');
                console.log('✅ Added isCustomer column');
            }
            catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log('ℹ️  isCustomer column already exists');
                }
                else {
                    throw e;
                }
            }
            try {
                yield conn.query('ALTER TABLE partners ADD COLUMN isSupplier BOOLEAN DEFAULT FALSE');
                console.log('✅ Added isSupplier column');
            }
            catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log('ℹ️  isSupplier column already exists');
                }
                else {
                    throw e;
                }
            }
            // Update existing data
            yield conn.query("UPDATE partners SET isCustomer = 1 WHERE type = 'CUSTOMER'");
            yield conn.query("UPDATE partners SET isSupplier = 1 WHERE type = 'SUPPLIER'");
            console.log('✅ Updated existing partner data');
            console.log('🎉 Migration completed!');
        }
        catch (err) {
            console.error('❌ Error:', err);
        }
        finally {
            if (conn)
                conn.release();
            yield db_1.pool.end();
        }
    });
}
addColumns();
