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
const bcryptjs_1 = __importDefault(require("bcryptjs"));
/**
 * Migration Script: Hash Existing Plain-Text Passwords
 * This script updates all existing user passwords to use bcrypt hashing
 */
function migratePasswords() {
    return __awaiter(this, void 0, void 0, function* () {
        let conn;
        try {
            conn = yield db_1.pool.getConnection();
            console.log('🔐 Starting password migration...');
            // Get all users with plain-text passwords (not starting with $2)
            const [users] = yield conn.query("SELECT id, username, password FROM users WHERE password NOT LIKE '$2%'");
            console.log(`📋 Found ${users.length} users with plain-text passwords`);
            if (users.length === 0) {
                console.log('✅ All passwords are already hashed. No migration needed.');
                return;
            }
            let migrated = 0;
            for (const user of users) {
                try {
                    // Hash the password
                    const salt = yield bcryptjs_1.default.genSalt(10);
                    const hashedPassword = yield bcryptjs_1.default.hash(user.password, salt);
                    // Update the user
                    yield conn.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
                    console.log(`✓ Migrated password for user: ${user.username}`);
                    migrated++;
                }
                catch (err) {
                    console.error(`✗ Failed to migrate password for user ${user.username}:`, err);
                }
            }
            console.log(`\n✅ Password migration complete! Migrated ${migrated}/${users.length} users`);
            console.log('💡 Users can now login with their original passwords, but they will be stored securely.');
        }
        catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
        finally {
            if (conn)
                conn.release();
            process.exit(0);
        }
    });
}
// Run migration
migratePasswords();
