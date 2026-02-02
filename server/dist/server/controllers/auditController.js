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
exports.getAuditLogs = exports.logAction = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const errorHandler_1 = require("../utils/errorHandler");
// Helper to log actions (internal use)
const logAction = (user, module, action, description, details) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🔍 AUDIT LOG:', { user, module, action, description, details });
        yield db_1.pool.query(`INSERT INTO audit_logs (id, date, user, module, action, description, details)
             VALUES (?, NOW(), ?, ?, ?, ?, ?)`, [(0, uuid_1.v4)(), user, module, action, description, details]);
        console.log('✅ Audit log saved successfully');
    }
    catch (error) {
        console.error('❌ Failed to create audit log:', error);
    }
});
exports.logAction = logAction;
// Get audit logs with pagination and filtering
const getAuditLogs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;
        // Filter parameters
        const user = req.query.user;
        const module = req.query.module;
        const action = req.query.action;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const search = req.query.search;
        // Build WHERE clause
        let whereConditions = [];
        let params = [];
        if (user) {
            whereConditions.push('user = ?');
            params.push(user);
        }
        if (module) {
            whereConditions.push('module = ?');
            params.push(module);
        }
        if (action) {
            whereConditions.push('action = ?');
            params.push(action);
        }
        if (startDate) {
            whereConditions.push('date >= ?');
            params.push(startDate);
        }
        if (endDate) {
            whereConditions.push('date <= ?');
            params.push(endDate + ' 23:59:59');
        }
        if (search) {
            whereConditions.push('(description LIKE ? OR details LIKE ? OR user LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';
        // Get total count
        const [countResult] = yield db_1.pool.query(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`, params);
        const total = countResult[0].total;
        // Get paginated data
        const [rows] = yield db_1.pool.query(`SELECT * FROM audit_logs ${whereClause} ORDER BY date DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        res.json({
            logs: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getAuditLogs = getAuditLogs;
