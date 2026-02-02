"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.getTaxBrackets = exports.calculateTaxPreview = exports.setEmployeeSalaryComponent = exports.getEmployeeSalaryStructure = exports.getSalaryComponents = exports.deleteLeaveRequest = exports.cancelLeaveRequest = exports.rejectLeaveRequest = exports.approveLeaveRequest = exports.createLeaveRequest = exports.getLeaveRequests = exports.updateLeaveBalance = exports.initializeLeaveBalances = exports.getLeaveBalances = exports.deleteLeaveType = exports.updateLeaveType = exports.createLeaveType = exports.getLeaveTypes = exports.updateEmployeeTemplate = exports.removeEmployeeTemplate = exports.getEmployeeTemplates = exports.assignTemplateToEmployee = exports.deletePayrollTemplate = exports.updatePayrollTemplate = exports.createPayrollTemplate = exports.getPayrollTemplates = exports.getLoanHistory = exports.getLoanConstraints = exports.settleLoanEarly = exports.skipLoanInstallment = exports.getLoanInstallments = exports.createLoanWithInstallments = exports.checkLoanEligibility = exports.deleteAdvance = exports.updateAdvance = exports.createAdvance = exports.getAdvances = exports.updatePayrollEntry = exports.approvePayroll = exports.calculatePayroll = exports.deletePayrollCycle = exports.createPayrollCycle = exports.getPayrollEntries = exports.getPayrollCycles = exports.recordAttendance = exports.getAttendance = exports.deleteEmployee = exports.updateEmployee = exports.createEmployee = exports.getEmployees = void 0;
exports.deleteSalaryComponent = exports.updateSalaryComponent = exports.createSalaryComponent = exports.verifyTreasuryForPayroll = exports.getTreasuryBalance = exports.preflightPayrollApproval = exports.applyAdjustmentToPayroll = exports.approveAdjustment = exports.getPendingAdjustments = exports.createRetroactiveAdjustment = exports.calculateRetroactiveAdjustment = exports.migrateEmployeeSalaryStructure = exports.calculatePayrollPreview = exports.getInsuranceConfig = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const errorHandler_1 = require("../utils/errorHandler");
const loanService = __importStar(require("../services/loanService"));
// ==========================================
// EMPLOYEES
// ==========================================
const getEmployees = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [rows] = yield db_1.pool.query(`
      SELECT e.*, b.name as branchName, a.name as treasuryName, s.name as salesmanName
      FROM employees e
      LEFT JOIN branches b ON e.branchId = b.id
      LEFT JOIN accounts a ON e.treasuryAccountId = a.id
      LEFT JOIN salesmen s ON e.salesmanId = s.id
      ORDER BY e.fullName
    `);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching employees:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch employees');
    }
});
exports.getEmployees = getEmployees;
const createEmployee = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { fullName, nationalId, jobTitle, department, employmentType, baseSalary, branchId, treasuryAccountId, status, hireDate, phone, email, address, salesmanId } = req.body;
    // Convert ISO datetime to DATE format (YYYY-MM-DD)
    const parsedHireDate = hireDate ? new Date(hireDate).toISOString().split('T')[0] : null;
    try {
        const id = (0, uuid_1.v4)();
        yield db_1.pool.query(`
      INSERT INTO employees (
        id, fullName, nationalId, jobTitle, department, employmentType,
        baseSalary, branchId, treasuryAccountId, status, hireDate,
        phone, email, address, salesmanId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            id, fullName, nationalId, jobTitle, department, employmentType || 'MONTHLY',
            baseSalary || 0, branchId, treasuryAccountId, status || 'ACTIVE', parsedHireDate,
            phone || null, email || null, address || null, salesmanId || null
        ]);
        res.status(201).json({ id, message: 'Employee created successfully' });
    }
    catch (error) {
        console.error('Error creating employee:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create employee');
    }
});
exports.createEmployee = createEmployee;
const updateEmployee = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { fullName, nationalId, jobTitle, department, employmentType, baseSalary, branchId, treasuryAccountId, status, hireDate, phone, email, address, salesmanId } = req.body;
    // Convert ISO datetime to DATE format (YYYY-MM-DD)
    const parsedHireDate = hireDate ? new Date(hireDate).toISOString().split('T')[0] : null;
    try {
        yield db_1.pool.query(`
      UPDATE employees SET
        fullName = ?, nationalId = ?, jobTitle = ?, department = ?,
        employmentType = ?, baseSalary = ?, branchId = ?,
        treasuryAccountId = ?, status = ?, hireDate = ?,
        phone = ?, email = ?, address = ?, salesmanId = ?
      WHERE id = ?
    `, [
            fullName, nationalId, jobTitle, department, employmentType,
            baseSalary, branchId, treasuryAccountId, status, parsedHireDate,
            phone || null, email || null, address || null, salesmanId || null, id
        ]);
        res.json({ message: 'Employee updated successfully' });
    }
    catch (error) {
        console.error('Error updating employee:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update employee');
    }
});
exports.updateEmployee = updateEmployee;
const deleteEmployee = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM employees WHERE id = ?', [id]);
        res.json({ message: 'Employee deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting employee:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete employee');
    }
});
exports.deleteEmployee = deleteEmployee;
// ==========================================
// ATTENDANCE
// ==========================================
const getAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { date, employeeId, startDate, endDate } = req.query;
    try {
        let query = `
      SELECT ar.*, e.fullName 
      FROM attendance_records ar
      JOIN employees e ON ar.employeeId = e.id
      WHERE 1=1
    `;
        const params = [];
        if (employeeId) {
            query += ` AND ar.employeeId = ?`;
            params.push(employeeId);
        }
        if (date) {
            query += ` AND ar.date = ?`;
            params.push(date);
        }
        if (startDate && endDate) {
            query += ` AND ar.date BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }
        query += ` ORDER BY ar.date DESC, e.fullName`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching attendance:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch attendance');
    }
});
exports.getAttendance = getAttendance;
const recordAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, date, checkIn, checkOut, status, isOvertime, overtimeHours, notes, lateMinutes, earlyLeaveMinutes, scheduledCheckIn, scheduledCheckOut } = req.body;
    try {
        const id = (0, uuid_1.v4)();
        // Calculate late minutes if checkIn and scheduledCheckIn are provided
        let calculatedLateMinutes = lateMinutes || 0;
        let calculatedEarlyLeaveMinutes = earlyLeaveMinutes || 0;
        const defaultScheduledCheckIn = scheduledCheckIn || '09:00:00';
        const defaultScheduledCheckOut = scheduledCheckOut || '17:00:00';
        // Auto-calculate late minutes from checkIn time
        if (checkIn && !lateMinutes && status !== 'ABSENT') {
            const [schedHours, schedMins] = defaultScheduledCheckIn.split(':').map(Number);
            const [checkHours, checkMins] = checkIn.split(':').map(Number);
            const schedMinutes = schedHours * 60 + schedMins;
            const checkMinutes = checkHours * 60 + checkMins;
            calculatedLateMinutes = Math.max(0, checkMinutes - schedMinutes);
        }
        // Auto-calculate early leave minutes from checkOut time
        if (checkOut && !earlyLeaveMinutes && status !== 'ABSENT') {
            const [schedHours, schedMins] = defaultScheduledCheckOut.split(':').map(Number);
            const [checkHours, checkMins] = checkOut.split(':').map(Number);
            const schedMinutes = schedHours * 60 + schedMins;
            const checkMinutes = checkHours * 60 + checkMins;
            calculatedEarlyLeaveMinutes = Math.max(0, schedMinutes - checkMinutes);
        }
        // Determine status based on late minutes if not explicitly set
        let finalStatus = status || 'PRESENT';
        if (!status && calculatedLateMinutes > 0) {
            finalStatus = 'LATE';
        }
        // Upsert logic (insert or update if exists for same day)
        yield db_1.pool.query(`
      INSERT INTO attendance_records (
        id, employeeId, date, checkIn, checkOut, status,
        isOvertime, overtimeHours, lateMinutes, earlyLeaveMinutes,
        scheduledCheckIn, scheduledCheckOut, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        checkIn = VALUES(checkIn),
        checkOut = VALUES(checkOut),
        status = VALUES(status),
        isOvertime = VALUES(isOvertime),
        overtimeHours = VALUES(overtimeHours),
        lateMinutes = VALUES(lateMinutes),
        earlyLeaveMinutes = VALUES(earlyLeaveMinutes),
        scheduledCheckIn = VALUES(scheduledCheckIn),
        scheduledCheckOut = VALUES(scheduledCheckOut),
        notes = VALUES(notes)
    `, [
            id, employeeId, date, checkIn, checkOut, finalStatus,
            isOvertime || false, overtimeHours || 0,
            calculatedLateMinutes, calculatedEarlyLeaveMinutes,
            defaultScheduledCheckIn, defaultScheduledCheckOut, notes
        ]);
        res.json({
            message: 'Attendance recorded successfully',
            lateMinutes: calculatedLateMinutes,
            earlyLeaveMinutes: calculatedEarlyLeaveMinutes,
            status: finalStatus
        });
    }
    catch (error) {
        console.error('Error recording attendance:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'record attendance');
    }
});
exports.recordAttendance = recordAttendance;
// ==========================================
// PAYROLL
// ==========================================
const getPayrollCycles = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [rows] = yield db_1.pool.query(`
      SELECT * FROM payroll_cycles ORDER BY year DESC, month DESC
    `);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching payroll cycles:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch payroll cycles');
    }
});
exports.getPayrollCycles = getPayrollCycles;
const getPayrollEntries = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { payrollId } = req.params;
    try {
        const [rows] = yield db_1.pool.query(`
      SELECT pe.*, e.fullName, e.jobTitle, e.department
      FROM payroll_entries pe
      JOIN employees e ON pe.employeeId = e.id
      WHERE pe.payrollId = ?
    `, [payrollId]);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching payroll entries:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch payroll entries');
    }
});
exports.getPayrollEntries = getPayrollEntries;
const createPayrollCycle = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { month, year, notes, includeTax, includeInsurance } = req.body;
    try {
        const id = (0, uuid_1.v4)();
        yield db_1.pool.query(`
      INSERT INTO payroll_cycles (id, month, year, status, notes, includeTax, includeInsurance)
      VALUES (?, ?, ?, 'DRAFT', ?, ?, ?)
    `, [id, month, year, notes, includeTax !== false, includeInsurance !== false]);
        res.status(201).json({ id, message: 'Payroll cycle created' });
    }
    catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Payroll cycle for this month already exists' });
        }
        console.error('Error creating payroll cycle:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create payroll cycle');
    }
});
exports.createPayrollCycle = createPayrollCycle;
const deletePayrollCycle = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        // Check status
        const [cycles] = yield conn.query('SELECT status FROM payroll_cycles WHERE id = ?', [id]);
        if (cycles.length === 0)
            return res.status(404).json({ error: 'Cycle not found' });
        if (cycles[0].status !== 'DRAFT')
            return res.status(400).json({ error: 'Cannot delete an approved/paid payroll' });
        // Delete entries first (if no cascade)
        yield conn.query('DELETE FROM payroll_entries WHERE payrollId = ?', [id]);
        yield conn.query('DELETE FROM payroll_cycles WHERE id = ?', [id]);
        yield conn.commit();
        res.json({ message: 'Payroll cycle deleted' });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error deleting payroll cycle:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete payroll cycle');
    }
    finally {
        conn.release();
    }
});
exports.deletePayrollCycle = deletePayrollCycle;
const calculatePayroll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { id } = req.params; // payrollId
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        // 1. Get Payroll Cycle info
        const [cycleRows] = yield conn.query('SELECT * FROM payroll_cycles WHERE id = ?', [id]);
        if (cycleRows.length === 0)
            throw new Error('Payroll cycle not found');
        const cycle = cycleRows[0];
        // 2. Get Active Employees
        const [employees] = yield conn.query('SELECT * FROM employees WHERE status = "ACTIVE"');
        // 3. Clear existing entries for this draft
        yield conn.query('DELETE FROM payroll_entries WHERE payrollId = ?', [id]);
        let totalAmount = 0;
        const processedEntries = [];
        // 4. Calculate for each employee using Salary Service
        for (const emp of employees) {
            // Calculate date range for this payroll cycle (assuming full month for now)
            const startDate = `${cycle.year}-${String(cycle.month).padStart(2, '0')}-01`;
            const endDate = `${cycle.year}-${String(cycle.month).padStart(2, '0')}-31`; // Approx end date
            // 4a. Fetch Attendance Stats
            let attendanceValid = { absentDays: 0, lateMinutes: 0, overtimeHours: 0 };
            try {
                // Try newer schema first
                const [stats] = yield conn.query(`
                    SELECT 
                        COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) as absentDays,
                        SUM(COALESCE(lateMinutes, 0)) as lateMinutes,
                        COALESCE(SUM(overtimeHours), 0) as overtimeHours
                    FROM attendance_records
                    WHERE employeeId = ? AND date BETWEEN ? AND ?
                `, [emp.id, startDate, endDate]);
                attendanceValid = {
                    absentDays: parseFloat((_a = stats[0]) === null || _a === void 0 ? void 0 : _a.absentDays) || 0,
                    lateMinutes: parseFloat((_b = stats[0]) === null || _b === void 0 ? void 0 : _b.lateMinutes) || 0,
                    overtimeHours: parseFloat((_c = stats[0]) === null || _c === void 0 ? void 0 : _c.overtimeHours) || 0
                };
            }
            catch (e) {
                // Fallback to older schema if needed (count 'LATE' status instances as e.g. 15 mins each if strictly needed, 
                // but let's stick to what we saw in the view_file for attendance_records)
                console.warn(`Attendance query warning for ${emp.fullName}`, e);
            }
            // 4b. Fetch Loan Deductions
            const { total: loanDeductions } = yield loanService.getPendingInstallments(emp.id, startDate, endDate);
            // 4c. Calculate Payroll using Engine
            const payrollResult = yield salaryService.calculateEmployeePayroll(emp.id, {
                baseSalary: parseFloat(emp.baseSalary) || 0,
                variableSalary: parseFloat(emp.variableSalary) || 0,
                basicSalaryInsurable: parseFloat(emp.basicSalaryInsurable) || parseFloat(emp.baseSalary) || 0,
                personalExemption: parseFloat(emp.personalExemption) || 15000
            }, {
                workingDays: 30 - attendanceValid.absentDays,
                absentDays: attendanceValid.absentDays,
                lateMinutes: attendanceValid.lateMinutes,
                overtimeHours: attendanceValid.overtimeHours
            }, loanDeductions, {
                includeTax: cycle.includeTax !== 0, // MySQL boolean often 0/1
                includeInsurance: cycle.includeInsurance !== 0
            });
            // 4d. Save Entry
            const entryId = (0, uuid_1.v4)();
            totalAmount += payrollResult.netSalary;
            yield conn.query(`
                INSERT INTO payroll_entries (
                    id, payrollId, employeeId, baseSalary, 
                    grossSalary, netSalary,
                    earningsBreakdown, deductionsBreakdown,
                    socialInsurance, employerInsurance,
                    incomeTax, taxBreakdown,
                    advances,
                    insuranceBase,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
            `, [
                entryId, id, emp.id, payrollResult.grossSalary, // Note: baseSalary field often conflated with gross in older UI, keeping gross here for display
                payrollResult.grossSalary,
                payrollResult.netSalary,
                JSON.stringify(payrollResult.earnings),
                JSON.stringify(payrollResult.deductions),
                payrollResult.socialInsurance,
                payrollResult.employerInsurance,
                payrollResult.incomeTax,
                JSON.stringify(payrollResult.taxBreakdown),
                loanDeductions,
                payrollResult.insuranceBase
            ]);
            processedEntries.push(entryId);
        }
        // 5. Update Cycle Total
        yield conn.query('UPDATE payroll_cycles SET totalAmount = ? WHERE id = ?', [totalAmount, id]);
        yield conn.commit();
        res.json({
            message: 'Payroll calculated successfully',
            totalAmount,
            employeeCount: processedEntries.length,
            details: 'Calculated using Formula Engine V2'
        });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error calculating payroll:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'calculate payroll');
    }
    finally {
        conn.release();
    }
});
exports.calculatePayroll = calculatePayroll;
const approvePayroll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const { treasuryAccountId, expenseAccountId, entryIds } = req.body;
    if (!treasuryAccountId || !expenseAccountId) {
        return res.status(400).json({ error: 'Missing treasury or expense account' });
    }
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        const [cycleRows] = yield conn.query('SELECT * FROM payroll_cycles WHERE id = ?', [id]);
        if (cycleRows.length === 0)
            throw new Error('Payroll cycle not found');
        const cycle = cycleRows[0];
        // Get entries - either all or specific ones based on entryIds
        let entries;
        let isPartialPayment = false;
        if (entryIds && Array.isArray(entryIds) && entryIds.length > 0) {
            // Partial payment - only specific entries
            const placeholders = entryIds.map(() => '?').join(',');
            const [selectedEntries] = yield conn.query(`SELECT * FROM payroll_entries WHERE payrollId = ? AND id IN (${placeholders}) AND status = 'PENDING'`, [id, ...entryIds]);
            entries = selectedEntries;
            isPartialPayment = true;
        }
        else {
            // Full payment - all pending entries
            const [allEntries] = yield conn.query('SELECT * FROM payroll_entries WHERE payrollId = ? AND status = \'PENDING\'', [id]);
            entries = allEntries;
        }
        if (entries.length === 0) {
            return res.status(400).json({ error: 'No pending entries to pay' });
        }
        let totalNet = 0;
        for (const entry of entries) {
            totalNet += parseFloat(entry.netSalary);
        }
        // Create Journal Entry
        // Debit: Salaries Expense
        // Credit: Treasury
        const journalId = (0, uuid_1.v4)();
        const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
        // Include employee count in description for partial payments
        const description = isPartialPayment
            ? `رواتب شهر ${cycle.month}/${cycle.year} (${entries.length} موظف - دفعة جزئية)`
            : `رواتب شهر ${cycle.month}/${cycle.year}`;
        yield conn.query(`
      INSERT INTO journal_entries (id, date, description, referenceId)
      VALUES (?, ?, ?, ?)
    `, [
            journalId, date,
            description,
            `PAYROLL-${cycle.month}-${cycle.year}${isPartialPayment ? '-PARTIAL' : ''}`
        ]);
        // Debit Line
        yield conn.query(`
      INSERT INTO journal_lines (journalId, accountId, debit, credit)
      VALUES (?, ?, ?, 0)
    `, [journalId, expenseAccountId, totalNet]);
        // Credit Line
        yield conn.query(`
      INSERT INTO journal_lines (journalId, accountId, debit, credit)
      VALUES (?, ?, 0, ?)
    `, [journalId, treasuryAccountId, totalNet]);
        // Update only the paid entries status
        const paidEntryIds = entries.map((e) => e.id);
        if (paidEntryIds.length > 0) {
            const placeholders = paidEntryIds.map(() => '?').join(',');
            yield conn.query(`UPDATE payroll_entries SET status = 'PAID', paidAt = ? WHERE id IN (${placeholders})`, [date, ...paidEntryIds]);
        }
        // Check if all entries in this cycle are now paid
        const [pendingCount] = yield conn.query('SELECT COUNT(*) as count FROM payroll_entries WHERE payrollId = ? AND status = \'PENDING\'', [id]);
        // Only mark cycle as APPROVED if all entries are paid
        if (pendingCount[0].count === 0) {
            yield conn.query(`
          UPDATE payroll_cycles 
          SET status = 'APPROVED', approvedAt = ?, approvedBy = ? 
          WHERE id = ?
        `, [date, (_a = req.user) === null || _a === void 0 ? void 0 : _a.id, id]);
        }
        // Update Loan Installments (New System)
        try {
            const startDate = `${cycle.year}-${String(cycle.month).padStart(2, '0')}-01`;
            const endDate = `${cycle.year}-${String(cycle.month).padStart(2, '0')}-31`;
            for (const entry of entries) {
                yield loanService.markInstallmentsAsDeducted(entry.employeeId, id, startDate, endDate);
            }
        }
        catch (loanError) {
            console.warn('Could not update loan installments:', loanError);
        }
        yield conn.commit();
        res.json({
            message: isPartialPayment
                ? `تم صرف رواتب ${entries.length} موظف بنجاح (${totalNet.toLocaleString()} جنيه)`
                : 'Payroll approved and posted to journals successfully',
            paidCount: entries.length,
            paidTotal: totalNet,
            isPartialPayment,
            remainingCount: pendingCount[0].count
        });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error approving payroll:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'approve payroll');
    }
    finally {
        conn.release();
    }
});
exports.approvePayroll = approvePayroll;
// Update individual payroll entry (Manual Mode) - Comprehensive Version
const updatePayrollEntry = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { entryId } = req.params;
    const body = req.body;
    const conn = yield db_1.pool.getConnection();
    try {
        yield conn.beginTransaction();
        // Get current entry
        const [entries] = yield conn.query('SELECT * FROM payroll_entries WHERE id = ?', [entryId]);
        if (entries.length === 0) {
            return res.status(404).json({ error: 'Payroll entry not found' });
        }
        const entry = entries[0];
        // Check if payroll is still in DRAFT status
        const [cycles] = yield conn.query('SELECT status FROM payroll_cycles WHERE id = ?', [entry.payrollId]);
        if (cycles.length === 0 || cycles[0].status !== 'DRAFT') {
            return res.status(400).json({ error: 'Cannot edit entries for approved/paid payroll' });
        }
        // Get values from body or use existing
        const baseSalary = body.baseSalary !== undefined ? parseFloat(body.baseSalary) : parseFloat(entry.baseSalary);
        const dailyRate = body.dailyRate !== undefined ? parseFloat(body.dailyRate) : parseFloat(entry.dailyRate) || baseSalary / 30;
        const overtimeRate = body.overtimeRate !== undefined ? parseFloat(body.overtimeRate) : parseFloat(entry.overtimeRate) || (dailyRate / 8) * 1.5;
        const overtimeHours = body.overtimeHours !== undefined ? parseFloat(body.overtimeHours) : parseFloat(entry.overtimeHours) || 0;
        const overtimeAmount = body.overtimeAmount !== undefined ? parseFloat(body.overtimeAmount) : overtimeRate * overtimeHours;
        const incentives = body.incentives !== undefined ? parseFloat(body.incentives) : parseFloat(entry.incentives) || 0;
        const bonus = body.bonus !== undefined ? parseFloat(body.bonus) : parseFloat(entry.bonus) || 0;
        const purchases = body.purchases !== undefined ? parseFloat(body.purchases) : parseFloat(entry.purchases) || 0;
        const advances = body.advances !== undefined ? parseFloat(body.advances) : parseFloat(entry.advances) || 0;
        const absenceDays = body.absenceDays !== undefined ? parseFloat(body.absenceDays) : parseFloat(entry.absenceDays) || 0;
        const absenceAmount = body.absenceAmount !== undefined ? parseFloat(body.absenceAmount) : dailyRate * absenceDays;
        const paidLeaveDays = body.paidLeaveDays !== undefined ? parseFloat(body.paidLeaveDays) : parseFloat(entry.paidLeaveDays) || 0;
        const unpaidLeaveDays = body.unpaidLeaveDays !== undefined ? parseFloat(body.unpaidLeaveDays) : parseFloat(entry.unpaidLeaveDays) || 0;
        const unpaidLeaveAmount = body.unpaidLeaveAmount !== undefined ? parseFloat(body.unpaidLeaveAmount) : dailyRate * unpaidLeaveDays;
        const hourDeductions = body.hourDeductions !== undefined ? parseFloat(body.hourDeductions) : parseFloat(entry.hourDeductions) || 0;
        const penaltyDays = body.penaltyDays !== undefined ? parseFloat(body.penaltyDays) : parseFloat(entry.penaltyDays) || 0;
        const penalties = body.penalties !== undefined ? parseFloat(body.penalties) : parseFloat(entry.penalties) || 0;
        const salesmanDeficitDeduction = body.salesmanDeficitDeduction !== undefined ? parseFloat(body.salesmanDeficitDeduction) : parseFloat(entry.salesmanDeficitDeduction) || 0;
        const notes = body.notes !== undefined ? body.notes : entry.notes;
        // Parse legacy allowances/deductions (for backward compatibility)
        const allowances = body.allowances !== undefined
            ? (typeof body.allowances === 'string' ? JSON.parse(body.allowances) : body.allowances)
            : JSON.parse(entry.allowances || '[]');
        const deductions = body.deductions !== undefined
            ? (typeof body.deductions === 'string' ? JSON.parse(body.deductions) : body.deductions)
            : JSON.parse(entry.deductions || '[]');
        // Parse detailed breakdowns
        let earningsBreakdown = [];
        try {
            earningsBreakdown = typeof entry.earningsBreakdown === 'string'
                ? JSON.parse(entry.earningsBreakdown)
                : (entry.earningsBreakdown || []);
        }
        catch (e) {
            earningsBreakdown = [];
        }
        let deductionsBreakdown = [];
        try {
            deductionsBreakdown = typeof entry.deductionsBreakdown === 'string'
                ? JSON.parse(entry.deductionsBreakdown)
                : (entry.deductionsBreakdown || []);
        }
        catch (e) {
            deductionsBreakdown = [];
        }
        // SYNC: Update breakdowns with new values from allowances/deductions
        allowances.forEach((newComp) => {
            const idx = earningsBreakdown.findIndex((c) => c.componentId === newComp.componentId || c.name === newComp.name);
            if (idx >= 0) {
                earningsBreakdown[idx].amount = Number(newComp.amount);
            }
            else {
                earningsBreakdown.push(Object.assign(Object.assign({}, newComp), { type: 'EARNING' }));
            }
        });
        deductions.forEach((newComp) => {
            const idx = deductionsBreakdown.findIndex((c) => c.componentId === newComp.componentId || c.name === newComp.name);
            if (idx >= 0) {
                deductionsBreakdown[idx].amount = Number(newComp.amount);
            }
            else {
                deductionsBreakdown.push(Object.assign(Object.assign({}, newComp), { type: 'DEDUCTION' }));
            }
        });
        if (body.baseSalary !== undefined) {
            const idx = earningsBreakdown.findIndex((c) => c.code === 'BASIC');
            if (idx >= 0)
                earningsBreakdown[idx].amount = parseFloat(body.baseSalary);
        }
        // Calculate totals
        const otherAllowances = allowances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
        const otherDeductions = deductions.reduce((sum, d) => sum + Number(d.amount || 0), 0);
        const grossSalary = baseSalary + overtimeAmount + incentives + bonus + otherAllowances;
        const totalDeductions = absenceAmount + unpaidLeaveAmount + purchases + advances + hourDeductions + penalties + otherDeductions + salesmanDeficitDeduction;
        const netSalary = grossSalary - totalDeductions;
        // Update the entry with all fields
        yield conn.query(`
            UPDATE payroll_entries SET
                baseSalary = ?, dailyRate = ?, overtimeRate = ?, overtimeHours = ?, overtimeAmount = ?,
                incentives = ?, bonus = ?, allowances = ?, grossSalary = ?,
                purchases = ?, advances = ?, absenceDays = ?, absenceAmount = ?,
                paidLeaveDays = ?, unpaidLeaveDays = ?, unpaidLeaveAmount = ?,
                hourDeductions = ?, penaltyDays = ?, penalties = ?, deductions = ?, totalDeductions = ?,
                netSalary = ?, notes = ?, salesmanDeficitDeduction = ?,
                earningsBreakdown = ?, deductionsBreakdown = ?
            WHERE id = ?
        `, [
            baseSalary, dailyRate, overtimeRate, overtimeHours, overtimeAmount,
            incentives, bonus, JSON.stringify(allowances), grossSalary,
            purchases, advances, absenceDays, absenceAmount,
            paidLeaveDays, unpaidLeaveDays, unpaidLeaveAmount,
            hourDeductions, penaltyDays, penalties, JSON.stringify(deductions), totalDeductions,
            netSalary, notes, salesmanDeficitDeduction,
            JSON.stringify(earningsBreakdown), JSON.stringify(deductionsBreakdown),
            entryId
        ]);
        // Recalculate cycle total
        const [totals] = yield conn.query('SELECT SUM(netSalary) as total FROM payroll_entries WHERE payrollId = ?', [entry.payrollId]);
        const newTotal = totals[0].total || 0;
        yield conn.query('UPDATE payroll_cycles SET totalAmount = ? WHERE id = ?', [newTotal, entry.payrollId]);
        yield conn.commit();
        res.json({
            message: 'Entry updated successfully',
            entry: {
                id: entryId, baseSalary, dailyRate, overtimeRate, overtimeHours, overtimeAmount,
                incentives, bonus, allowances, grossSalary,
                purchases, advances, absenceDays, absenceAmount,
                paidLeaveDays, unpaidLeaveDays, unpaidLeaveAmount,
                hourDeductions, penaltyDays, penalties, deductions, totalDeductions,
                netSalary, notes, salesmanDeficitDeduction
            },
            cycleTotal: newTotal
        });
    }
    catch (error) {
        yield conn.rollback();
        console.error('Error updating payroll entry:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update payroll entry');
    }
    finally {
        conn.release();
    }
});
exports.updatePayrollEntry = updatePayrollEntry;
// ==========================================
// EMPLOYEE ADVANCES / LOANS
// ==========================================
const getAdvances = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, status, grouped } = req.query;
    try {
        // If grouped=true, return per-employee summary with totals
        if (grouped === 'true') {
            const [summaries] = yield db_1.pool.query(`
                SELECT 
                    e.id as employeeId,
                    e.fullName as employeeName,
                    e.jobTitle,
                    e.department,
                    COUNT(a.id) as advanceCount,
                    COALESCE(SUM(a.amount), 0) as totalTaken,
                    COALESCE(SUM(a.remainingAmount), 0) as totalRemaining,
                    COALESCE(SUM(a.totalPaid), 0) as totalPaid,
                    SUM(CASE WHEN a.status = 'ACTIVE' THEN 1 ELSE 0 END) as activeCount,
                    MAX(a.issueDate) as lastAdvanceDate
                FROM employees e
                INNER JOIN employee_advances a ON e.id = a.employeeId
                GROUP BY e.id, e.fullName, e.jobTitle, e.department
                HAVING COUNT(a.id) > 0
                ORDER BY COALESCE(SUM(a.remainingAmount), 0) DESC, e.fullName
            `);
            // Parse values to ensure they're numbers (MySQL may return strings)
            const parsedSummaries = summaries.map((s) => (Object.assign(Object.assign({}, s), { advanceCount: Number(s.advanceCount) || 0, totalTaken: Number(s.totalTaken) || 0, totalRemaining: Number(s.totalRemaining) || 0, totalPaid: Number(s.totalPaid) || 0, activeCount: Number(s.activeCount) || 0 })));
            return res.json(parsedSummaries);
        }
        // Regular query - return individual advances
        let query = `
          SELECT a.*, e.fullName as employeeName, e.jobTitle, e.department
          FROM employee_advances a
          JOIN employees e ON a.employeeId = e.id
          WHERE 1=1
        `;
        const params = [];
        if (employeeId) {
            query += ` AND a.employeeId = ?`;
            params.push(employeeId);
        }
        if (status) {
            query += ` AND a.status = ?`;
            params.push(status);
        }
        query += ` ORDER BY a.issueDate DESC`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching advances:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch advances');
    }
});
exports.getAdvances = getAdvances;
// Helper to create accounting entry for advances/loans
const createAdvanceAccountingEntry = (connection, advanceId, amount, employeeId, issueDate, paymentMethod, financialAccountId, type, user) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // 1. Get Employee Name
    const [employees] = yield connection.query('SELECT fullName as name FROM employees WHERE id = ?', [employeeId]);
    const employeeName = ((_a = employees[0]) === null || _a === void 0 ? void 0 : _a.name) || 'Employee';
    // 2. Find "Employee Advances/Loans" Account (Debit)
    // Robust Approach: Fetch all accounts and filter in JS to avoid SQL nuances
    const [allAccounts] = yield connection.query('SELECT id, code, name FROM accounts');
    let loanAccount = allAccounts.find((a) => (a.name && (a.name.includes('سلف') || a.name.includes('قرض') || a.name.includes('موظف') || a.name.includes('عامل'))) ||
        (a.name && (a.name.toLowerCase().includes('loan') || a.name.toLowerCase().includes('advance'))));
    if (!loanAccount) {
        loanAccount = allAccounts.find((a) => a.code && String(a.code).startsWith('112'));
    }
    if (!loanAccount) {
        loanAccount = allAccounts.find((a) => a.code && String(a.code).startsWith('104'));
    }
    // Last resort: Any Debit account (Asset) - usually starts with 1
    if (!loanAccount) {
        loanAccount = allAccounts.find((a) => a.code && String(a.code).startsWith('1'));
    }
    let loanAccountId = loanAccount === null || loanAccount === void 0 ? void 0 : loanAccount.id;
    // 3. Identify Financial Account (Credit) = Treasury/Bank
    let creditAccountId = null;
    if (paymentMethod === 'BANK') {
        const [banks] = yield connection.query('SELECT id, name, accountId FROM banks WHERE id = ?', [financialAccountId]);
        if (banks[0]) {
            creditAccountId = banks[0].accountId;
            yield connection.query('UPDATE banks SET balance = balance - ? WHERE id = ?', [amount, financialAccountId]);
        }
    }
    else {
        creditAccountId = financialAccountId;
    }
    if (creditAccountId && loanAccountId) {
        const journalId = (0, uuid_1.v4)();
        const description = `صرف ${type === 'LOAN' ? 'قرض' : 'سلفة'} للموظف ${employeeName}`;
        yield connection.query(`
            INSERT INTO journal_entries (id, date, description, referenceId, createdBy)
            VALUES (?, ?, ?, ?, ?)
        `, [
            journalId,
            issueDate,
            description,
            advanceId,
            (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.username) || 'System'
        ]);
        // Debit: Employee Loan Account
        yield connection.query(`
            INSERT INTO journal_lines (journalId, accountId, debit, credit)
            VALUES (?, ?, ?, 0)
        `, [journalId, loanAccountId, amount]);
        // Credit: Treasury/Bank
        yield connection.query(`
            INSERT INTO journal_lines (journalId, accountId, debit, credit)
            VALUES (?, ?, 0, ?)
        `, [journalId, creditAccountId, amount]);
        yield connection.query('UPDATE accounts SET balance = COALESCE(balance, 0) + ? WHERE id = ?', [amount, loanAccountId]);
        yield connection.query('UPDATE accounts SET balance = COALESCE(balance, 0) - ? WHERE id = ?', [amount, creditAccountId]);
        console.log('✅ Accounting Entry Created Successfully:', journalId);
    }
    else {
        console.warn('⚠️ MISSING ACCOUNTS - Cannot create journal entry', { loanAccountId, creditAccountId });
    }
});
const createAdvance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, type, amount, reason, issueDate, monthlyDeduction, paymentMethod, financialAccountId } = req.body;
    console.log('🚀 createAdvance Request Body:', req.body);
    const user = req.user;
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        const id = (0, uuid_1.v4)();
        yield connection.query(`
          INSERT INTO employee_advances (
            id, employeeId, type, amount, reason, issueDate, 
            monthlyDeduction, remainingAmount, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `, [
            id, employeeId, type || 'ADVANCE', amount, reason, issueDate,
            monthlyDeduction || 0, amount
        ]);
        if (paymentMethod && financialAccountId) {
            console.log('💳 Payment details provided, creating accounting entry...');
            yield createAdvanceAccountingEntry(connection, id, parseFloat(amount), employeeId, issueDate, paymentMethod, financialAccountId, 'ADVANCE', user);
        }
        else {
            console.warn('⚠️ No payment method provided, skipping accounting entry.');
        }
        yield connection.commit();
        res.status(201).json({ id, message: 'Advance created successfully' });
    }
    catch (error) {
        yield connection.rollback();
        console.error('Error creating advance:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create advance');
    }
    finally {
        connection.release();
    }
});
exports.createAdvance = createAdvance;
const updateAdvance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { monthlyDeduction, status, totalPaid, remainingAmount } = req.body;
    try {
        yield db_1.pool.query(`
          UPDATE employee_advances SET
            monthlyDeduction = COALESCE(?, monthlyDeduction),
            status = COALESCE(?, status),
            totalPaid = COALESCE(?, totalPaid),
            remainingAmount = COALESCE(?, remainingAmount)
          WHERE id = ?
        `, [monthlyDeduction, status, totalPaid, remainingAmount, id]);
        res.json({ message: 'Advance updated successfully' });
    }
    catch (error) {
        console.error('Error updating advance:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update advance');
    }
});
exports.updateAdvance = updateAdvance;
const deleteAdvance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM employee_advances WHERE id = ?', [id]);
        res.json({ message: 'Advance deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting advance:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete advance');
    }
});
exports.deleteAdvance = deleteAdvance;
// ==========================================
// SMART LOANS - New Endpoints
// ==========================================
/**
 * Check loan eligibility for an employee
 */
