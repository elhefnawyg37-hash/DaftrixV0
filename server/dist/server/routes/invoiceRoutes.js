"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const invoiceController_1 = require("../controllers/invoiceController");
const invoiceControllerEnhanced_1 = require("../controllers/invoiceControllerEnhanced");
const deletedInvoicesController_1 = require("../controllers/deletedInvoicesController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const policyMiddleware_1 = require("../middleware/policyMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticateToken);
router.get('/', invoiceController_1.getInvoices);
// Deleted invoices routes - for audit trail
router.get('/deleted', (0, authMiddleware_1.requirePermission)('system.settings'), deletedInvoicesController_1.getDeletedInvoices);
router.get('/deleted/stats', (0, authMiddleware_1.requirePermission)('system.settings'), deletedInvoicesController_1.getDeletedInvoicesStats);
router.get('/deleted/:id', (0, authMiddleware_1.requirePermission)('system.settings'), deletedInvoicesController_1.getDeletedInvoiceById);
// Transfer routes - must come before /:id routes
router.get('/transfer/users', policyMiddleware_1.loadSystemConfig, invoiceControllerEnhanced_1.getTransferableUsers);
router.post('/transfer', policyMiddleware_1.loadSystemConfig, invoiceControllerEnhanced_1.transferInvoice);
// Customer last product price - آخر سعر اشترى به العميل هذا المنتج
router.get('/customer-last-price/:partnerId/:productId', invoiceController_1.getCustomerLastProductPrice);
// Get single invoice by ID with lines
router.get('/:id', invoiceController_1.getInvoiceById);
// Helper: Get permission for invoice type
const getInvoicePermission = (type, action) => {
    const permissionMap = {
        // Sales
        'SALE': `sales.${action}`,
        'INVOICE_SALE': `sales.${action}`,
        'SALE_RETURN': `sales.${action}`,
        'RETURN_SALE': `sales.${action}`,
        // Purchases
        'PURCHASE': `purchase.${action}`,
        'INVOICE_PURCHASE': `purchase.${action}`,
        'PURCHASE_RETURN': `purchase.${action}`,
        'RETURN_PURCHASE': `purchase.${action}`,
        // Treasury
        'RECEIPT': `treasury.receipts.${action}`,
        'PAYMENT': `treasury.payments.${action}`,
        // Quotations
        'QUOTATION': `sales.quotations.${action}`,
    };
    return permissionMap[type] || null;
};
router.post('/', (req, res, next) => {
    const type = req.body.type;
    const permission = getInvoicePermission(type, 'create');
    if (!permission) {
        return res.status(400).json({
            code: 'INVALID_TYPE',
            message: `نوع الفاتورة غير صالح: ${type}`
        });
    }
    return (0, authMiddleware_1.requirePermission)(permission)(req, res, next);
}, invoiceController_1.createInvoice);
// Update invoice with payment handling
router.put('/:id', (req, res, next) => {
    const type = req.body.type;
    const permission = getInvoicePermission(type, 'edit');
    if (!permission) {
        return res.status(400).json({
            code: 'INVALID_TYPE',
            message: `نوع الفاتورة غير صالح: ${type}`
        });
    }
    return (0, authMiddleware_1.requirePermission)(permission)(req, res, next);
}, invoiceController_1.updateInvoice);
// Preview what will be deleted (سندات مرتبطة)
router.get('/:id/preview-delete', policyMiddleware_1.loadSystemConfig, invoiceControllerEnhanced_1.previewDeleteInvoice);
// Delete invoice with CASCADE (deletes linked سند قبض / سند صرف)
router.delete('/:id', policyMiddleware_1.loadSystemConfig, invoiceControllerEnhanced_1.deleteInvoice);
exports.default = router;
