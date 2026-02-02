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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Load env vars
dotenv_1.default.config();
const runMigration = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Starting migration 039...');
    const connection = yield promise_1.default.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT) || 3306,
    });
    try {
        const sqlPath = path_1.default.join(__dirname, 'migrations', '039_link_employee_salesman.sql');
        const sql = fs_1.default.readFileSync(sqlPath, 'utf8');
        // Split by semicolon to handle multiple statements if necessary
        // But simple generic way is usually one big exec if separate statements supported, 
        // or split manually. mysql2 creates simple queries usually one by one.
        // However, the migration file uses standard syntax. 
        // Let's use `query` or `execute` with multiple statements enabled or split them.
        // For safety, let's split by semicolon but respect valid SQL. 
        // Actually, allowing multiple statements in connection config is easier.
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            yield connection.query(statement);
        }
        console.log('Migration 039 completed successfully.');
    }
    catch (error) {
        console.error('Migration failed:', error);
    }
    finally {
        yield connection.end();
    }
});
runMigration();
