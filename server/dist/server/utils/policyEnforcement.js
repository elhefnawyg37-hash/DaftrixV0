"use strict";
/**
 * Policy Enforcement Utility
 * Server-side enforcement of all system policies
 * تطبيق السياسات على الخادم
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
exports.validateFiscalLockDate = validateFiscalLockDate;
exports.validatePostDatedTransaction = validatePostDatedTransaction;
exports.validateTransactionNotes = validateTransactionNotes;
exports.validateCostCenter = validateCostCenter;
exports.validateWarehouseSelection = validateWarehouseSelection;
exports.validateCostEntry = validateCostEntry;
exports.validateTransactionAmountLimit = validateTransactionAmountLimit;
exports.validateLargeTransactionApproval = validateLargeTransactionApproval;
exports.validateEditPostedInvoice = validateEditPostedInvoice;
exports.validateDeletePostedInvoice = validateDeletePostedInvoice;
exports.validateModifyOthersData = validateModifyOthersData;
exports.validateNegativeStock = validateNegativeStock;
exports.validateCreditLimit = validateCreditLimit;
exports.validateTransaction = validateTransaction;
exports.validateTransactionAsync = validateTransactionAsync;
exports.validateTransactionFull = validateTransactionFull;
const db_1 = require("../db");
/**
 * Validate fiscal lock date
 * التحقق من تاريخ الإقفال المالي
 */
function validateFiscalLockDate(transactionDate, config) {
    if (!config.fiscalLockDate) {
        return { valid: true };
    }
    const lockDate = new Date(config.fiscalLockDate);
    const txDate = new Date(transactionDate);
    if (txDate <= lockDate) {
        const message = `لا يمكن إجراء معاملات قبل تاريخ الإقفال المالي (${config.fiscalLockDate})`;
        if (config.fiscalLockType === 'STRICT') {
            return {
                valid: false,
                error: message,
                errorCode: 'FISCAL_LOCK_STRICT'
            };
        }
        else {
            // Warning mode - allow but log
            console.warn(`⚠️ Warning: Transaction before fiscal lock date: ${transactionDate}`);
            return { valid: true };
        }
    }
    return { valid: true };
}
/**
 * Validate post-dated transactions
 * التحقق من المعاملات المستقبلية
 */
function validatePostDatedTransaction(transactionDate, config) {
    if (config.allowPostDatedTransactions) {
        return { valid: true };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const txDate = new Date(transactionDate);
    txDate.setHours(0, 0, 0, 0);
    if (txDate > today) {
        return {
            valid: false,
            error: 'لا يُسمح بإدخال معاملات بتاريخ مستقبلي. يرجى تفعيل هذا الخيار من إعدادات النظام.',
            errorCode: 'POST_DATED_NOT_ALLOWED'
        };
    }
    return { valid: true };
}
/**
 * Validate transaction notes requirement
 * التحقق من إلزامية الملاحظات
 */
function validateTransactionNotes(notes, config) {
    if (!config.requireTransactionNotes) {
        return { valid: true };
    }
    if (!notes || notes.trim().length === 0) {
        return {
            valid: false,
            error: 'يجب إدخال ملاحظات أو وصف للمعاملة',
            errorCode: 'NOTES_REQUIRED'
        };
    }
    return { valid: true };
}
/**
 * Validate cost center requirement
 * التحقق من إلزامية مركز التكلفة
 */
function validateCostCenter(costCenterId, config) {
    if (!config.requireCostCenter) {
        return { valid: true };
    }
    if (!costCenterId) {
        return {
            valid: false,
            error: 'يجب تحديد مركز التكلفة',
            errorCode: 'COST_CENTER_REQUIRED'
        };
    }
    return { valid: true };
}
/**
 * Validate warehouse requirement
 * التحقق من إلزامية المستودع
 */
function validateWarehouseSelection(warehouseId, config, transactionType) {
    if (!config.requireWarehouseSelection) {
        return { valid: true };
    }
    // Only require warehouse for inventory-affecting transactions
    const inventoryTypes = ['INVOICE_SALE', 'INVOICE_PURCHASE', 'RETURN_SALE', 'RETURN_PURCHASE', 'STOCK_IN', 'STOCK_OUT', 'TRANSFER'];
    if (transactionType && !inventoryTypes.includes(transactionType)) {
        return { valid: true };
    }
    if (!warehouseId) {
        return {
            valid: false,
            error: 'يجب تحديد المستودع',
            errorCode: 'WAREHOUSE_REQUIRED'
        };
    }
    return { valid: true };
}
/**
 * Validate cost entry requirement
 * التحقق من إلزامية إدخال التكلفة
 */
function validateCostEntry(lines, config, transactionType) {
    if (!config.requireCostEntry) {
        return { valid: true };
    }
    // Only require cost for purchase-related transactions
    const costRequiredTypes = ['INVOICE_PURCHASE', 'RETURN_SALE'];
    if (transactionType && !costRequiredTypes.includes(transactionType)) {
        return { valid: true };
    }
    if (lines && lines.length > 0) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.cost === undefined || line.cost === null || line.cost <= 0) {
                return {
                    valid: false,
                    error: `يجب إدخال تكلفة للصنف في السطر ${i + 1}`,
                    errorCode: 'COST_REQUIRED'
                };
            }
        }
    }
    return { valid: true };
}
/**
 * Validate transaction amount limits
 * التحقق من حدود مبالغ المعاملات
 */
