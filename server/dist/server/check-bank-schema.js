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
function checkBankSchema() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield (0, db_1.getConnection)();
        try {
            // Get table structure
            const [columns] = yield conn.query('DESCRIBE banks');
            console.log('=== Banks Table Structure ===\n');
            columns.forEach((col) => {
                console.log(`${col.Field.padEnd(20)} ${col.Type.padEnd(20)} ${col.Null} ${col.Key} ${col.Default || ''}`);
            });
        }
        catch (error) {
            console.error('Error:', error);
        }
        finally {
            conn.release();
            process.exit(0);
        }
    });
}
checkBankSchema();
