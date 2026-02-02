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
function checkMultiSettlements() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('--- CHECKING MULTIPLE SETTLEMENTS ---');
            // Logic to get the vehicleId from the latest settlement
            const [latest] = yield db_1.pool.query(`SELECT vehicleId, settlementDate FROM vehicle_settlements ORDER BY createdAt DESC LIMIT 1`);
            if (!latest.length)
                return;
            const vid = latest[0].vehicleId;
            const date = latest[0].settlementDate;
            console.log(`Vehicle: ${vid} | Date: ${date}`);
            const [settlements] = yield db_1.pool.query(`
            SELECT id, createdAt, updatedAt, totalSales, totalDiscounts, status 
            FROM vehicle_settlements 
            WHERE vehicleId = ? 
            AND settlementDate = ?
            ORDER BY createdAt ASC
        `, [vid, date]);
            console.log(`Found ${settlements.length} settlements on this day:`);
            settlements.forEach((s) => {
                console.log(`ID ${s.id.slice(0, 5)}... | CreatedAt: ${s.createdAt.toISOString()} | Status: ${s.status} | Sales: ${s.totalSales} | Disc: ${s.totalDiscounts}`);
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
checkMultiSettlements();