function validateTransactionAmountLimit(total, userRole, config) {
    if (!config.enableTransactionAmountLimit || !total || !userRole) {
        return { valid: true };
    }
    const limits = config.transactionLimits;
    if (!limits) {
        return { valid: true };
    }
    const limit = limits[userRole];
    if (limit !== undefined && limit !== null && total > limit) {
        return {
            valid: false,
            error: `مبلغ المعاملة (${total.toLocaleString()}) يتجاوز الحد المسموح لدورك الوظيفي (${limit.toLocaleString()})`,
            errorCode: 'AMOUNT_LIMIT_EXCEEDED'
        };
    }
    return { valid: true };
}
/**
 * Validate large transaction approval
 * التحقق من الموافقة على المعاملات الكبيرة
 */
function validateLargeTransactionApproval(total, hasApproval, config) {
    if (!config.requireApprovalForLargeTransactions || !total) {
        return { valid: true };
    }
    const threshold = config.largeTransactionThreshold || 0;
    if (total > threshold && !hasApproval) {
        return {
            valid: false,
            error: `المعاملات التي تتجاوز ${threshold.toLocaleString()} تتطلب موافقة المدير`,
            errorCode: 'APPROVAL_REQUIRED'
        };
    }
    return { valid: true };
}
/**
 * Validate edit posted invoice
 * التحقق من السماح بتعديل الفواتير المرحلة
 */
function validateEditPostedInvoice(isPosted, config) {
    if (config.allowEditPostedInvoices) {
        return { valid: true };
    }
    if (isPosted) {
        return {
            valid: false,
            error: 'لا يمكن تعديل الفواتير المرحلة. يرجى تفعيل هذا الخيار من إعدادات النظام.',
            errorCode: 'EDIT_POSTED_NOT_ALLOWED'
        };
    }
    return { valid: true };
}
/**
 * Validate delete posted invoice
 * التحقق من السماح بحذف الفواتير المرحلة
 */
function validateDeletePostedInvoice(isPosted, config) {
    if (config.allowDeletePostedInvoices) {
        return { valid: true };
    }
    if (isPosted) {
        return {
            valid: false,
            error: 'لا يمكن حذف الفواتير المرحلة. يرجى تفعيل هذا الخيار من إعدادات النظام.',
            errorCode: 'DELETE_POSTED_NOT_ALLOWED'
        };
    }
    return { valid: true };
}
/**
 * Validate modify others' data
 * التحقق من السماح بتعديل بيانات الآخرين
 */
function validateModifyOthersData(originalCreator, currentUser, currentUserRole, config) {
    // If not an update (no original creator), allow
    if (!originalCreator || !currentUser) {
        return { valid: true };
    }
    // If same user, always allow
    if (originalCreator === currentUser) {
        return { valid: true };
    }
    // MASTER_ADMIN can always modify
    if (currentUserRole === 'MASTER_ADMIN') {
        return { valid: true };
    }
    // Check if modification of others' data is enabled
    if (!config.enableModifyOthersData) {
        return {
            valid: false,
            error: 'لا يمكنك تعديل بيانات أدخلها مستخدم آخر',
            errorCode: 'MODIFY_OTHERS_NOT_ALLOWED'
        };
    }
    // Check if user's role is in the allowed list
    const allowedRoles = config.whoCanModifyOthersData || [];
    if (!allowedRoles.includes(currentUserRole)) {
        return {
            valid: false,
            error: 'دورك الوظيفي لا يسمح بتعديل بيانات الآخرين',
            errorCode: 'ROLE_CANNOT_MODIFY_OTHERS'
        };
    }
    return { valid: true };
}
/**
 * Validate negative stock
 * التحقق من المخزون السالب
 */
