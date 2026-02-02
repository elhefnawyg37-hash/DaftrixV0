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
exports.getJournalEntries = void 0;
const db_1 = require("../db");
const dataFiltering_1 = require("../utils/dataFiltering");
const errorHandler_1 = require("../utils/errorHandler");
const getJournalEntries = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authReq = req;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10000;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const search = req.query.search;
        const accountId = req.query.accountId;
        const offset = (page - 1) * limit;
        const conn = yield (0, db_1.getConnection)();
        let query = `
            SELECT j.*, 
                   GROUP_CONCAT(
                       CONCAT(
                           '{"id":', jl.id, 
                           ',"accountId":"', jl.accountId, '"',
                           ',"accountName":"', jl.accountName, '"',
                           ',"debit":', jl.debit,
                           ',"credit":', jl.credit,
                           IFNULL(CONCAT(',"costCenterId":"', jl.costCenterId, '"'), ''),
                           '}'
                       ) SEPARATOR ','
                   ) as linesJson
            FROM journal_entries j
            LEFT JOIN journal_lines jl ON j.id = jl.journalId
        `;
        let countQuery = 'SELECT COUNT(DISTINCT j.id) as total FROM journal_entries j';
        let whereConditions = [];
        let params = [];
        let countParams = [];
        // Apply salesman data isolation filter for collections
        if (authReq.userFilterOptions && authReq.systemConfig) {
            const salesmanFilter = (0, dataFiltering_1.buildSalesmanFilterClause)({
                userRole: authReq.userFilterOptions.userRole,
                salesmanId: authReq.userFilterOptions.salesmanId,
                systemConfig: authReq.systemConfig
            }, 'collections', 'j');
            if (salesmanFilter.clause) {
                whereConditions.push(salesmanFilter.clause);
                params.push(...salesmanFilter.params);
                countParams.push(...salesmanFilter.params);
            }
        }
        if (startDate) {
            whereConditions.push('j.date >= ?');
            params.push(startDate);
            countParams.push(startDate);
        }
        if (endDate) {
            whereConditions.push('j.date <= ?');
            params.push(endDate);
            countParams.push(endDate);
        }
        if (search) {
            whereConditions.push('j.description LIKE ?');
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }
        if (accountId) {
            whereConditions.push('EXISTS (SELECT 1 FROM journal_lines WHERE journalId = j.id AND accountId = ?)');
            params.push(accountId);
            countParams.push(accountId);
        }
        if (whereConditions.length > 0) {
            const whereClause = ' WHERE ' + whereConditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause.replace('j.date', 'date').replace('j.description', 'description');
        }
        query += ' GROUP BY j.id ORDER BY j.date DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const [rows] = yield conn.query(query, params);
        const [countResult] = yield conn.query(countQuery, countParams);
        const journals = rows.map(row => {
            let lines = [];
            if (row.linesJson) {
                try {
                    lines = JSON.parse(`[${row.linesJson}]`);
                }
                catch (e) {
                    console.error('Error parsing journal lines:', e);
                    lines = [];
                }
            }
            return {
                id: row.id,
                date: row.date,
                description: row.description,
                referenceId: row.referenceId,
                createdBy: row.createdBy,
                lines
            };
        });
        conn.release();
        res.json({
            journals,
            pagination: {
                total: countResult[0].total,
                page,
                limit,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    }
    catch (error) {
        console.error('Error fetching journal entries:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'journal entries');
    }
});
exports.getJournalEntries = getJournalEntries;
