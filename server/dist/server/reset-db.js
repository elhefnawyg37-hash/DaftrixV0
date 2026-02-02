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
function resetDB() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield (0, db_1.getConnection)();
        try {
            console.log("Dropping tables...");
            yield conn.query('SET FOREIGN_KEY_CHECKS = 0');
            yield conn.query('DROP TABLE IF EXISTS journal_lines');
            yield conn.query('DROP TABLE IF EXISTS journal_entries');
            yield conn.query('DROP TABLE IF EXISTS invoice_lines');
            yield conn.query('DROP TABLE IF EXISTS invoices');
            yield conn.query('DROP TABLE IF EXISTS accounts');
            yield conn.query('DROP TABLE IF EXISTS partners');
            yield conn.query('DROP TABLE IF EXISTS products');
            yield conn.query('SET FOREIGN_KEY_CHECKS = 1');
            console.log("Tables dropped.");
        }
        catch (err) {
            console.error("Error resetting DB:", err);
        }
        finally {
            conn.release();
            process.exit();
        }
    });
}
resetDB();
