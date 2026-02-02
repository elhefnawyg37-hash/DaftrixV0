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
// Load env vars
dotenv_1.default.config({ path: path_1.default.join(__dirname, '.env') });
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cloud_erp',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};
function checkData() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Connecting to DB...');
        const conn = yield promise_1.default.createConnection(dbConfig);
        try {
            console.log('\n=== LATEST SETTLEMENTS ===');
            const [rows] = yield conn.query(`
            SELECT id, status, settlementDate, totalSales, approvedAt, updatedAt, createdAt 
            FROM vehicle_settlements 
            ORDER BY createdAt DESC 
            LIMIT 10
        `);
            console.log(JSON.stringify(rows, null, 2));
            if (rows.length > 0) {
                const vehicleId = rows[0].vehicleId; // Use first row's vehicleId
                if (vehicleId) {
                    console.log(`\n=== VISITS FOR VEHICLE ${vehicleId} TODAY ===`);
                    const [visits] = yield conn.query(`
                    SELECT id, visitDate, invoiceAmount, createdAt 
                    FROM vehicle_customer_visits 
                    WHERE vehicleId = ? 
                    ORDER BY visitDate DESC 
                    LIMIT 20
                `, [vehicleId]);
                    console.log(JSON.stringify(visits, null, 2));
                    // Also check operations
                    console.log(`\n=== OPERATIONS FOR VEHICLE ${vehicleId} TODAY ===`);
                    const [ops] = yield conn.query(`
                    SELECT * FROM vehicle_operations WHERE vehicleId = ? ORDER BY date DESC LIMIT 5
                 `, [vehicleId]);
                    console.log(JSON.stringify(ops, null, 2));
                }
            }
        }
        catch (error) {
            console.error('Error:', error);
        }
        finally {
            yield conn.end();
        }
    });
}
checkData();
