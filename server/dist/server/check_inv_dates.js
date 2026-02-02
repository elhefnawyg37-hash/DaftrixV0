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
function checkInvoiceDates() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('--- CHECKING INVOICE DATES ---');
            // Get the latest SUBMITTED settlement again to be sure
            const [settlements] = yield db_1.pool.query(`
            SELECT * FROM vehicle_settlements 
            WHERE status = 'SUBMITTED' 
            ORDER BY createdAt DESC LIMIT 1
        `);
            if (!settlements.length) {
                console.log('No SUBMITTED settlement found');
                return;
            }
            const s = settlements[0];
            console.log(`Using Vehicle ID: ${s.vehicleId}`);
            const [invoices] = yield db_1.pool.query(`
            SELECT id, date, createdAt, total, discount, status 
            FROM invoices 
            WHERE vehicleId = ? 
            ORDER BY createdAt DESC 
            LIMIT 10
        `, [s.vehicleId]);
            console.log(`Found ${invoices.length} invoices`);
            invoices.forEach((inv) => {
                console.log(`Inv ${inv.id.slice(0, 5)} | Date (DB): ${inv.date} (${typeof inv.date}) | CreatedAt: ${inv.createdAt} | Status: ${inv.status}`);
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
checkInvoiceDates();
