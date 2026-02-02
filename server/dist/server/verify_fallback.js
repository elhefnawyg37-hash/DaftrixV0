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
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
function verifyFallback() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            console.log('--- VERIFYING FALLBACK LOGIC ---');
            // 1. Get Settlement
            const [settlements] = yield db_1.pool.query(`
            SELECT * FROM vehicle_settlements 
            WHERE status = 'SUBMITTED' 
            ORDER BY createdAt DESC LIMIT 1
        `);
            const s = settlements[0];
            console.log(`Settlement ID: ${s.id}`);
            // 2. Get Vehicle & Salesman
            const [vehicles] = yield db_1.pool.query(`SELECT * FROM vehicles WHERE id = ?`, [s.vehicleId]);
            const salesmanId = (_a = vehicles[0]) === null || _a === void 0 ? void 0 : _a.salesmanId;
            console.log(`Vehicle ID: ${s.vehicleId} | Salesman ID: ${salesmanId}`);
            // 3. Date Logic
            const rawDate = s.settlementDate;
            const settDate = rawDate ? new Date(rawDate) : null;
            const egyptDate = settDate ? new Date(settDate.getTime() + 2 * 60 * 60 * 1000) : null;
            const dateStr = egyptDate ? egyptDate.toISOString().slice(0, 10) : null;
            console.log(`Target Date: ${dateStr}`);
            // 4. Query with Fallback
            const [invoices] = yield db_1.pool.query(`
            SELECT id, date, total, discount, globalDiscount, vehicleId, salesmanId 
            FROM invoices 
            WHERE (vehicleId = ? OR (salesmanId = ? AND vehicleId IS NULL))
            AND DATE(date) = ? 
            AND status = 'POSTED'
        `, [s.vehicleId, salesmanId, dateStr]);
            console.log(`Found ${invoices.length} invoices with fallback logic.`);
            let totalDisc = 0;
            invoices.forEach((inv) => {
                const d = Number(inv.discount || 0) + Number(inv.globalDiscount || 0);
                totalDisc += d;
                console.log(`Inv ${inv.id.slice(0, 5)} | Vehicle: ${inv.vehicleId} | Salesman: ${inv.salesmanId} | Disc: ${d}`);
            });
            console.log(`Total Calculated Discount: ${totalDisc}`);
        }
        catch (e) {
            console.error(e);
        }
        finally {
            process.exit();
        }
    });
}
verifyFallback();
