"use strict";
/**
 * Enhanced Authentication Middleware
 * Extends the base auth middleware with policy enforcement
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
exports.requireMinimumRole = exports.canModifyRecordMiddleware = exports.validateTransactionAmountMiddleware = exports.loadSystemConfig = void 0;
exports.getInvoiceCreator = getInvoiceCreator;
exports.getJournalCreator = getJournalCreator;
exports.getChequeCreator = getChequeCreator;
exports.trackFailedLogin = trackFailedLogin;
exports.clearFailedLogins = clearFailedLogins;
exports.isAccountLocked = isAccountLocked;
exports.cleanupOldAttempts = cleanupOldAttempts;
const db_1 = require("../db");
const dataFiltering_1 = require("../utils/dataFiltering");
/**
 * Middleware to load system configuration and user filter options
 * Should be used after authenticateToken middleware
 */
const loadSystemConfig = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const conn = yield (0, db_1.getConnection)();
        try {
            // Load system configuration
            const [configRows] = yield conn.query('SELECT config FROM system_config LIMIT 1');
            const configData = configRows[0];
            if (configData && configData.config) {
                const config = typeof configData.config === 'string'
                    ? JSON.parse(configData.config)
                    : configData.config;
                req.systemConfig = config;
            }
            // If user is authenticated, set up filter options
            if (req.user) {
                const userRole = req.user.role;
                const systemConfig = req.systemConfig;
                // Get user's salesman by checking salesmen.userId
                let salesmanId;
                try {
                    const [salesmanRows] = yield conn.query('SELECT id FROM salesmen WHERE userId = ? LIMIT 1', [req.user.id]);
                    salesmanId = ((_a = salesmanRows[0]) === null || _a === void 0 ? void 0 : _a.id) || undefined;
                }
                catch (e) {
                    // Column might not exist yet
                    salesmanId = undefined;
                }
                req.userFilterOptions = {
                    userId: req.user.id,
                    userName: req.user.name || req.user.username,
                    userRole: userRole,
                    salesmanId: salesmanId,
                    canSeeAll: (0, dataFiltering_1.canSeeAllData)(userRole, systemConfig),
                    canModifyOthers: (0, dataFiltering_1.canModifyOthersData)(userRole, systemConfig),
                    canSeeSalesmanData: (0, dataFiltering_1.isExemptFromSalesmanIsolation)(userRole, systemConfig)
                };
            }
            next();
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error loading system config:', error);
        // Continue without config - better than blocking the request
        next();
    }
});
exports.loadSystemConfig = loadSystemConfig;
/**
 * Middleware to validate transaction amount
 * Use this before allowing invoice/transaction creation
 */
const validateTransactionAmountMiddleware = (amountField = 'total') => {
    return (req, res, next) => {
        var _a, _b;
        if (!req.user || !req.systemConfig) {
            return next();
        }
        const amount = req.body[amountField];
        if (typeof amount !== 'number') {
            return next();
        }
        const userRole = req.user.role;
        const validation = (0, dataFiltering_1.validateTransactionAmount)(amount, userRole, req.systemConfig);
        if (!validation.allowed) {
            return res.status(403).json({
                error: 'TRANSACTION_LIMIT_EXCEEDED',
                message: validation.reason || 'Transaction amount exceeds your limit',
                limit: ((_b = (_a = req.systemConfig) === null || _a === void 0 ? void 0 : _a.transactionLimits) === null || _b === void 0 ? void 0 : _b[userRole]) || 0
            });
        }
        // Check if approval is needed
        if ((0, dataFiltering_1.needsApproval)(amount, req.systemConfig)) {
            // Add flag to request body to mark as pending approval
            req.body._needsApproval = true;
            req.body._approvalStatus = 'PENDING';
        }
        next();
    };
};
exports.validateTransactionAmountMiddleware = validateTransactionAmountMiddleware;
/**
 * Middleware to check if user can modify a record
 * Use this for UPDATE and DELETE operations
 */
