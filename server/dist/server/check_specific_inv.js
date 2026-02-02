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
function checkSpecificInvoice() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('--- CHECKING SPECIFIC INVOICE ---');
            // Check finding by ID
            const [rows] = yield db_1.pool.query(`
            SELECT * FROM invoices 
            WHERE id LIKE 'eadc0%'
        `);
            if (rows.length > 0) {
                console.log('Invoice Found:', rows[0]);
            }
            else {
                console.log('Invoice NOT found');
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
checkSpecificInvoice();