function validateNegativeStock(lines, transactionType, config) {
    return __awaiter(this, void 0, void 0, function* () {
        // If negative stock is allowed, skip validation
        if (config.allowNegativeStock) {
            return { valid: true };
        }
        // Only check for stock-reducing transactions
        const stockReducingTypes = ['INVOICE_SALE', 'RETURN_PURCHASE', 'STOCK_OUT', 'TRANSFER_OUT'];
        if (!transactionType || !stockReducingTypes.includes(transactionType)) {
            return { valid: true };
        }
        if (!lines || lines.length === 0) {
            return { valid: true };
        }
        try {
            const conn = yield (0, db_1.getConnection)();
            for (const line of lines) {
                const [rows] = yield conn.query('SELECT stock, name FROM products WHERE id = ?', [line.productId]);
                const product = rows[0];
                if (product) {
                    const currentStock = Number(product.stock) || 0;
                    const newStock = currentStock - Math.abs(line.quantity);
                    if (newStock < 0) {
                        conn.release();
                        return {
                            valid: false,
                            error: `الكمية المطلوبة (${line.quantity}) تتجاوز المخزون المتاح (${currentStock}) للصنف: ${product.name}`,
                            errorCode: 'NEGATIVE_STOCK_NOT_ALLOWED'
                        };
                    }
                }
            }
            conn.release();
        }
        catch (error) {
            console.error('Error validating negative stock:', error);
            // Don't block on validation errors
        }
        return { valid: true };
    });
}
/**
 * Validate credit limit
 * التحقق من حد الائتمان
 */
function validateCreditLimit(partnerId, transactionTotal, transactionType, config) {
    return __awaiter(this, void 0, void 0, function* () {
        // If strict credit limit is not enabled, skip
        if (!config.enableStrictCreditLimit) {
            return { valid: true };
        }
        // Only check for sales transactions
        const salesTypes = ['INVOICE_SALE'];
        if (!transactionType || !salesTypes.includes(transactionType)) {
            return { valid: true };
        }
        if (!partnerId || !transactionTotal) {
            return { valid: true };
        }
        try {
            const conn = yield (0, db_1.getConnection)();
            const [rows] = yield conn.query('SELECT name, creditLimit, balance FROM partners WHERE id = ?', [partnerId]);
            const partner = rows[0];
            conn.release();
            if (partner && partner.creditLimit > 0) {
                const currentBalance = Number(partner.balance) || 0;
                const newBalance = currentBalance + transactionTotal;
                if (newBalance > partner.creditLimit) {
                    return {
                        valid: false,
                        error: `العميل "${partner.name}" تجاوز حد الائتمان. الرصيد الحالي: ${currentBalance.toLocaleString()}، حد الائتمان: ${partner.creditLimit.toLocaleString()}`,
                        errorCode: 'CREDIT_LIMIT_EXCEEDED'
                    };
                }
            }
        }
        catch (error) {
            console.error('Error validating credit limit:', error);
            // Don't block on validation errors
        }
        return { valid: true };
    });
}
/**
 * Run all synchronous validations
 * تشغيل جميع التحققات المتزامنة
 */
function validateTransaction(context, config) {
    // Fiscal lock date
    let result = validateFiscalLockDate(context.date, config);
    if (!result.valid)
        return result;
    // Post-dated transactions
    result = validatePostDatedTransaction(context.date, config);
    if (!result.valid)
        return result;
    // Transaction notes
    result = validateTransactionNotes(context.notes, config);
    if (!result.valid)
        return result;
    // Cost center
    result = validateCostCenter(context.costCenterId, config);
    if (!result.valid)
        return result;
    // Warehouse selection
    result = validateWarehouseSelection(context.warehouseId, config, context.type);
    if (!result.valid)
        return result;
    // Cost entry
    result = validateCostEntry(context.lines, config, context.type);
    if (!result.valid)
        return result;
    // Amount limits
    result = validateTransactionAmountLimit(context.total, context.currentUserRole, config);
    if (!result.valid)
        return result;
    // Modify others' data
    result = validateModifyOthersData(context.createdBy, context.currentUser, context.currentUserRole, config);
    if (!result.valid)
        return result;
    return { valid: true };
}
/**
 * Run all async validations (database lookups)
 * تشغيل جميع التحققات غير المتزامنة
 */
function validateTransactionAsync(context, config) {
    return __awaiter(this, void 0, void 0, function* () {
        // Negative stock
        let result = yield validateNegativeStock(context.lines, context.type, config);
        if (!result.valid)
            return result;
        // Credit limit
        result = yield validateCreditLimit(context.partnerId, context.total, context.type, config);
        if (!result.valid)
            return result;
        return { valid: true };
    });
}
/**
 * Full transaction validation (sync + async)
 * التحقق الكامل من المعاملة
 */
function validateTransactionFull(context, config) {
    return __awaiter(this, void 0, void 0, function* () {
        // Run sync validations first
        const syncResult = validateTransaction(context, config);
        if (!syncResult.valid)
            return syncResult;
        // Run async validations
        const asyncResult = yield validateTransactionAsync(context, config);
        if (!asyncResult.valid)
            return asyncResult;
        return { valid: true };
    });
}
