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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promise_1 = require("mysql2/promise");
const dotenv_1 = __importDefault(require("dotenv"));
// Load .env from server directory
dotenv_1.default.config({ path: path_1.default.join(__dirname, '.env') });
function runMigration() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Connecting to database...');
        const pool = (0, promise_1.createPool)({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 1,
            multipleStatements: true // Enable multiple statements
        });
        try {
            const sqlPath = path_1.default.join(__dirname, 'migrations', 'fix_decimal_precision.sql');
            const sql = fs_1.default.readFileSync(sqlPath, 'utf8');
            console.log('Executing migration script:', sqlPath);
            // Execute the SQL script
            const [results] = yield pool.query(sql);
            console.log('Migration executed successfully!');
            console.log('Results:', results);
        }
        catch (error) {
            console.error('Migration failed:', error);
        }
        finally {
            yield pool.end();
        }
    });
}
runMigration();