const checkLoanEligibility = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, amount, numberOfMonths } = req.body;
    try {
        const result = yield loanService.checkLoanEligibility(employeeId, parseFloat(amount), parseInt(numberOfMonths));
        res.json(result);
    }
    catch (error) {
        console.error('Error checking loan eligibility:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'check loan eligibility');
    }
});
exports.checkLoanEligibility = checkLoanEligibility;
/**
 * Create a new loan with installments
 */
const createLoanWithInstallments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, type, loanType, amount, reason, issueDate, numberOfMonths, allowSkip, maxSkipCount, paymentMethod, financialAccountId } = req.body;
    const user = req.user;
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        // Validate eligibility first
        const eligibility = yield loanService.checkLoanEligibility(employeeId, parseFloat(amount), parseInt(numberOfMonths) || 1);
        if (!eligibility.eligible && loanType === 'LOAN') {
            connection.release();
            return res.status(400).json({
                error: 'لا يمكن منح القرض',
                reasons: eligibility.reasons
            });
        }
        const id = (0, uuid_1.v4)();
        const numMonths = parseInt(numberOfMonths) || 1;
        const monthlyDeduction = parseFloat(amount) / numMonths;
        // Create the loan record
        yield connection.query(`
            INSERT INTO employee_advances (
                id, employeeId, type, loanType, amount, reason, 
                issueDate, requestDate, monthlyDeduction, numberOfInstallments,
                allowSkip, maxSkipCount, remainingAmount, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `, [
            id, employeeId, type || 'ADVANCE', loanType || 'ADVANCE',
            amount, reason, issueDate, issueDate, monthlyDeduction,
            numMonths, allowSkip !== false, maxSkipCount || 2, amount
        ]);
        // Generate installments if it's a LOAN
        if (loanType === 'LOAN' || numMonths > 1) {
            yield loanService.generateInstallments(id, employeeId, parseFloat(amount), numMonths, new Date(issueDate));
        }
        // Create Accounting Entry
        if (paymentMethod && financialAccountId) {
            yield createAdvanceAccountingEntry(connection, id, parseFloat(amount), employeeId, issueDate, paymentMethod, financialAccountId, loanType || 'ADVANCE', user);
        }
        yield connection.commit();
        res.status(201).json({
            id,
            message: loanType === 'LOAN' ? 'تم إنشاء القرض بنجاح' : 'تم إنشاء السلفة بنجاح'
        });
    }
    catch (error) {
        yield connection.rollback();
        console.error('Error creating loan:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create loan');
    }
    finally {
        connection.release();
    }
});
exports.createLoanWithInstallments = createLoanWithInstallments;
/**
 * Get installments for a specific loan
 */
