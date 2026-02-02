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
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const query = `
            SELECT id, number, total, date, type, paymentMethod, referenceInvoiceId
            FROM invoices 
            WHERE type = 'RECEIPT' 
            AND partnerId = '59aafc76-4c0a-46f7-93c1-80599c2b9cc1'
            ORDER BY date DESC
        `;
        const [rows] = yield db_1.pool.query(query);
        console.log(JSON.stringify(rows, null, 2));
    }
    catch (e) {
        console.error(e);
    }
    finally {
        db_1.pool.end();
    }
}))();
