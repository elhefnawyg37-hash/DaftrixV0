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
exports.seedAccounts = seedAccounts;
const db_1 = require("./db");
const seedData_1 = require("./seedData");
function seedAccounts() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield db_1.pool.getConnection();
        try {
            console.log('🌱 Starting account seeding...');
            // Check current account count
            const [countResult] = yield conn.query('SELECT COUNT(*) as count FROM accounts');
            const currentCount = countResult[0].count;
            console.log(`📊 Current accounts in database: ${currentCount}`);
            if (currentCount >= seedData_1.INITIAL_ACCOUNTS.length) {
                console.log('✅ Accounts already seeded. Skipping.');
                return;
            }
            console.log(`📝 Inserting ${seedData_1.INITIAL_ACCOUNTS.length} accounts...`);
            let inserted = 0;
            let skipped = 0;
            for (const account of seedData_1.INITIAL_ACCOUNTS) {
                try {
                    yield conn.query(`INSERT INTO accounts (id, code, name, type, balance, openingBalance) 
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE name = name`, [account.id, account.code, account.name, account.type, account.balance, account.openingBalance]);
                    inserted++;
                    console.log(`  ✓ ${account.code} - ${account.name}`);
                }
                catch (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        skipped++;
                    }
                    else {
                        console.error(`  ✗ Error inserting ${account.code}:`, err.message);
                    }
                }
            }
            console.log('\n📈 Summary:');
            console.log(`  ✅ Inserted: ${inserted}`);
            console.log(`  ⏭️  Skipped (already exists): ${skipped}`);
            // Verify account 401 exists
            const [result] = yield conn.query('SELECT * FROM accounts WHERE code = ?', ['401']);
            if (result.length > 0) {
                console.log('\n✅ Account 401 (المبيعات) verified!');
                console.log(`   ID: ${result[0].id}, Name: ${result[0].name}, Type: ${result[0].type}`);
            }
            else {
                console.log('\n❌ WARNING: Account 401 still missing!');
            }
            // Show final count
            const [finalCount] = yield conn.query('SELECT COUNT(*) as count FROM accounts');
            console.log(`\n📊 Total accounts in database: ${finalCount[0].count}`);
        }
        catch (error) {
            console.error('❌ Seeding failed:', error);
            throw error;
        }
        finally {
            conn.release();
        }
    });
}
// Run if called directly
if (require.main === module) {
    seedAccounts()
        .then(() => {
        console.log('\n🎉 Account seeding complete!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('\n💥 Seeding error:', error);
        process.exit(1);
    });
}
