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
const promise_1 = require("mysql2/promise");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'cloud_erp_db',
};
function fixData() {
    return __awaiter(this, void 0, void 0, function* () {
        const pool = (0, promise_1.createPool)(dbConfig);
        console.log('Fixing settlement data...');
        try {
            const id = 'dc118823-e10b-4d17-aa21-34c8e8a0007d';
            // 1. Verify current state
            const [rows] = yield pool.query('SELECT totalCreditSales, totalCashSales, totalSales FROM vehicle_settlements WHERE id = ?', [id]);
            console.log('Before Fix:', rows[0]);
            // 2. Update
            // Assuming 825 Total, 600 Cash => 225 Credit.
            yield pool.query(`
            UPDATE vehicle_settlements 
            SET totalCreditSales = 225, 
                totalCashSales = 600,
                totalSales = 825,
                cashCollected = 600
            WHERE id = ?
        `, [id]);
            // 3. Verify
            const [rows2] = yield pool.query('SELECT totalCreditSales, totalCashSales, totalSales FROM vehicle_settlements WHERE id = ?', [id]);
            console.log('After Fix:', rows2[0]);
        }
        catch (e) {
            console.error(e);
        }
        finally {
            yield pool.end();
        }
    });
}
fixData();
