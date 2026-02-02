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
const db_1 = require("./db");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const sql = fs_1.default.readFileSync(path_1.default.join(__dirname, 'migrations/038_add_user_preferences.sql'), 'utf8');
            console.log('Running migration: 038_add_user_preferences.sql');
            yield db_1.pool.query(sql);
            console.log('Migration successful');
        }
        catch (error) {
            console.error('Migration failed:', error);
        }
        finally {
            process.exit();
        }
    });
}
run();
