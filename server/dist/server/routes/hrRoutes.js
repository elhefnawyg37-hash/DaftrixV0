"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const hrController_1 = require("../controllers/hrController");
const router = express_1.default.Router();
// Employees
router.get('/employees', hrController_1.getEmployees);
router.post('/employees', hrController_1.createEmployee);
router.put('/employees/:id', hrController_1.updateEmployee);
router.delete('/employees/:id', hrController_1.deleteEmployee);
// Attendance
router.get('/attendance', hrController_1.getAttendance);
router.post('/attendance', hrController_1.recordAttendance);
// Payroll
router.get('/payroll', hrController_1.getPayrollCycles);
router.post('/payroll', hrController_1.createPayrollCycle);
router.get('/payroll/:payrollId/entries', hrController_1.getPayrollEntries);
router.delete('/payroll/:id', hrController_1.deletePayrollCycle);
router.post('/payroll/:id/calculate', hrController_1.calculatePayroll);
router.post('/payroll/:id/approve', hrController_1.approvePayroll);
router.put('/payroll/entry/:entryId', hrController_1.updatePayrollEntry);
// Advances / Loans
router.get('/advances', hrController_1.getAdvances);
router.post('/advances', hrController_1.createAdvance);
router.put('/advances/:id', hrController_1.updateAdvance);
router.delete('/advances/:id', hrController_1.deleteAdvance);
// Smart Loans (New)
router.post('/loans/check-eligibility', hrController_1.checkLoanEligibility);
router.post('/loans', hrController_1.createLoanWithInstallments);
router.get('/loans/:loanId/installments', hrController_1.getLoanInstallments);
router.post('/loans/installments/:installmentId/skip', hrController_1.skipLoanInstallment);
router.post('/loans/:loanId/settle', hrController_1.settleLoanEarly);
router.get('/loans/constraints', hrController_1.getLoanConstraints);
router.get('/loans/:loanId/history', hrController_1.getLoanHistory);
// Payroll Templates (Allowances/Deductions)
router.get('/templates', hrController_1.getPayrollTemplates);
router.post('/templates', hrController_1.createPayrollTemplate);
router.put('/templates/:id', hrController_1.updatePayrollTemplate);
router.delete('/templates/:id', hrController_1.deletePayrollTemplate);
// Employee-Template Assignments
router.get('/employees/:employeeId/templates', hrController_1.getEmployeeTemplates);
router.post('/employees/templates', hrController_1.assignTemplateToEmployee);
router.put('/employees/templates/:id', hrController_1.updateEmployeeTemplate);
router.delete('/employees/:employeeId/templates/:templateId', hrController_1.removeEmployeeTemplate);
// Leave Types (أنواع الإجازات)
router.get('/leave-types', hrController_1.getLeaveTypes);
router.post('/leave-types', hrController_1.createLeaveType);
router.put('/leave-types/:id', hrController_1.updateLeaveType);
router.delete('/leave-types/:id', hrController_1.deleteLeaveType);
// Leave Balances (أرصدة الإجازات)
router.get('/leave-balances', hrController_1.getLeaveBalances);
router.post('/leave-balances/initialize', hrController_1.initializeLeaveBalances);
router.put('/leave-balances/:id', hrController_1.updateLeaveBalance);
// Leave Requests (طلبات الإجازات)
router.get('/leave-requests', hrController_1.getLeaveRequests);
router.post('/leave-requests', hrController_1.createLeaveRequest);
router.post('/leave-requests/:id/approve', hrController_1.approveLeaveRequest);
router.post('/leave-requests/:id/reject', hrController_1.rejectLeaveRequest);
router.post('/leave-requests/:id/cancel', hrController_1.cancelLeaveRequest);
router.delete('/leave-requests/:id', hrController_1.deleteLeaveRequest);
// Salary Components & Structure (Phase 2 - Formula-Based Payroll)
router.get('/salary-components', hrController_1.getSalaryComponents);
router.post('/salary-components', hrController_1.createSalaryComponent);
router.put('/salary-components/:id', hrController_1.updateSalaryComponent);
router.delete('/salary-components/:id', hrController_1.deleteSalaryComponent);
router.get('/employees/:employeeId/salary-structure', hrController_1.getEmployeeSalaryStructure);
router.post('/employees/:employeeId/salary-structure', hrController_1.setEmployeeSalaryComponent);
router.post('/employees/:employeeId/salary-structure/migrate', hrController_1.migrateEmployeeSalaryStructure);
router.post('/payroll/:employeeId/preview', hrController_1.calculatePayrollPreview);
// Tax & Insurance Configuration
router.get('/tax-brackets', hrController_1.getTaxBrackets);
router.post('/tax/calculate', hrController_1.calculateTaxPreview);
router.get('/insurance-config', hrController_1.getInsuranceConfig);
// Retroactive Adjustments (Phase 2)
router.post('/employees/:employeeId/retroactive/calculate', hrController_1.calculateRetroactiveAdjustment);
router.post('/retroactive-adjustments', hrController_1.createRetroactiveAdjustment);
router.get('/employees/:employeeId/adjustments/pending', hrController_1.getPendingAdjustments);
router.post('/adjustments/:adjustmentId/approve', hrController_1.approveAdjustment);
router.post('/adjustments/:adjustmentId/apply', hrController_1.applyAdjustmentToPayroll);
// Treasury Verification (Phase 2)
router.get('/payroll/:cycleId/preflight', hrController_1.preflightPayrollApproval);
router.get('/treasury/balance', hrController_1.getTreasuryBalance);
router.get('/payroll/:cycleId/verify-treasury', hrController_1.verifyTreasuryForPayroll);
exports.default = router;
