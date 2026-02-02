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
function debugDateMismatch() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('--- DEBUGGING DATE MISMATCH ---');
            // 1. Get the latest SUBMITTED settlement
            const [settlements] = yield db_1.pool.query(`
            SELECT * FROM vehicle_settlements 
            WHERE status = 'SUBMITTED' 
            ORDER BY createdAt DESC LIMIT 1
        `);
            if (!settlements.length) {
                console.log('No SUBMITTED settlements found.');
                return;
            }
            const s = settlements[0];
            console.log('Settlement Found:', {
                id: s.id,
                settlementDate: s.settlementDate,
                vehicleId: s.vehicleId,
                totalDiscounts: s.totalDiscounts
            });
            // 2. Simulate the Logic in Controller
            const rawDate = s.settlementDate;
            const settDate = rawDate ? new Date(rawDate) : null;
            const egyptDate = settDate ? new Date(settDate.getTime() + 2 * 60 * 60 * 1000) : null;
            const dateStr = egyptDate ? egyptDate.toISOString().slice(0, 10) : null;
            console.log('Date Parsing Logic:', {
                rawDate,
                settDate: settDate === null || settDate === void 0 ? void 0 : settDate.toISOString(),
                egyptDate: egyptDate === null || egyptDate === void 0 ? void 0 : egyptDate.toISOString(),
                dateStr
            });
            // 3. Query Invoices using this dateStr
            const [invoices] = yield db_1.pool.query(`
            SELECT id, date, total, discount, globalDiscount, paymentMethod, status 
            FROM invoices 
            WHERE vehicleId = ? 
            AND DATE(date) = ? 
            AND status = 'POSTED'
        `, [s.vehicleId, dateStr]);
            console.log(`Found ${invoices.length} invoices matching DATE(date) = ${dateStr}`);
            let calcDisc = 0;
            invoices.forEach((inv) => {
                const d = Number(inv.discount || 0) + Number(inv.globalDiscount || 0);
                calcDisc += d;
                console.log(`Inv ${inv.id} | Date: ${inv.date} | Disc: ${d}`);
            });
            console.log(`Calculated Discount: ${calcDisc}`);
            console.log(`Stored Discount: ${s.totalDiscounts}`);
            if (calcDisc !== Number(s.totalDiscounts)) {
                console.log('MISMATCH DETECTED!');
            }
            else {
                console.log('Values Match.');
            }
        }
        catch (e) {
            console.error(e);
        }
        finally {
            process.exit();
        }
    });
}
debugDateMismatch();
