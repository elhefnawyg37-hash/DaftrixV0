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
dotenv_1.default.config({ path: path_1.default.join(__dirname, '.env') });
const pool = (0, promise_1.createPool)({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'cloud_erp_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
function debugSettlement() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Find vehicle by plate
            const [vehs] = yield pool.query("SELECT * FROM vehicles WHERE plateNumber LIKE '%6469%'");
            if (vehs.length === 0) {
                console.log("❌ Vehicle 6469 not found");
                return;
            }
            const vehicleId = vehs[0].id;
            console.log(`🔍 Debugging Settlement for Vehicle ID: ${vehicleId}`);
            // 1. Get Latest Approved Settlement
            const [latest] = yield pool.query(`
            SELECT id, settlementDate, COALESCE(approvedAt, updatedAt, createdAt) as approvalTime 
            FROM vehicle_settlements 
            WHERE vehicleId = ? AND status = 'APPROVED' 
            ORDER BY COALESCE(approvedAt, updatedAt, createdAt) DESC LIMIT 1
        `, [vehicleId]);
            const cutoffTime = latest.length > 0 ? latest[0].approvalTime : null;
            console.log(`⏱️ Cutoff Time:`, cutoffTime);
            // 2. Fetch Visits since Yesterday
            console.log('\n📥 ALL Visits for Vehicle (Last 2 Days):');
            const [allVisits] = yield pool.query(`
            SELECT v.id, v.visitDate, v.result, v.invoiceId, v.paymentCollected, v.invoiceAmount, 
                   i.paymentMethod, i.total, i.discount, i.globalDiscount, i.taxAmount, i.whtAmount, i.shippingFee
            FROM vehicle_customer_visits v
            LEFT JOIN invoices i ON v.invoiceId = i.id
            WHERE v.vehicleId = ? 
            AND v.visitDate >= '2026-01-29 00:00:00'
            ORDER BY v.visitDate DESC
        `, [vehicleId]);
            console.log(JSON.stringify(allVisits, null, 2));
            // 3. Search for 255 in any column
            console.log('\n🔍 Searching for "255" in invoices...');
            const possible255 = allVisits.filter((v) => Number(v.discount) === 255 ||
                Number(v.globalDiscount) === 255 ||
                Number(v.taxAmount) === 255 ||
                Number(v.whtAmount) === 255 ||
                Number(v.shippingFee) === 255);
            if (possible255.length > 0)
                console.log("FOUND 255 in columns:", possible255);
            else
                console.log("Not found in invoice columns.");
            // 4. Line Item check
            const invoiceIds = allVisits.map((v) => v.invoiceId).filter((id) => id);
            if (invoiceIds.length > 0) {
                console.log('\n📦 Line Items:');
                const [items] = yield pool.query(`
                SELECT invoiceId, productId, quantity, price, discount 
                FROM invoice_lines 
                WHERE invoiceId IN (?)
            `, [invoiceIds]);
                console.table(items);
                const totalItemDiscount = items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
                console.log(`\n💰 Total Line Item Discount: ${totalItemDiscount}`);
            }
            // 5. Search for settlement with 255
            const [settlementsWith255] = yield pool.query(`
            SELECT * FROM vehicle_settlements WHERE totalDiscounts BETWEEN 250 AND 260
        `);
            console.log('\n🕵️ Settlements with ~255 discount:');
            console.table(settlementsWith255);
            // 6. Inspect Today's unapproved settlements
            const [todays] = yield pool.query(`
             SELECT * FROM vehicle_settlements 
             WHERE vehicleId = ? AND date(createdAt) = CURDATE()
        `, [vehicleId]);
            console.log('\n📅 Today\'s Settlements:');
            console.table(todays);
        }
        catch (error) {
            console.error('❌ Error:', error);
        }
        finally {
            yield pool.end();
        }
    });
}
debugSettlement();
