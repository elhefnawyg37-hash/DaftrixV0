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
function checkData() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const conn = yield promise_1.default.createConnection(dbConfig);
            // Check Invoices syncedAt
            console.log('--- Invoices syncedAt ---');
            const [invRows] = yield conn.query('SELECT id, date, syncedAt FROM invoices ORDER BY id DESC LIMIT 5');
            console.table(invRows);
            // Check vehicle_customer_visits columns
            console.log('--- vehicle_customer_visits Columns ---');
            const [visitCols] = yield conn.query('SHOW COLUMNS FROM vehicle_customer_visits');
            console.log(visitCols.map((r) => r.Field));
            // Check vehicle_returns columns
            console.log('--- vehicle_returns Columns ---');
            const [returnCols] = yield conn.query('SHOW COLUMNS FROM vehicle_returns');
            console.log(returnCols.map((r) => r.Field));
            yield conn.end();
        }
        catch (e) {
            console.error(e);
        }
    });
}
checkData();