const getLoanInstallments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { loanId } = req.params;
    try {
        const [installments] = yield db_1.pool.query(`
            SELECT * FROM loan_installments
            WHERE loanId = ?
            ORDER BY installmentNumber
        `, [loanId]);
        res.json(installments);
    }
    catch (error) {
        console.error('Error fetching loan installments:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch loan installments');
    }
});
exports.getLoanInstallments = getLoanInstallments;
/**
 * Skip an installment
 */
const skipLoanInstallment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { installmentId } = req.params;
    const { reason, userId } = req.body;
    try {
        yield loanService.skipInstallment(installmentId, reason, userId);
        res.json({ message: 'تم تأجيل القسط بنجاح' });
    }
    catch (error) {
        console.error('Error skipping installment:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'skip installment');
    }
});
exports.skipLoanInstallment = skipLoanInstallment;
/**
 * Settle a loan early
 */
const settleLoanEarly = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { loanId } = req.params;
    const { settlementAmount, userId, notes } = req.body;
    try {
        yield loanService.settleLoanEarly(loanId, parseFloat(settlementAmount), userId, notes);
        res.json({ message: 'تم تسوية القرض بنجاح' });
    }
    catch (error) {
        console.error('Error settling loan:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'settle loan');
    }
});
exports.settleLoanEarly = settleLoanEarly;
/**
 * Get loan constraints configuration
 */
