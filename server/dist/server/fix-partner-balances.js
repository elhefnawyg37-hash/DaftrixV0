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
function fixPartnerBalances() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🔄 Starting Partner Balance Recalculation...');
        try {
            const [partners] = yield db_1.pool.query('SELECT id, name, openingBalance FROM partners');
            console.log(`Found ${partners.length} partners.`);
            for (const partner of partners) {
                // Get all posted transactions for this partner
                const [transactions] = yield db_1.pool.query(`SELECT type, total, whtAmount FROM invoices WHERE partnerId = ? AND status = 'POSTED'`, [partner.id]);
                let balance = Number(partner.openingBalance || 0);
                for (const tx of transactions) {
                    const amount = Number(tx.total || 0);
                    // Sales use net amount (total - wht) for impact? 
                    // In PartnerStatement: case TransactionType.INVOICE_SALE: return netAmount;
                    // But usually balance tracks the full amount owed? 
                    // If WHT is deducted, the customer owes less? 
                    // Let's stick to PartnerStatement logic:
                    // const whtAmount = t.whtAmount || 0;
                    // const netAmount = amount - whtAmount;
                    // Actually, if I issue an invoice for 100, and there is 5 WHT.
                    // The customer pays 95. The 5 is tax credit.
                    // So the customer owes 100? Or 95?
                    // PartnerStatement says: return netAmount (95).
                    // So let's follow that.
                    const wht = Number(tx.whtAmount || 0);
                    const net = amount - wht;
                    switch (tx.type) {
                        case 'INVOICE_SALE':
                            balance += net;
                            break;
                        case 'INVOICE_PURCHASE':
                            balance -= amount;
                            break;
                        case 'RETURN_SALE':
                            balance -= amount;
                            break;
                        case 'RETURN_PURCHASE':
                            balance += amount;
                            break;
                        case 'PAYMENT': // We pay supplier
                            balance += amount;
                            break;
                        case 'RECEIPT': // Customer pays us
                            balance -= amount;
                            break;
                        case 'DISCOUNT_ALLOWED':
                            balance -= amount;
                            break;
                        case 'DISCOUNT_EARNED':
                            balance += amount;
                            break;
                        // Cheque handling is complex, but for now let's assume simple transactions
                    }
                }
                // Update partner balance
                yield db_1.pool.query('UPDATE partners SET balance = ? WHERE id = ?', [balance, partner.id]);
            }
            console.log('✅ Successfully recalculated all partner balances.');
        }
        catch (error) {
            console.error('❌ Error recalculating balances:', error);
        }
        finally {
            process.exit();
        }
    });
}
fixPartnerBalances();
