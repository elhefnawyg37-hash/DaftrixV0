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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '.env') });
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cloud_erp',
};
function migrate() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const conn = yield promise_1.default.createConnection(dbConfig);
        try {
            console.log('🔄 Starting Migration...');
            // 1. Add Columns
            console.log('📦 Adding columns...');
            yield conn.query(`ALTER TABLE vehicle_settlements ADD COLUMN IF NOT EXISTS totalDiscounts DECIMAL(15,2) DEFAULT 0`);
            yield conn.query(`ALTER TABLE vehicle_settlements ADD COLUMN IF NOT EXISTS totalBankTransfers DECIMAL(15,2) DEFAULT 0`);
            // 2. Backfill Data
            console.log('💾 Backfilling data for existing settlements...');
            // Get all settlements
            const [settlements] = yield conn.query(`SELECT id, vehicleId, settlementDate, createdAt FROM vehicle_settlements ORDER BY createdAt ASC`);
            for (const sett of settlements) {
                // Find previous settlement cutoff
                const [prev] = yield conn.query(`
                SELECT createdAt FROM vehicle_settlements 
                WHERE vehicleId = ? AND createdAt < ? 
                ORDER BY createdAt DESC LIMIT 1
            `, [sett.vehicleId, sett.createdAt]);
                const start = (_a = prev[0]) === null || _a === void 0 ? void 0 : _a.createdAt;
                const end = sett.createdAt;
                // Calculate Discounts
                let dQuery = `SELECT COALESCE(SUM(COALESCE(discount, 0)), 0) as val FROM invoices WHERE DATE(date) = ? AND createdAt <= ?`;
                const dParams = [sett.settlementDate, end];
                if (start) {
                    dQuery += ` AND createdAt > ?`;
                    dParams.push(start);
                }
                // Note: Using the CURRENT strict logic to backfill. 
                // This might change history slightly if it was previously wrong, but it "locks" it to the correct logic now.
                const [dRes] = yield conn.query(dQuery, dParams);
                const disc = dRes[0].val;
                // Calculate Bank Transfers
                let bQuery = `SELECT COALESCE(SUM(total), 0) as val FROM invoices WHERE paymentMethod = 'BANK' AND status = 'POSTED' AND DATE(date) = ? AND createdAt <= ?`;
                const bParams = [sett.settlementDate, end];
                if (start) {
                    bQuery += ` AND createdAt > ?`;
                    bParams.push(start);
                }
                const [bRes] = yield conn.query(bQuery, bParams);
                const bank = bRes[0].val;
                // Update
                yield conn.query(`UPDATE vehicle_settlements SET totalDiscounts = ?, totalBankTransfers = ? WHERE id = ?`, [disc, bank, sett.id]);
                process.stdout.write('.');
            }
            console.log('\n✅ Migration Complete!');
        }
        catch (e) {
            console.error(e);
        }
        finally {
            yield conn.end();
        }
    });
}
migrate();
