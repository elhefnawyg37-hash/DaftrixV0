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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const checkBanks = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, db_1.initDB)();
    const conn = yield (0, db_1.getConnection)();
    try {
        console.log('--- Checking Bank <-> GL Account Connections ---');
        const [banks] = yield conn.query('SELECT * FROM banks');
        const [accounts] = yield conn.query('SELECT * FROM accounts');
        if (banks.length === 0) {
            console.log('No banks found.');
            return;
        }
        for (const bank of banks) {
            console.log(`\nBank: ${bank.name} (ID: ${bank.id})`);
            console.log(`  - Bank Balance: ${Number(bank.balance).toLocaleString()}`);
            console.log(`  - Linked Account ID: ${bank.accountId || 'NONE'}`);
            if (bank.accountId) {
                const account = accounts.find((a) => a.id === bank.accountId);
                if (account) {
                    console.log(`  - Linked Account: ${account.name} (${account.code})`);
                    console.log(`  - Account Opening Balance: ${Number(account.openingBalance).toLocaleString()}`);
                    console.log(`  - Account Current Balance: ${Number(account.balance).toLocaleString()}`);
                    const bankBal = Number(bank.balance);
                    const accOpening = Number(account.openingBalance);
                    if (Math.abs(bankBal - accOpening) > 0.01) {
                        console.log(`  ⚠️ MISMATCH: Bank Balance (${bankBal}) != Account Opening Balance (${accOpening})`);
                    }
                    else {
                        console.log(`  ✅ Balances Match`);
                    }
                }
                else {
                    console.log(`  ❌ ERROR: Linked Account ID found but Account record missing!`);
                }
            }
            else {
                console.log(`  ⚠️ WARNING: Not linked to any GL Account`);
            }
        }
    }
    catch (error) {
        console.error('Error checking banks:', error);
    }
    finally {
        conn.release();
        process.exit();
    }
});
checkBanks();
