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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function checkEntry() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield promise_1.default.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'admin123',
            database: 'cloud_erp'
        });
        try {
            const id = '3c35f43a-9afd-46d4-a40c-c356e4d9d5e3';
            const [entries] = yield conn.query('SELECT * FROM journal_entries WHERE id = ?', [id]);
            console.log('Entries:', entries);
            const [lines] = yield conn.query('SELECT * FROM journal_lines WHERE journalId = ?', [id]);
            console.log('Lines:', lines);
        }
        catch (e) {
            console.error(e);
        }
        finally {
            conn.end();
        }
    });
}
checkEntry();
