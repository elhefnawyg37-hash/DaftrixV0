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
function checkDebtCollection() {
    return __awaiter(this, void 0, void 0, function* () {
        const pool = (0, promise_1.createPool)(dbConfig);
        const date = new Date().toISOString().split('T')[0];
        const vehicleId = '962c1a83-e2c4-498b-8724-c6d225431461';
        console.log(`Checking debt collection data for ${date}...`);
        try {
            // 1. Check visits table for debtCollected values
            const [visits] = yield pool.query(`
            SELECT id, customerName, visitDate, result, invoiceAmount, paymentCollected, debtCollected, paymentMethod
            FROM vehicle_customer_visits
            WHERE vehicleId = ? AND DATE(visitDate) = ?
        `, [vehicleId, date]);
            console.log('\n=== Visits Today ===');
            visits.forEach((v) => {
                console.log(`Visit: ${v.customerName || 'N/A'}`);
                console.log(`  Result: ${v.result}, Invoice: ${v.invoiceAmount}, Payment: ${v.paymentCollected}, Debt: ${v.debtCollected}`);
            });
            // 2. Check if total collections come from payment receipts instead
            const [receipts] = yield pool.query(`
            SELECT id, partnerId, amount, DATE(date) as date, notes
            FROM payment_receipts
            WHERE DATE(date) = ?
            ORDER BY date DESC
            LIMIT 10
        `, [date]);
            console.log('\n=== Payment Receipts Today ===');
            receipts.forEach((r) => {
                console.log(`Receipt: ${r.amount} - ${r.notes || 'No notes'}`);
            });
            // 3. Check invoices with payments
            const [invoices] = yield pool.query(`
            SELECT id, total, paidAmount, type, paymentMethod
            FROM invoices
            WHERE vehicleId = ? AND DATE(date) = ? AND status = 'POSTED'
        `, [vehicleId, date]);
            console.log('\n=== Invoices Today ===');
            invoices.forEach((i) => {
                console.log(`${i.type}: Total=${i.total}, Paid=${i.paidAmount}, Method=${i.paymentMethod}`);
            });
        }
        catch (e) {
            console.error(e);
        }
        finally {
            yield pool.end();
        }
    });
}
checkDebtCollection();
