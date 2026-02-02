"use strict";
/**
 * Invoice Cascade Delete Utility
 *
 * This module handles the complete deletion of an invoice along with all its
 * related documents:
 * - سند القبض (RECEIPT) - Cash receipts created with the invoice
 * - سند الصرف (PAYMENT) - Payment vouchers created with the invoice
 * - Journal Entries - Accounting entries for the invoice and its payments
 * - Account Transactions - Partner account movements
 * - Bank Transactions - Bank transfer records
 *
 * All deletions are performed within a single transaction for atomicity.
 */
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
exports.findRelatedDocuments = findRelatedDocuments;
exports.deleteInvoiceWithCascade = deleteInvoiceWithCascade;
exports.previewCascadeDelete = previewCascadeDelete;
const uuid_1 = require("uuid");
/**
 * Find all related documents linked to an invoice
 */
function findRelatedDocuments(conn, invoiceId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        // Use COLLATE to handle potential collation mismatches in MariaDB
        const collate = 'COLLATE utf8mb4_unicode_ci';
        // Find linked RECEIPT documents
        const [receipts] = yield conn.query(`
        SELECT id, number, total, partnerId, partnerName, type FROM invoices 
        WHERE type = 'RECEIPT' AND (
            sourceInvoiceId ${collate} = ? ${collate}
            OR referenceInvoiceId ${collate} = ? ${collate}
            OR notes ${collate} LIKE ? ${collate}
        )
    `, [invoiceId, invoiceId, `%${invoiceId.substring(0, 8)}%`]);
        // Find linked PAYMENT documents
        const [payments] = yield conn.query(`
        SELECT id, number, total, partnerId, partnerName, type FROM invoices 
        WHERE type = 'PAYMENT' AND (
            sourceInvoiceId ${collate} = ? ${collate}
            OR referenceInvoiceId ${collate} = ? ${collate}
            OR notes ${collate} LIKE ? ${collate}
        )
    `, [invoiceId, invoiceId, `%${invoiceId.substring(0, 8)}%`]);
        // Find linked journal entries
        const [journals] = yield conn.query(`
        SELECT je.id, je.description, je.referenceId, je.date FROM journal_entries je
        WHERE je.sourceInvoiceId ${collate} = ? ${collate}
        OR je.referenceId ${collate} = ? ${collate}
        OR je.referenceId ${collate} IN (SELECT number ${collate} FROM invoices WHERE id ${collate} = ? ${collate})
        OR je.description ${collate} LIKE ? ${collate}
    `, [invoiceId, invoiceId, invoiceId, `%${invoiceId.substring(0, 8)}%`]);
        // Find linked account transactions
        const [transactions] = yield conn.query(`
        SELECT id, invoiceId, partnerId, debit, credit FROM account_transactions
        WHERE invoiceId ${collate} = ? ${collate} OR invoiceId ${collate} IN (
            SELECT id FROM invoices WHERE sourceInvoiceId ${collate} = ? ${collate} OR referenceInvoiceId ${collate} = ? ${collate}
        )
    `, [invoiceId, invoiceId, invoiceId]);
        // Find linked bank transactions (table may not exist)
        let bankTransactions = [];
        try {
            const [bankTx] = yield conn.query(`
            SELECT id, bankId, amount, type FROM bank_transactions
            WHERE invoiceId ${collate} = ? ${collate}
        `, [invoiceId]);
            bankTransactions = bankTx;
        }
        catch (err) {
            // Table doesn't exist - ignore
            if (!((_a = err.message) === null || _a === void 0 ? void 0 : _a.includes("doesn't exist"))) {
                console.warn('Warning checking bank_transactions:', err.message);
            }
        }
        return {
            receipts: receipts,
            payments: payments,
            journals: journals,
            transactions: transactions,
            bankTransactions
        };
    });
}
/**
 * Archive an invoice before deletion (for audit trail)
 */