const getLoanConstraints = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const constraints = yield loanService.getLoanConstraints();
        res.json(constraints);
    }
    catch (error) {
        console.error('Error fetching loan constraints:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch loan constraints');
    }
});
exports.getLoanConstraints = getLoanConstraints;
/**
 * Get loan history/audit trail
 */
const getLoanHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { loanId } = req.params;
    try {
        const [history] = yield db_1.pool.query(`
            SELECT lh.*, u.username as performedByName
            FROM loan_history lh
            LEFT JOIN users u ON lh.performedBy = u.id
            WHERE lh.loanId = ?
            ORDER BY lh.createdAt DESC
        `, [loanId]);
        res.json(history);
    }
    catch (error) {
        console.error('Error fetching loan history:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch loan history');
    }
});
exports.getLoanHistory = getLoanHistory;
// ==========================================
// PAYROLL TEMPLATES (Allowances/Deductions)
// ==========================================
const getPayrollTemplates = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { type } = req.query;
    try {
        let query = `SELECT * FROM payroll_templates WHERE 1=1`;
        const params = [];
        if (type) {
            query += ` AND type = ?`;
            params.push(type);
        }
        query += ` ORDER BY type, name`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching templates:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch templates');
    }
});
exports.getPayrollTemplates = getPayrollTemplates;
const createPayrollTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, type, calculationType, amount, percentage, description, isActive } = req.body;
    try {
        const id = (0, uuid_1.v4)();
        yield db_1.pool.query(`
          INSERT INTO payroll_templates (
            id, name, type, calculationType, amount, percentage, description, isActive
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, name, type, calculationType || 'FIXED',
            amount || 0, percentage || 0, description, isActive !== false
        ]);
        res.status(201).json({ id, message: 'Template created successfully' });
    }
    catch (error) {
        console.error('Error creating template:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create template');
    }
});
exports.createPayrollTemplate = createPayrollTemplate;
const updatePayrollTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, type, calculationType, amount, percentage, description, isActive } = req.body;
    try {
        yield db_1.pool.query(`
          UPDATE payroll_templates SET
            name = ?, type = ?, calculationType = ?, amount = ?,
            percentage = ?, description = ?, isActive = ?
          WHERE id = ?
        `, [name, type, calculationType, amount, percentage, description, isActive, id]);
        res.json({ message: 'Template updated successfully' });
    }
    catch (error) {
        console.error('Error updating template:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update template');
    }
});
exports.updatePayrollTemplate = updatePayrollTemplate;
const deletePayrollTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM payroll_templates WHERE id = ?', [id]);
        res.json({ message: 'Template deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting template:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete template');
    }
});
exports.deletePayrollTemplate = deletePayrollTemplate;
// Assign template to employee
const assignTemplateToEmployee = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, templateId, customAmount } = req.body;
    try {
        const id = (0, uuid_1.v4)();
        yield db_1.pool.query(`
          INSERT INTO employee_payroll_templates (id, employeeId, templateId, customAmount, isActive)
          VALUES (?, ?, ?, ?, TRUE)
          ON DUPLICATE KEY UPDATE customAmount = ?, isActive = TRUE
        `, [id, employeeId, templateId, customAmount, customAmount]);
        res.status(201).json({ id, message: 'Template assigned successfully' });
    }
    catch (error) {
        console.error('Error assigning template:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'assign template');
    }
});
exports.assignTemplateToEmployee = assignTemplateToEmployee;
const getEmployeeTemplates = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId } = req.params;
    try {
        const [rows] = yield db_1.pool.query(`
          SELECT ept.*, pt.name, pt.type, pt.calculationType, pt.amount as templateAmount, pt.percentage
          FROM employee_payroll_templates ept
          JOIN payroll_templates pt ON ept.templateId = pt.id
          WHERE ept.employeeId = ? AND ept.isActive = TRUE
        `, [employeeId]);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching employee templates:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch employee templates');
    }
});
exports.getEmployeeTemplates = getEmployeeTemplates;
const removeEmployeeTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, templateId } = req.params;
    try {
        yield db_1.pool.query(`
          UPDATE employee_payroll_templates SET isActive = FALSE
          WHERE employeeId = ? AND templateId = ?
        `, [employeeId, templateId]);
        res.json({ message: 'Template removed from employee successfully' });
    }
    catch (error) {
        console.error('Error removing template:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'remove template');
    }
});
exports.removeEmployeeTemplate = removeEmployeeTemplate;
const updateEmployeeTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { customAmount, isActive } = req.body;
    try {
        yield db_1.pool.query(`
          UPDATE employee_payroll_templates SET customAmount = ?, isActive = ?
          WHERE id = ?
        `, [customAmount, isActive, id]);
        res.json({ message: 'Template assignment updated successfully' });
    }
    catch (error) {
        console.error('Error updating template assignment:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update template assignment');
    }
});
exports.updateEmployeeTemplate = updateEmployeeTemplate;
// ==========================================
// LEAVE TYPES (أنواع الإجازات)
// ==========================================
const getLeaveTypes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [rows] = yield db_1.pool.query(`
            SELECT * FROM leave_types 
            ORDER BY name
        `);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching leave types:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch leave types');
    }
});
exports.getLeaveTypes = getLeaveTypes;
const createLeaveType = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, nameEn, isPaid, defaultDays, carryOver, maxCarryOverDays, color, requiresDocument } = req.body;
    try {
        const id = (0, uuid_1.v4)();
        yield db_1.pool.query(`
            INSERT INTO leave_types (id, name, nameEn, isPaid, defaultDays, carryOver, maxCarryOverDays, color, isActive, requiresDocument)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
        `, [id, name, nameEn, isPaid !== false, defaultDays || 0, carryOver || false, maxCarryOverDays || 0, color || '#3b82f6', requiresDocument || false]);
        res.status(201).json({ id, message: 'Leave type created successfully' });
    }
    catch (error) {
        console.error('Error creating leave type:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create leave type');
    }
});
exports.createLeaveType = createLeaveType;
const updateLeaveType = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, nameEn, isPaid, defaultDays, carryOver, maxCarryOverDays, color, isActive, requiresDocument } = req.body;
    try {
        yield db_1.pool.query(`
            UPDATE leave_types SET 
                name = ?, nameEn = ?, isPaid = ?, defaultDays = ?, 
                carryOver = ?, maxCarryOverDays = ?, color = ?, isActive = ?, requiresDocument = ?
            WHERE id = ?
        `, [name, nameEn, isPaid, defaultDays, carryOver, maxCarryOverDays, color, isActive, requiresDocument, id]);
        res.json({ message: 'Leave type updated successfully' });
    }
    catch (error) {
        console.error('Error updating leave type:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update leave type');
    }
});
exports.updateLeaveType = updateLeaveType;
const deleteLeaveType = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM leave_types WHERE id = ?', [id]);
        res.json({ message: 'Leave type deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting leave type:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete leave type');
    }
});
exports.deleteLeaveType = deleteLeaveType;
// ==========================================
// LEAVE BALANCES (أرصدة الإجازات)
// ==========================================
const getLeaveBalances = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, year } = req.query;
    const currentYear = year || new Date().getFullYear();
    try {
        let query = `
            SELECT lb.*, e.fullName as employeeName, lt.name as leaveTypeName, lt.color as leaveTypeColor
            FROM leave_balances lb
            JOIN employees e ON lb.employeeId = e.id
            JOIN leave_types lt ON lb.leaveTypeId = lt.id
            WHERE lb.year = ?
        `;
        const params = [currentYear];
        if (employeeId) {
            query += ` AND lb.employeeId = ?`;
            params.push(employeeId);
        }
        query += ` ORDER BY e.fullName, lt.name`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching leave balances:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch leave balances');
    }
});
exports.getLeaveBalances = getLeaveBalances;
const initializeLeaveBalances = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { year } = req.body;
    const targetYear = year || new Date().getFullYear();
    try {
        // Get all active employees and leave types
        const [employees] = yield db_1.pool.query('SELECT id FROM employees WHERE status = ?', ['ACTIVE']);
        const [leaveTypes] = yield db_1.pool.query('SELECT id, defaultDays FROM leave_types WHERE isActive = TRUE');
        let created = 0;
        for (const emp of employees) {
            for (const lt of leaveTypes) {
                // Check if balance already exists
                const [existing] = yield db_1.pool.query(`
                    SELECT id FROM leave_balances WHERE employeeId = ? AND leaveTypeId = ? AND year = ?
                `, [emp.id, lt.id, targetYear]);
                if (existing.length === 0) {
                    const id = (0, uuid_1.v4)();
                    yield db_1.pool.query(`
                        INSERT INTO leave_balances (id, employeeId, leaveTypeId, year, allocated, used, carriedOver)
                        VALUES (?, ?, ?, ?, ?, 0, 0)
                    `, [id, emp.id, lt.id, targetYear, lt.defaultDays || 0]);
                    created++;
                }
            }
        }
        res.json({ message: `Initialized ${created} leave balances for year ${targetYear}` });
    }
    catch (error) {
        console.error('Error initializing leave balances:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'initialize leave balances');
    }
});
exports.initializeLeaveBalances = initializeLeaveBalances;
const updateLeaveBalance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { allocated, carriedOver } = req.body;
    try {
        yield db_1.pool.query(`
            UPDATE leave_balances SET allocated = ?, carriedOver = ?
            WHERE id = ?
        `, [allocated, carriedOver || 0, id]);
        res.json({ message: 'Balance updated successfully' });
    }
    catch (error) {
        console.error('Error updating leave balance:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update leave balance');
    }
});
exports.updateLeaveBalance = updateLeaveBalance;
// ==========================================
// LEAVE REQUESTS (طلبات الإجازات)
// ==========================================
const getLeaveRequests = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, status, startDate, endDate } = req.query;
    try {
        let query = `
            SELECT lr.*, e.fullName as employeeName, e.jobTitle, e.department,
                   lt.name as leaveTypeName, lt.color as leaveTypeColor, lt.isPaid,
                   u.name as approvedByName
            FROM leave_requests lr
            JOIN employees e ON lr.employeeId = e.id
            JOIN leave_types lt ON lr.leaveTypeId = lt.id
            LEFT JOIN users u ON lr.approvedBy = u.id
            WHERE 1=1
        `;
        const params = [];
        if (employeeId) {
            query += ` AND lr.employeeId = ?`;
            params.push(employeeId);
        }
        if (status) {
            query += ` AND lr.status = ?`;
            params.push(status);
        }
        if (startDate && endDate) {
            query += ` AND ((lr.startDate BETWEEN ? AND ?) OR (lr.endDate BETWEEN ? AND ?))`;
            params.push(startDate, endDate, startDate, endDate);
        }
        query += ` ORDER BY lr.createdAt DESC`;
        const [rows] = yield db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching leave requests:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch leave requests');
    }
});
exports.getLeaveRequests = getLeaveRequests;
const createLeaveRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId, leaveTypeId, startDate, endDate, days, reason, notes } = req.body;
    try {
        const id = (0, uuid_1.v4)();
        yield db_1.pool.query(`
            INSERT INTO leave_requests (id, employeeId, leaveTypeId, startDate, endDate, days, reason, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
        `, [id, employeeId, leaveTypeId, startDate, endDate, days, reason, notes]);
        res.status(201).json({ id, message: 'Leave request created successfully' });
    }
    catch (error) {
        console.error('Error creating leave request:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create leave request');
    }
});
exports.createLeaveRequest = createLeaveRequest;
const approveLeaveRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    try {
        // Get leave request details
        const [requests] = yield db_1.pool.query(`
            SELECT lr.*, lt.isPaid FROM leave_requests lr
            JOIN leave_types lt ON lr.leaveTypeId = lt.id
            WHERE lr.id = ?
        `, [id]);
        if (requests.length === 0) {
            return res.status(404).json({ error: 'Leave request not found' });
        }
        const request = requests[0];
        const year = new Date(request.startDate).getFullYear();
        // Update leave balance (deduct used days)
        yield db_1.pool.query(`
            UPDATE leave_balances SET used = used + ?
            WHERE employeeId = ? AND leaveTypeId = ? AND year = ?
        `, [request.days, request.employeeId, request.leaveTypeId, year]);
        // Update request status
        yield db_1.pool.query(`
            UPDATE leave_requests SET status = 'APPROVED', approvedBy = ?, approvedAt = NOW()
            WHERE id = ?
        `, [userId, id]);
        res.json({ message: 'Leave request approved successfully' });
    }
    catch (error) {
        console.error('Error approving leave request:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'approve leave request');
    }
});
exports.approveLeaveRequest = approveLeaveRequest;
const rejectLeaveRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    try {
        yield db_1.pool.query(`
            UPDATE leave_requests SET status = 'REJECTED', approvedBy = ?, approvedAt = NOW(), rejectionReason = ?
            WHERE id = ?
        `, [userId, rejectionReason, id]);
        res.json({ message: 'Leave request rejected' });
    }
    catch (error) {
        console.error('Error rejecting leave request:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'reject leave request');
    }
});
exports.rejectLeaveRequest = rejectLeaveRequest;
const cancelLeaveRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        // Get request details to reverse balance if already approved
        const [requests] = yield db_1.pool.query(`SELECT * FROM leave_requests WHERE id = ?`, [id]);
        if (requests.length === 0)
            return res.status(404).json({ error: 'Request not found' });
        const request = requests[0];
        if (request.status === 'APPROVED') {
            const year = new Date(request.startDate).getFullYear();
            // Restore balance
            yield db_1.pool.query(`
                UPDATE leave_balances SET used = used - ?
                WHERE employeeId = ? AND leaveTypeId = ? AND year = ?
            `, [request.days, request.employeeId, request.leaveTypeId, year]);
        }
        yield db_1.pool.query(`UPDATE leave_requests SET status = 'CANCELLED' WHERE id = ?`, [id]);
        res.json({ message: 'Leave request cancelled' });
    }
    catch (error) {
        console.error('Error cancelling leave request:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'cancel leave request');
    }
});
exports.cancelLeaveRequest = cancelLeaveRequest;
const deleteLeaveRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM leave_requests WHERE id = ? AND status = ?', [id, 'PENDING']);
        res.json({ message: 'Leave request deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting leave request:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete leave request');
    }
});
exports.deleteLeaveRequest = deleteLeaveRequest;
// ==========================================
// SALARY COMPONENTS & STRUCTURE (Phase 2)
// ==========================================
const salaryService = __importStar(require("../services/salaryService"));
const taxService = __importStar(require("../services/taxService"));
// Get all salary components
const getSalaryComponents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const components = yield salaryService.getActiveSalaryComponents();
        res.json(components);
    }
    catch (error) {
        console.error('Error fetching salary components:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch salary components');
    }
});
exports.getSalaryComponents = getSalaryComponents;
// Get employee's salary structure
const getEmployeeSalaryStructure = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId } = req.params;
    const { date } = req.query;
    try {
        const effectiveDate = date ? new Date(date) : new Date();
        const structure = yield salaryService.getEmployeeSalaryStructure(employeeId, effectiveDate);
        res.json(structure);
    }
    catch (error) {
        console.error('Error fetching employee salary structure:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch employee salary structure');
    }
});
exports.getEmployeeSalaryStructure = getEmployeeSalaryStructure;
// Set employee salary component
const setEmployeeSalaryComponent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId } = req.params;
    const { componentId, amount, effectiveFrom, calculationType, percentage, customFormula, notes } = req.body;
    try {
        const id = yield salaryService.setEmployeeSalaryComponent(employeeId, componentId, amount, new Date(effectiveFrom), { calculationType, percentage, customFormula, notes });
        res.json({ id, message: 'Salary component updated successfully' });
    }
    catch (error) {
        console.error('Error setting salary component:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'set salary component');
    }
});
exports.setEmployeeSalaryComponent = setEmployeeSalaryComponent;
// Calculate tax preview for an employee
const calculateTaxPreview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { annualIncome, annualInsurance, personalExemption } = req.body;
    try {
        const result = yield taxService.calculateEgyptianIncomeTax(parseFloat(annualIncome) || 0, parseFloat(annualInsurance) || 0, parseFloat(personalExemption) || 15000);
        res.json(result);
    }
    catch (error) {
        console.error('Error calculating tax preview:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'calculate tax preview');
    }
});
exports.calculateTaxPreview = calculateTaxPreview;
// Get Egyptian tax brackets
const getTaxBrackets = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { year } = req.query;
    try {
        const brackets = yield taxService.getTaxBrackets(year ? parseInt(year) : new Date().getFullYear());
        res.json(brackets);
    }
    catch (error) {
        console.error('Error fetching tax brackets:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch tax brackets');
    }
});
exports.getTaxBrackets = getTaxBrackets;
// Get insurance configuration
const getInsuranceConfig = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const config = yield taxService.getActiveInsuranceConfig();
        res.json(config);
    }
    catch (error) {
        console.error('Error fetching insurance config:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch insurance config');
    }
});
exports.getInsuranceConfig = getInsuranceConfig;
// Calculate full payroll preview for an employee
const calculatePayrollPreview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId } = req.params;
    const { employee, attendance, loanDeductions } = req.body;
    try {
        const result = yield salaryService.calculateEmployeePayroll(employeeId, employee, attendance || {}, loanDeductions || 0);
        res.json(result);
    }
    catch (error) {
        console.error('Error calculating payroll preview:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'calculate payroll preview');
    }
});
exports.calculatePayrollPreview = calculatePayrollPreview;
// Create default salary structure from existing employee data
const migrateEmployeeSalaryStructure = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId } = req.params;
    try {
        // Get employee's current salary
        const [employees] = yield db_1.pool.query('SELECT baseSalary, variableSalary FROM employees WHERE id = ?', [employeeId]);
        if (employees.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const emp = employees[0];
        yield salaryService.createDefaultSalaryStructure(employeeId, parseFloat(emp.baseSalary) || 0, parseFloat(emp.variableSalary) || 0);
        res.json({ message: 'Salary structure created successfully' });
    }
    catch (error) {
        console.error('Error migrating salary structure:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'migrate salary structure');
    }
});
exports.migrateEmployeeSalaryStructure = migrateEmployeeSalaryStructure;
// ==========================================
// RETROACTIVE ADJUSTMENTS (Phase 2)
// ==========================================
const retroactiveService = __importStar(require("../services/retroactiveService"));
const treasuryService = __importStar(require("../services/treasuryService"));
// Calculate retroactive adjustment preview
const calculateRetroactiveAdjustment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId } = req.params;
    const { newBaseSalary, effectiveFromMonth, effectiveFromYear, currentMonth, currentYear } = req.body;
    try {
        const result = yield retroactiveService.calculateRetroactiveAdjustment(employeeId, parseFloat(newBaseSalary), parseInt(effectiveFromMonth), parseInt(effectiveFromYear), currentMonth ? parseInt(currentMonth) : undefined, currentYear ? parseInt(currentYear) : undefined);
        res.json(result);
    }
    catch (error) {
        console.error('Error calculating retroactive adjustment:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'calculate retroactive adjustment');
    }
});
exports.calculateRetroactiveAdjustment = calculateRetroactiveAdjustment;
// Create retroactive adjustment
const createRetroactiveAdjustment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { calculation, payrollCycleId, applyImmediately } = req.body;
    const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'system';
    try {
        const id = yield retroactiveService.createRetroactiveAdjustment(calculation, payrollCycleId, userId, applyImmediately || false);
        res.json({ id, message: 'Retroactive adjustment created successfully' });
    }
    catch (error) {
        console.error('Error creating retroactive adjustment:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create retroactive adjustment');
    }
});
exports.createRetroactiveAdjustment = createRetroactiveAdjustment;
// Get pending adjustments for employee
const getPendingAdjustments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeId } = req.params;
    try {
        const adjustments = yield retroactiveService.getPendingAdjustments(employeeId);
        res.json(adjustments);
    }
    catch (error) {
        console.error('Error fetching pending adjustments:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch pending adjustments');
    }
});
exports.getPendingAdjustments = getPendingAdjustments;
// Approve adjustment
const approveAdjustment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { adjustmentId } = req.params;
    const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'system';
    try {
        yield retroactiveService.approveAdjustment(adjustmentId, userId);
        res.json({ message: 'Adjustment approved successfully' });
    }
    catch (error) {
        console.error('Error approving adjustment:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'approve adjustment');
    }
});
exports.approveAdjustment = approveAdjustment;
// Apply adjustment to payroll
const applyAdjustmentToPayroll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { adjustmentId } = req.params;
    try {
        yield retroactiveService.applyAdjustmentToPayroll(adjustmentId);
        res.json({ message: 'Adjustment applied to payroll successfully' });
    }
    catch (error) {
        console.error('Error applying adjustment:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'apply adjustment');
    }
});
exports.applyAdjustmentToPayroll = applyAdjustmentToPayroll;
// ==========================================
// TREASURY VERIFICATION (Phase 2)
// ==========================================
// Preflight check before payroll approval
const preflightPayrollApproval = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { cycleId } = req.params;
    try {
        const result = yield treasuryService.preflightPayrollApproval(cycleId);
        res.json(result);
    }
    catch (error) {
        console.error('Error running preflight check:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'preflight payroll approval');
    }
});
exports.preflightPayrollApproval = preflightPayrollApproval;
// Get treasury balance
const getTreasuryBalance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield treasuryService.getTreasuryBalance();
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching treasury balance:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetch treasury balance');
    }
});
exports.getTreasuryBalance = getTreasuryBalance;
// Verify treasury for specific payroll
const verifyTreasuryForPayroll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { cycleId } = req.params;
    const { safetyMarginPercent } = req.query;
    try {
        const result = yield treasuryService.verifyTreasuryForPayroll(cycleId, safetyMarginPercent ? parseFloat(safetyMarginPercent) : undefined);
        res.json(result);
    }
    catch (error) {
        console.error('Error verifying treasury:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'verify treasury for payroll');
    }
});
exports.verifyTreasuryForPayroll = verifyTreasuryForPayroll;
// ==========================================
// SALARY COMPONENT ACTIONS (Phase 2.5)
// ==========================================
const createSalaryComponent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = yield salaryService.createSalaryComponent(req.body);
        res.status(201).json({ id, message: 'Salary component created successfully' });
    }
    catch (error) {
        console.error('Error creating salary component:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'create salary component');
    }
});
exports.createSalaryComponent = createSalaryComponent;
const updateSalaryComponent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield salaryService.updateSalaryComponent(id, req.body);
        res.json({ message: 'Salary component updated successfully' });
    }
    catch (error) {
        console.error('Error updating salary component:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'update salary component');
    }
});
exports.updateSalaryComponent = updateSalaryComponent;
const deleteSalaryComponent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield salaryService.deleteSalaryComponent(id);
        res.json({ message: 'Salary component deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting salary component:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'delete salary component');
    }
});
exports.deleteSalaryComponent = deleteSalaryComponent;
