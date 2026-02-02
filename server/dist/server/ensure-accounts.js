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
// All required account codes from erpService.ts
const REQUIRED_ACCOUNTS = [
    { code: '101', name: 'الخزينة الرئيسية', type: 'ASSET' },
    { code: '10201', name: 'البنك الرئيسي', type: 'ASSET' },
    { code: '103', name: 'مخزون البضائع', type: 'ASSET' },
    { code: '104', name: 'العملاء (الذمم المدينة)', type: 'ASSET' },
    { code: '105', name: 'ضريبة القيمة المضافة (مدخلات)', type: 'ASSET' },
    { code: '106', name: 'أوراق قبض (شيكات بالخزنة)', type: 'ASSET' },
    { code: '107', name: 'شيكات تحت التحصيل', type: 'ASSET' },
    { code: '108', name: 'أرصدة مدينة - ضرائب خصم', type: 'ASSET' },
    { code: '201', name: 'الموردين (الذمم الدائنة)', type: 'LIABILITY' },
    { code: '202', name: 'ضريبة القيمة المضافة (مخرجات)', type: 'LIABILITY' },
    { code: '203', name: 'أوراق دفع', type: 'LIABILITY' },
    { code: '205', name: 'ضريبة خصم من المنبع (دائنة)', type: 'LIABILITY' },
    { code: '301', name: 'رأس المال', type: 'EQUITY' },
    { code: '401', name: 'المبيعات', type: 'REVENUE' },
    { code: '402', name: 'خصم مكتسب', type: 'REVENUE' },
    { code: '403', name: 'إيرادات خدمات وشحن', type: 'REVENUE' },
    { code: '501', name: 'تكلفة البضاعة المباعة (COGS)', type: 'EXPENSE' },
    { code: '502', name: 'خصم مسموح به', type: 'EXPENSE' },
    { code: '503', name: 'رواتب وأجور', type: 'EXPENSE' },
    { code: '504', name: 'إيجارات', type: 'EXPENSE' },
];
function ensureRequiredAccounts() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = yield db_1.pool.getConnection();
        try {
            console.log('Checking required accounts...\n');
            let inserted = 0;
            let existing = 0;
            for (const acc of REQUIRED_ACCOUNTS) {
                const [rows] = yield conn.query("SELECT id, code, name FROM accounts WHERE code = ?", [acc.code]);
                if (rows.length === 0) {
                    console.log(`❌ MISSING: ${acc.code} - ${acc.name}`);
                    yield conn.query("INSERT INTO accounts (id, code, name, type, balance, openingBalance) VALUES (?, ?, ?, ?, ?, ?)", [acc.code, acc.code, acc.name, acc.type, 0, 0]);
                    console.log(`   ✅ Inserted!`);
                    inserted++;
                }
                else {
                    console.log(`✅ EXISTS: ${acc.code} - ${rows[0].name}`);
                    existing++;
                }
            }
            console.log(`\n--- Summary ---`);
            console.log(`Existing: ${existing}`);
            console.log(`Inserted: ${inserted}`);
        }
        finally {
            conn.release();
            yield db_1.pool.end();
        }
    });
}
ensureRequiredAccounts().catch(console.error);