function archiveInvoice(conn, invoice, deletedBy) {
    return __awaiter(this, void 0, void 0, function* () {
        const archiveId = (0, uuid_1.v4)();
        // Archive the main invoice
        yield conn.query(`
        INSERT INTO deleted_invoices (
            id, original_id, date, type, partnerId, partnerName, total, 
            status, paymentMethod, posted, notes, dueDate, taxAmount, whtAmount, 
            shippingFee, globalDiscount, warehouseId, costCenterId, paidAmount, 
            bankAccountId, bankName, paymentBreakdown, salesmanId, createdBy, 
            deletedBy, deletedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
            archiveId, invoice.id, invoice.date, invoice.type, invoice.partnerId, invoice.partnerName,
            invoice.total, invoice.status, invoice.paymentMethod, invoice.posted, invoice.notes,
            invoice.dueDate, invoice.taxAmount, invoice.whtAmount, invoice.shippingFee,
            invoice.globalDiscount, invoice.warehouseId, invoice.costCenterId, invoice.paidAmount,
            invoice.bankAccountId, invoice.bankName, invoice.paymentBreakdown, invoice.salesmanId,
            invoice.createdBy, deletedBy
        ]);
        // Archive invoice lines
        const [lines] = yield conn.query('SELECT * FROM invoice_lines WHERE invoiceId = ?', [invoice.id]);
        for (const line of lines) {
            yield conn.query(`
            INSERT INTO deleted_invoice_lines (
                deletedInvoiceId, originalInvoiceId, productId, productName, 
                quantity, price, cost, discount, total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [archiveId, invoice.id, line.productId, line.productName,
                line.quantity, line.price, line.cost, line.discount, line.total]);
        }
        return archiveId;
    });
}
/**
 * Reverse partner balance changes from an invoice
 */
function reversePartnerBalance(conn, invoice, linkedDocs) {
    return __awaiter(this, void 0, void 0, function* () {
        const reversals = [];
        if (!invoice.partnerId)
            return reversals;
        // Calculate total amount to reverse based on invoice type
        let reverseAmount = 0;
        // Main invoice affects partner balance based on type
        const isSale = ['INVOICE_SALE', 'SALE_INVOICE'].includes(invoice.type);
        const isPurchase = ['INVOICE_PURCHASE', 'PURCHASE_INVOICE'].includes(invoice.type);
        if (isSale) {
            // Sales increase partner balance (they owe us)
            reverseAmount = -Number(invoice.total || 0);
        }
        else if (isPurchase) {
            // Purchases decrease partner balance (we owe them)
            reverseAmount = Number(invoice.total || 0);
        }
        // Receipts decrease partner balance (they paid us)
        // Payments increase partner balance (we paid them)
        for (const doc of linkedDocs) {
            if (doc.type === 'RECEIPT') {
                reverseAmount += Number(doc.total || 0); // Undo the reduction
            }
            else if (doc.type === 'PAYMENT') {
                reverseAmount -= Number(doc.total || 0); // Undo the increase
            }
        }
        if (reverseAmount !== 0) {
            yield conn.query('UPDATE partners SET balance = COALESCE(balance, 0) + ? WHERE id = ?', [reverseAmount, invoice.partnerId]);
            reversals.push({ partnerId: invoice.partnerId, amount: reverseAmount });
        }
        return reversals;
    });
}
/**
 * Reverse bank balance changes
 */
function reverseBankBalances(conn, bankTransactions) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const tx of bankTransactions) {
            if (!tx.bankId)
                continue;
            // Reverse the bank balance change
            const reverseAmount = tx.type === 'RECEIPT' || tx.type === 'DEPOSIT'
                ? -Number(tx.amount)
                : Number(tx.amount);
            yield conn.query('UPDATE banks SET balance = COALESCE(balance, 0) + ? WHERE id = ?', [reverseAmount, tx.bankId]);
        }
    });
}
/**
 * Update account balances after deleting journal entries
 */
function updateAccountBalances(conn, journalIds) {
    return __awaiter(this, void 0, void 0, function* () {
        if (journalIds.length === 0)
            return;
        // Get all affected accounts from the journals being deleted
        const placeholders = journalIds.map(() => '?').join(',');
        const [affectedAccounts] = yield conn.query(`
        SELECT DISTINCT accountId FROM journal_lines 
        WHERE journalId IN (${placeholders})
    `, journalIds);
        // Recalculate balance for each affected account
        for (const acc of affectedAccounts) {
            const [result] = yield conn.query(`
            SELECT 
                COALESCE(SUM(jl.debit), 0) as totalDebit,
                COALESCE(SUM(jl.credit), 0) as totalCredit
            FROM journal_lines jl
            WHERE jl.accountId = ?
        `, [acc.accountId]);
            const balance = result[0];
            const newBalance = Number(balance.totalDebit) - Number(balance.totalCredit);
            yield conn.query('UPDATE accounts SET balance = ? WHERE id = ?', [newBalance, acc.accountId]);
        }
    });
}
/**
 * Main cascade delete function
 *
 * Deletes an invoice and all its related documents in the correct order:
 * 1. Archive everything for audit trail
 * 2. Delete bank transactions
 * 3. Delete account transactions
 * 4. Delete journal lines, then journal entries
 * 5. Delete linked RECEIPT/PAYMENT invoices
 * 6. Reverse partner/bank balances
 * 7. Delete the main invoice and its lines
 */
