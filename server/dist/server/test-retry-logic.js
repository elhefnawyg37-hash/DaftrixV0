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
function testRetryLogic() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Testing getConnection with retry logic...');
        try {
            const start = Date.now();
            const conn = yield (0, db_1.getConnection)();
            const end = Date.now();
            console.log(`✅ Successfully connected in ${end - start}ms`);
            // Simple query to verify connection is usable
            const [rows] = yield conn.query('SELECT 1 as val');
            console.log('✅ Query result:', rows);
            conn.release();
            console.log('✅ Connection released');
        }
        catch (error) {
            console.error('❌ Failed to connect:', error);
        }
    });
}
testRetryLogic();
