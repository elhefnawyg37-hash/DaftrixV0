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
dotenv_1.default.config();
const pool = (0, promise_1.createPool)({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
function migrate() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const conn = yield pool.getConnection();
            console.log('Connected to DB');
            // Check if column exists
            const [columns] = yield conn.query("SHOW COLUMNS FROM invoices LIKE 'costCenterId'");
            if (columns.length > 0) {
                console.log('costCenterId column already exists.');
            }
            else {
                console.log('Adding costCenterId column...');
                yield conn.query("ALTER TABLE invoices ADD COLUMN costCenterId VARCHAR(255) NULL");
                console.log('✓ costCenterId column added successfully.');
            }
            conn.release();
        }
        catch (e) {
            console.error('Migration Failed:', e);
        }
        finally {
            yield pool.end();
        }
    });
}
migrate();
