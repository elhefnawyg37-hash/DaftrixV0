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
function checkAuditTable() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield promise_1.default.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: 'admin123',
            database: 'cloud_erp'
        });
        try {
            console.log('Checking audit_logs table...\n');
            // Check if table exists
            const [tables] = yield conn.query("SHOW TABLES LIKE 'audit_logs'");
            console.log('Table exists:', tables.length > 0);
            if (tables.length > 0) {
                // Show table structure
                const [structure] = yield conn.query('DESCRIBE audit_logs');
                console.log('\nTable structure:');
                console.table(structure);
                // Count records
                const [count] = yield conn.query('SELECT COUNT(*) as total FROM audit_logs');
                console.log('\nTotal records:', count[0].total);
                // Try to insert a test record
                console.log('\n🧪 Testing audit log insertion...');
                const testId = 'test-' + Date.now();
                yield conn.query(`INSERT INTO audit_logs (id, date, user, module, action, description, details)
                 VALUES (?, NOW(), ?, ?, ?, ?, ?)`, [testId, 'TestUser', 'TEST', 'TEST_ACTION', 'Testing audit log', 'Test details']);
                console.log('✅ Test insertion successful!');
                // Verify insertion
                const [inserted] = yield conn.query('SELECT * FROM audit_logs WHERE id = ?', [testId]);
                console.log('\nInserted record:');
                console.table(inserted);
                // Clean up test record
                yield conn.query('DELETE FROM audit_logs WHERE id = ?', [testId]);
                console.log('\n🧹 Test record cleaned up');
            }
        }
        catch (error) {
            console.error('❌ Error:', error);
        }
        finally {
            yield conn.end();
        }
    });
}
checkAuditTable().catch(console.error);
