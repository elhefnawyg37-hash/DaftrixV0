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
function listAllInvoices() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('--- LISTING ALL RECENT INVOICES ---');
            const [invoices] = yield db_1.pool.query(`
            SELECT id, vehicleId, date, total, discount, status 
            FROM invoices 
            ORDER BY createdAt DESC 
            LIMIT 5
        `);
            invoices.forEach((inv) => {
                console.log(`Inv ${inv.id.slice(0, 5)} | Vehicle: ${inv.vehicleId} | Date: ${inv.date} | Total: ${inv.total}`);
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
listAllInvoices();
