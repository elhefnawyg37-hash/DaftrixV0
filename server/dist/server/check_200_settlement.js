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
function checkSettlement() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield promise_1.default.createConnection(dbConfig);
        try {
            console.log('--- Checking Latest 200-Sales Settlement ---');
            const [rows] = yield conn.query(`
            SELECT id, vehicleId, settlementDate, totalSales, totalDiscounts, status, createdAt 
            FROM vehicle_settlements 
            WHERE totalSales = 200 
            ORDER BY createdAt DESC LIMIT 1
        `);
            console.log(rows[0] || 'No settlement found with 200 sales');
        }
        catch (e) {
            console.error(e);
        }
        finally {
            yield conn.end();
        }
    });
}
checkSettlement();
