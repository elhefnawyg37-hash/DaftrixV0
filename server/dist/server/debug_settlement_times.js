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
function debugSettlementTimes() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('--- DEBUGGING SETTLEMENT TIMES ---');
            // 1. Get the SUBMITTED settlement
            const [settlements] = yield db_1.pool.query(`
            SELECT * FROM vehicle_settlements 
            WHERE status = 'SUBMITTED' 
            ORDER BY createdAt DESC LIMIT 1
        `);
            const s = settlements[0];
            console.log(`Settlement ID: ${s.id}`);
            console.log(`Settlement CreatedAt: ${s.createdAt}`);
            console.log(`Settlement UpdatedAt: ${s.updatedAt}`);
            console.log(`Settlement Date: ${s.settlementDate}`);
            // 2. Get Invoices for that day
            const [invoices] = yield db_1.pool.query(`
            SELECT id, date, createdAt, total, discount, globalDiscount, vehicleId, salesmanId 
            FROM invoices 
            WHERE (vehicleId = ? OR (salesmanId = (SELECT salesmanId FROM vehicles WHERE id = ?) AND vehicleId IS NULL))
            AND DATE(date) = DATE(?)
            AND status = 'POSTED'
            ORDER BY createdAt ASC
        `, [s.vehicleId, s.vehicleId, s.settlementDate]);
            console.log(`Found ${invoices.length} invoices on this day:`);
            invoices.forEach((inv) => {
                const disc = Number(inv.discount) + Number(inv.globalDiscount);
                console.log(`Inv ${inv.id.slice(0, 5)} | CreatedAt: ${inv.createdAt.toISOString()} | Disc: ${disc} | Total: ${inv.total}`);
                // Check relations
                if (inv.createdAt < s.createdAt)
                    console.log('   -> BEFORE Settlement CreatedAt');
                else
                    console.log('   -> AFTER Settlement CreatedAt');
                if (inv.createdAt < s.updatedAt)
                    console.log('   -> BEFORE Settlement UpdatedAt');
                else
                    console.log('   -> AFTER Settlement UpdatedAt');
            });
        }
        catch (e) {
            console.error(e);
        }
        finally {
            process.exit();
        }
    });
}
debugSettlementTimes();
