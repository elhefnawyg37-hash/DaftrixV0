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
dotenv_1.default.config();
function debug() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield promise_1.default.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cloud_erp',
        });
        console.log('=== Searching for Payable/Supplier accounts ===');
        const [payables] = yield conn.query("SELECT id, code, name, type FROM accounts WHERE name LIKE '%مورد%' OR name LIKE '%دائن%' OR name LIKE '%payable%' OR code LIKE '2%' LIMIT 10");
        console.log(payables);
        console.log('\n=== All LIABILITY accounts ===');
        const [liabilities] = yield conn.query("SELECT id, code, name FROM accounts WHERE type = 'LIABILITY' LIMIT 10");
        console.log(liabilities);
        yield conn.end();
    });
}
debug().catch(console.error);
