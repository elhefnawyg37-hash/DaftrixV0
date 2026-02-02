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
function checkDeep() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const conn = yield promise_1.default.createConnection(dbConfig);
            // 1. Check vehicle_settlements Schema
            console.log('--- vehicle_settlements Columns ---');
            const [cols] = yield conn.query('SHOW COLUMNS FROM vehicle_settlements');
            const colNames = cols.map((r) => r.Field);
            console.log(colNames);
            console.log('Has totalDiscounts?', colNames.includes('totalDiscounts'));
            // 2. Check 5 recent invoices to see their createdAt values
            console.log('\n--- Recent Invoices (createdAt vs syncedAt) ---');
            const [invs] = yield conn.query('SELECT id, date, syncedAt, createdAt FROM invoices ORDER BY messageId DESC LIMIT 5'); // messageId usually implies sync order if auto-inc? actually just ID or createdAt
            // Better: sort by internal ID or something arbitrary if UUID
            // Let's just look at 5
            const [invs2] = yield conn.query('SELECT id, date, syncedAt, createdAt FROM invoices LIMIT 5');
            console.table(invs2);
            yield conn.end();
        }
        catch (e) {
            console.error(e);
        }
    });
}
checkDeep();