function deleteInvoiceWithCascade(conn, invoiceId, deletedBy) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const result = {
            success: false,
            invoiceId,
            deletedReceipts: 0,
            deletedPayments: 0,
            deletedJournals: 0,
            deletedTransactions: 0,
            reversedBalances: []
        };
        try {
            // 1. Get the main invoice
            const [invoiceRows] = yield conn.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
            const invoice = invoiceRows[0];
            if (!invoice) {
                result.error = 'Invoice not found';
                return result;
            }
            console.log(`🗑️ [CascadeDelete] Starting cascade delete for invoice ${invoiceId} (${invoice.type})`);
            // 2. Find all related documents
            const related = yield findRelatedDocuments(conn, invoiceId);
            console.log(`📋 Found: ${related.receipts.length} receipts, ${related.payments.length} payments, ${related.journals.length} journals`);
            // 3. Archive the main invoice
            const archiveId = yield archiveInvoice(conn, invoice, deletedBy);
            result.archivedAt = archiveId;
            // 4. Archive and delete linked RECEIPT/PAYMENT documents
            const allLinkedDocs = [...related.receipts, ...related.payments];
            for (const doc of allLinkedDocs) {
                // Archive first
                yield archiveInvoice(conn, doc, deletedBy);
                // Delete account transactions for this document
                yield conn.query('DELETE FROM account_transactions WHERE invoiceId = ?', [doc.id]);
                // ✅ FIX: Delete journal entries for this linked document
                // The journal entries are referenced by the receipt number (e.g., RCV-VAN-2026-00006)
                try {
                    // Find journal entries for this linked doc by sourceInvoiceId, referenceId, or number
                    const [docJournals] = yield conn.query(`
                    SELECT je.id FROM journal_entries je
                    WHERE je.sourceInvoiceId = ?
                    OR je.referenceId = ?
                    OR je.referenceId = (SELECT number FROM invoices WHERE id = ?)
                    OR je.description LIKE ?
                `, [doc.id, doc.id, doc.id, `%${doc.number || doc.id.substring(0, 8)}%`]);
                    if (docJournals.length > 0) {
                        const journalIdsToDelete = docJournals.map((j) => j.id);
                        // Update account balances before deleting journals
                        yield updateAccountBalances(conn, journalIdsToDelete);
                        // Delete journal lines and entries
                        const phld = journalIdsToDelete.map(() => '?').join(',');
                        yield conn.query(`DELETE FROM journal_lines WHERE journalId IN (${phld})`, journalIdsToDelete);
                        yield conn.query(`DELETE FROM journal_entries WHERE id IN (${phld})`, journalIdsToDelete);
                        console.log(`📚 Deleted ${journalIdsToDelete.length} journal entries for linked ${doc.type} ${doc.number || doc.id}`);
                    }
                }
                catch (err) {
                    console.warn('Warning deleting journal entries for linked doc:', err.message);
                }
                // ✅ FIX: Also delete bank_transactions for linked receipts/payments
                // This is where mobile invoice payments (تحصيل بيع متنقل) are stored
                try {
                    // Find and reverse bank balances for this document
                    const [docBankTx] = yield conn.query('SELECT id, bankId, amount, type FROM bank_transactions WHERE invoiceId = ?', [doc.id]);
                    yield reverseBankBalances(conn, docBankTx);
                    yield conn.query('DELETE FROM bank_transactions WHERE invoiceId = ?', [doc.id]);
                    console.log(`🏦 Deleted bank_transactions for linked ${doc.type} ${doc.id}`);
                }
                catch (err) {
                    if (!((_a = err.message) === null || _a === void 0 ? void 0 : _a.includes("doesn't exist"))) {
                        console.warn('Warning deleting bank_transactions for linked doc:', err.message);
                    }
                }
                // Delete the document
                yield conn.query('DELETE FROM invoice_lines WHERE invoiceId = ?', [doc.id]);
                yield conn.query('DELETE FROM invoices WHERE id = ?', [doc.id]);
            }
            result.deletedReceipts = related.receipts.length;
            result.deletedPayments = related.payments.length;
            // 5. Delete account transactions for main invoice
            yield conn.query('DELETE FROM account_transactions WHERE invoiceId = ?', [invoiceId]);
            result.deletedTransactions = related.transactions.length;
            // 6. Collect journal IDs and delete journals
            const journalIds = related.journals.map((j) => j.id);
            if (journalIds.length > 0) {
                // Update account balances before deleting journals
                yield updateAccountBalances(conn, journalIds);
                // Delete journal lines then entries
                const placeholders = journalIds.map(() => '?').join(',');
                yield conn.query(`DELETE FROM journal_lines WHERE journalId IN (${placeholders})`, journalIds);
                yield conn.query(`DELETE FROM journal_entries WHERE id IN (${placeholders})`, journalIds);
            }
            result.deletedJournals = journalIds.length;
            // 7. Reverse bank balances
            yield reverseBankBalances(conn, related.bankTransactions);
            // Delete bank transactions (table may not exist)
            try {
                yield conn.query('DELETE FROM bank_transactions WHERE invoiceId = ?', [invoiceId]);
            }
            catch (err) {
                if (!((_b = err.message) === null || _b === void 0 ? void 0 : _b.includes("doesn't exist"))) {
                    console.warn('Warning deleting bank_transactions:', err.message);
                }
            }
            // 8. Reverse partner balances
            result.reversedBalances = yield reversePartnerBalance(conn, invoice, allLinkedDocs);
            // 9. Restore vehicle inventory for VAN sales (بيع متنقل)
            // If this is a VAN sale invoice, return the items to the vehicle
            const isVanSale = invoice.number && invoice.number.startsWith('VAN-');
            console.log(`🚗 [CascadeDelete] VAN sale check: number=${invoice.number}, isVanSale=${isVanSale}, salesmanId=${invoice.salesmanId}`);
            if (isVanSale) {
                let vehicleId = null;
                // Method 1: Find the customer_visit to get the vehicleId (may not exist on server)
                try {
                    const [visits] = yield conn.query('SELECT vehicleId FROM vehicle_customer_visits WHERE invoiceId = ? LIMIT 1', [invoiceId]);
                    const visit = visits[0];
                    if (visit && visit.vehicleId) {
                        vehicleId = visit.vehicleId;
                        console.log(`🔍 [CascadeDelete] Found vehicleId from customer_visits: ${vehicleId}`);
                    }
                }
                catch (e) {
                    // Table may not exist on server
                    console.log(`ℹ️ [CascadeDelete] vehicle_customer_visits table not found`);
                }
                // Method 2: Fallback - find vehicle by salesmanId
                if (!vehicleId && invoice.salesmanId) {
                    try {
                        const [vehicles] = yield conn.query('SELECT id FROM vehicles WHERE salesmanId = ? LIMIT 1', [invoice.salesmanId]);
                        const vehicle = vehicles[0];
                        if (vehicle) {
                            vehicleId = vehicle.id;
                            console.log(`🔍 [CascadeDelete] Found vehicleId from salesmanId: ${vehicleId}`);
                        }
                    }
                    catch (e) {
                        console.warn(`Warning finding vehicle by salesmanId: ${e.message}`);
                    }
                }
                // Method 3: Fallback - find salesman by name, then get their vehicle
                if (!vehicleId && invoice.createdBy) {
                    try {
                        // First find salesman ID by name/username match
                        const [salesmen] = yield conn.query('SELECT id FROM salesmen WHERE employeeName = ? OR userName = ? LIMIT 1', [invoice.createdBy, invoice.createdBy]);
                        const salesman = salesmen[0];
                        if (salesman) {
                            // Now find vehicle assigned to this salesman
                            const [vehicles] = yield conn.query('SELECT id FROM vehicles WHERE salesmanId = ? LIMIT 1', [salesman.id]);
                            const vehicle = vehicles[0];
                            if (vehicle) {
                                vehicleId = vehicle.id;
                                console.log(`🔍 [CascadeDelete] Found vehicleId from createdBy (${invoice.createdBy}): ${vehicleId}`);
                            }
                        }
                    }
                    catch (e) {
                        console.warn(`Warning finding vehicle by createdBy: ${e.message}`);
                    }
                }
                if (vehicleId) {
                    try {
                        // Get invoice lines to know what items to restore
                        const [lines] = yield conn.query('SELECT productId, quantity FROM invoice_lines WHERE invoiceId = ?', [invoiceId]);
                        // Restore each item to vehicle inventory
                        let restoredCount = 0;
                        for (const line of lines) {
                            const [updateResult] = yield conn.query('UPDATE vehicle_inventory SET quantity = quantity + ? WHERE vehicleId = ? AND productId = ?', [line.quantity, vehicleId, line.productId]);
                            if (updateResult.affectedRows > 0) {
                                restoredCount++;
                                console.log(`📦 [CascadeDelete] Restored ${line.quantity} of product ${line.productId} to vehicle ${vehicleId}`);
                            }
                            else {
                                console.warn(`⚠️ [CascadeDelete] No matching vehicle_inventory row for vehicleId=${vehicleId}, productId=${line.productId}`);
                            }
                        }
                        console.log(`🚗 [CascadeDelete] Restored ${restoredCount}/${lines.length} items to vehicle inventory`);
                    }
                    catch (err) {
                        console.warn(`Warning restoring vehicle inventory: ${err.message}`);
                    }
                }
                else {
                    console.warn(`⚠️ [CascadeDelete] VAN sale invoice but no vehicleId found. salesmanId=${invoice.salesmanId}, createdBy=${invoice.createdBy}`);
                }
            }
            // 10. Delete the main invoice and its lines
            yield conn.query('DELETE FROM invoice_lines WHERE invoiceId = ?', [invoiceId]);
            yield conn.query('DELETE FROM invoices WHERE id = ?', [invoiceId]);
            // 11. Delete related customer visits (الزيارات)
            // Customer visits have invoiceId linking them to VAN sale invoices
            try {
                const [visitResult] = yield conn.query('DELETE FROM vehicle_customer_visits WHERE invoiceId = ?', [invoiceId]);
                const deletedVisits = visitResult.affectedRows || 0;
                if (deletedVisits > 0) {
                    console.log(`🗑️ [CascadeDelete] Deleted ${deletedVisits} customer visits linked to invoice`);
                }
            }
            catch (err) {
                // Table may not exist in some installations
                if (!((_c = err.message) === null || _c === void 0 ? void 0 : _c.includes("doesn't exist"))) {
                    console.warn('Warning deleting vehicle_customer_visits:', err.message);
                }
            }
            result.success = true;
            console.log(`✅ [CascadeDelete] Successfully deleted invoice ${invoiceId} with ${allLinkedDocs.length} linked docs`);
            return result;
        }
        catch (error) {
            console.error(`❌ [CascadeDelete] Error deleting invoice ${invoiceId}:`, error);
            result.error = error.message;
            return result;
        }
    });
}
/**
 * Preview what would be deleted without actually deleting
 * Useful for confirmation dialogs
 */
function previewCascadeDelete(conn, invoiceId) {
    return __awaiter(this, void 0, void 0, function* () {
        const [invoiceRows] = yield conn.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
        const invoice = invoiceRows[0];
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        const related = yield findRelatedDocuments(conn, invoiceId);
        let totalAmount = Number(invoice.total || 0);
        for (const doc of [...related.receipts, ...related.payments]) {
            totalAmount += Number(doc.total || 0);
        }
        const linkedCount = related.receipts.length + related.payments.length;
        let warning = '';
        if (linkedCount > 0) {
            warning = `⚠️ سيتم حذف ${linkedCount} سند ${related.receipts.length > 0 ? 'قبض' : ''} ${related.payments.length > 0 ? 'صرف' : ''} مرتبط بهذه الفاتورة`;
        }
        if (related.journals.length > 0) {
            warning += `\n📚 سيتم حذف ${related.journals.length} قيد محاسبي`;
        }
        return {
            invoice,
            linkedReceipts: related.receipts,
            linkedPayments: related.payments,
            linkedJournals: related.journals,
            totalAmount,
            warning
        };
    });
}