const canModifyRecordMiddleware = (getRecordCreator) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        if (!req.user || !req.userFilterOptions) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        try {
            const recordCreator = yield getRecordCreator(req);
            if (!recordCreator) {
                return res.status(404).json({ error: 'Record not found' });
            }
            // Check if user owns the record
            if (recordCreator === req.userFilterOptions.userName) {
                return next();
            }
            // Check if user can modify others' data
            if (!req.userFilterOptions.canModifyOthers) {
                return res.status(403).json({
                    error: 'PERMISSION_DENIED',
                    message: 'You can only modify your own records',
                    recordOwner: recordCreator
                });
            }
            next();
        }
        catch (error) {
            console.error('Error checking record ownership:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    });
};
exports.canModifyRecordMiddleware = canModifyRecordMiddleware;
/**
 * Helper to get invoice creator
 */
function getInvoiceCreator(req) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const invoiceId = req.params.id || req.body.id;
        if (!invoiceId)
            return null;
        const conn = yield (0, db_1.getConnection)();
        try {
            const [rows] = yield conn.query('SELECT createdBy FROM invoices WHERE id = ? LIMIT 1', [invoiceId]);
            return ((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.createdBy) || null;
        }
        finally {
            conn.release();
        }
    });
}
/**
 * Helper to get journal entry creator
 */
function getJournalCreator(req) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const journalId = req.params.id || req.body.id;
        if (!journalId)
            return null;
        const conn = yield (0, db_1.getConnection)();
        try {
            const [rows] = yield conn.query('SELECT createdBy FROM journal_entries WHERE id = ? LIMIT 1', [journalId]);
            return ((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.createdBy) || null;
        }
        finally {
            conn.release();
        }
    });
}
/**
 * Helper to get cheque creator
 */
function getChequeCreator(req) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const chequeId = req.params.id || req.body.id;
        if (!chequeId)
            return null;
        const conn = yield (0, db_1.getConnection)();
        try {
            const [rows] = yield conn.query('SELECT createdBy FROM cheques WHERE id = ? LIMIT 1', [chequeId]);
            return ((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.createdBy) || null;
        }
        finally {
            conn.release();
        }
    });
}
/**
 * Middleware for role-based access (enhanced version)
 */
const requireMinimumRole = (minRole) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userRole = req.user.role;
        const roleHierarchy = {
            'MASTER_ADMIN': 5,
            'GENERAL_MANAGER': 4,
            'ADMIN': 4,
            'ACCOUNTANT': 3,
            'SALES': 2,
            'INVENTORY': 1,
            'WAREHOUSE_SUPERVISOR': 1,
            'MAINTENANCE': 1,
            'PURCHASING': 2
        };
        if (roleHierarchy[userRole] < roleHierarchy[minRole]) {
            return res.status(403).json({
                error: 'INSUFFICIENT_ROLE',
                message: `This action requires ${minRole} role or higher`,
                requiredRole: minRole,
                userRole: userRole
            });
        }
        next();
    };
};
exports.requireMinimumRole = requireMinimumRole;
/**
 * Rate limiting helper for failed login attempts
 */
const failedLoginAttempts = new Map();
function trackFailedLogin(username, systemConfig) {
    const security = (0, dataFiltering_1.checkSecurityPolicies)(systemConfig);
    // If not enabled, don't track
    if (security.maxFailedAttempts === 0) {
        return { locked: false };
    }
    const current = failedLoginAttempts.get(username) || { count: 0, lastAttempt: new Date() };
    current.count++;
    current.lastAttempt = new Date();
    failedLoginAttempts.set(username, current);
    const locked = current.count >= security.maxFailedAttempts;
    return {
        locked,
        remainingAttempts: locked ? 0 : security.maxFailedAttempts - current.count
    };
}
function clearFailedLogins(username) {
    failedLoginAttempts.delete(username);
}
function isAccountLocked(username, systemConfig) {
    const security = (0, dataFiltering_1.checkSecurityPolicies)(systemConfig);
    if (security.maxFailedAttempts === 0) {
        return false;
    }
    const attempts = failedLoginAttempts.get(username);
    if (!attempts) {
        return false;
    }
    return attempts.count >= security.maxFailedAttempts;
}
/**
 * Clean up old failed login attempts (run periodically)
 */
function cleanupOldAttempts(maxAgeHours = 24) {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    for (const [username, data] of failedLoginAttempts.entries()) {
        if (data.lastAttempt < cutoff) {
            failedLoginAttempts.delete(username);
        }
    }
}
// Clean up every hour
setInterval(() => cleanupOldAttempts(24), 60 * 60 * 1000);
