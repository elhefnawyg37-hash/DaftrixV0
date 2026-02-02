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
function addBankTransfersColumn() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield db_1.pool.getConnection();
        try {
            console.log('Checking invoices table for bankTransfers column...');
            // Check if column exists
            const [columns] = yield conn.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'invoices' 
            AND COLUMN_NAME = 'bankTransfers'
        `);
            if (columns.length === 0) {
                console.log('❌ bankTransfers column missing! Adding...');
                yield conn.query(`
                ALTER TABLE invoices 
                ADD COLUMN bankTransfers JSON DEFAULT NULL
            `);
                console.log('✅ bankTransfers column added!');
            }
            else {
                console.log('✅ bankTransfers column already exists!');
            }
        }
        finally {
            conn.release();
            yield db_1.pool.end();
        }
    });
}
addBankTransfersColumn().catch(console.error);
