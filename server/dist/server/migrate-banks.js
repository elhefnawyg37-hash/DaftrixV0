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
function runMigration() {
    return __awaiter(this, void 0, void 0, function* () {
        let conn;
        try {
            conn = yield promise_1.default.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
            });
            console.log('Connected to database...');
            // Check if color column already exists
            const [columns] = yield conn.query("SHOW COLUMNS FROM banks LIKE 'color'");
            if (columns.length > 0) {
                console.log('✅ Color column already exists!');
            }
            else {
                console.log('Adding color column to banks table...');
                yield conn.query('ALTER TABLE banks ADD COLUMN color VARCHAR(100)');
                console.log('✅ Migration completed successfully!');
            }
        }
        catch (error) {
            console.error('❌ Migration failed:', error.message);
            throw error;
        }
        finally {
            if (conn)
                yield conn.end();
        }
    });
}
runMigration()
    .then(() => {
    console.log('\n🎉 All done! You can now add banks with color styling.');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n💥 Migration error:', error);
    process.exit(1);
});
