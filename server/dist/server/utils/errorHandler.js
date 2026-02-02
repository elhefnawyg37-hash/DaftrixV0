"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequired = exports.validateInvoiceTotal = exports.handleControllerError = void 0;
/**
 * Handle controller errors with appropriate status codes
 * @param res Express Response object
 * @param error The caught error
 * @param context Description of where the error occurred (e.g., 'createInvoice')
 */
const handleControllerError = (res, error, context) => {
    var _a, _b;
    console.error(`❌ Error in ${context}:`, error);
    // MySQL specific errors
    if (error.code === 'ER_DUP_ENTRY') {
        const match = (_a = error.message) === null || _a === void 0 ? void 0 : _a.match(/Duplicate entry '(.+)' for key/);
        const duplicateValue = match ? match[1] : 'unknown';
        return res.status(409).json({
            code: 'DUPLICATE_ENTRY',
            message: `السجل موجود مسبقاً: ${duplicateValue}`,
            details: error.message
        });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
        return res.status(400).json({
            code: 'INVALID_REFERENCE',
            message: 'السجل المشار إليه غير موجود',
            details: error.message
        });
    }
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
        return res.status(400).json({
            code: 'REFERENCE_EXISTS',
            message: 'لا يمكن حذف السجل لأنه مرتبط بسجلات أخرى',
            details: error.message
        });
    }
    if (error.code === 'ER_DATA_TOO_LONG') {
        return res.status(400).json({
            code: 'DATA_TOO_LONG',
            message: 'البيانات المدخلة طويلة جداً',
            details: error.message
        });
    }
    if (error.code === 'ER_TRUNCATED_WRONG_VALUE') {
        return res.status(400).json({
            code: 'INVALID_DATA_FORMAT',
            message: 'تنسيق البيانات غير صحيح',
            details: error.message
        });
    }
    // Application-level errors (detected by message content)
    const errorMessage = ((_b = error.message) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
    if (errorMessage.includes('not found') || errorMessage.includes('غير موجود')) {
        return res.status(404).json({
            code: 'NOT_FOUND',
            message: error.message
        });
    }
    if (errorMessage.includes('insufficient') || errorMessage.includes('غير كافية') || errorMessage.includes('الكمية')) {
        return res.status(400).json({
            code: 'INSUFFICIENT_QUANTITY',
            message: error.message
        });
    }
    if (errorMessage.includes('already exists') || errorMessage.includes('موجود مسبقاً')) {
        return res.status(409).json({
            code: 'ALREADY_EXISTS',
            message: error.message
        });
    }
    if (errorMessage.includes('unauthorized') || errorMessage.includes('غير مصرح')) {
        return res.status(403).json({
            code: 'FORBIDDEN',
            message: error.message
        });
    }
    if (errorMessage.includes('invalid') || errorMessage.includes('validation')) {
        return res.status(400).json({
            code: 'VALIDATION_ERROR',
            message: error.message
        });
    }
    // Default: Internal Server Error
    return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: `حدث خطأ في ${context}`,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};
exports.handleControllerError = handleControllerError;
/**
 * Validation error for invoice total mismatch
 */
const validateInvoiceTotal = (lines, providedTotal, taxAmount = 0, globalDiscount = 0, whtAmount = 0, shippingFee = 0) => {
    // Calculate line totals
    const lineTotal = lines.reduce((sum, line) => {
        const qty = parseFloat(line.quantity) || 0;
        const price = parseFloat(line.price) || 0;
        const lineDiscount = parseFloat(line.discount) || 0;
        const lineTotal = parseFloat(line.total) || (qty * price - lineDiscount);
        return sum + lineTotal;
    }, 0);
    // Calculate final total: (lineTotal - globalDiscount + shippingFee) + tax - WHT
    // Frontend calculates: taxableAmount = subTotal - globalDiscount + shippingFee
    // Then: invoiceTotal = taxableAmount + tax - whtAmount
    // Note: Tax is already computed on (subTotal - globalDiscount + shippingFee), so don't add shippingFee again
    const taxableAmount = lineTotal - (parseFloat(String(globalDiscount)) || 0) + (parseFloat(String(shippingFee)) || 0);
    const calculatedTotal = taxableAmount
        + (parseFloat(String(taxAmount)) || 0)
        - (parseFloat(String(whtAmount)) || 0);
    const providedTotalNum = parseFloat(String(providedTotal)) || 0;
    const difference = Math.abs(calculatedTotal - providedTotalNum);
    // Allow 1.00 tolerance for rounding errors (generous for Arabic currency)
    if (difference > 1.00) {
        return {
            valid: false,
            calculated: Math.round(calculatedTotal * 100) / 100,
            message: `إجمالي الفاتورة غير متطابق: المحسوب ${calculatedTotal.toFixed(2)}, المستلم ${providedTotalNum.toFixed(2)}`
        };
    }
    return { valid: true, calculated: Math.round(calculatedTotal * 100) / 100 };
};
exports.validateInvoiceTotal = validateInvoiceTotal;
/**
 * Common validation for required fields
 */
const validateRequired = (fields) => {
    const missing = [];
    for (const field of fields) {
        if (field.value === undefined || field.value === null || field.value === '') {
            missing.push(field.label || field.name);
        }
    }
    return {
        valid: missing.length === 0,
        missing
    };
};
exports.validateRequired = validateRequired;
exports.default = {
    handleControllerError: exports.handleControllerError,
    validateInvoiceTotal: exports.validateInvoiceTotal,
    validateRequired: exports.validateRequired
};
