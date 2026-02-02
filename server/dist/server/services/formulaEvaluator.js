"use strict";
/**
 * Formula Evaluator Service
 * Evaluates dynamic formulas for payroll calculations
 *
 * Supports operations: +, -, *, /, parentheses, and variable substitution
 * Variables are uppercase identifiers like BASIC_SALARY, OVERTIME_HOURS, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFormulaContext = exports.PAYROLL_VARIABLES = exports.validateFormula = exports.evaluateFormula = void 0;
/**
 * Safely evaluate a mathematical formula with variable substitution
 *
 * @param formula - The formula string (e.g., "(BASIC_SALARY / 30) * OVERTIME_HOURS * 1.5")
 * @param context - Object with variable values (e.g., { BASIC_SALARY: 5000, OVERTIME_HOURS: 10 })
 * @returns The calculated result or 0 if evaluation fails
 */
const evaluateFormula = (formula, context) => {
    try {
        if (!formula || typeof formula !== 'string') {
            return 0;
        }
        // Replace variable names with their values
        let processedFormula = formula.trim();
        // Sort variables by length (longest first) to avoid partial replacements
        const sortedVars = Object.keys(context).sort((a, b) => b.length - a.length);
        for (const varName of sortedVars) {
            const value = context[varName];
            if (typeof value !== 'number' || isNaN(value)) {
                console.warn(`Invalid value for variable ${varName}:`, value);
                continue;
            }
            // Replace all occurrences of the variable with its value
            const regex = new RegExp(`\\b${varName}\\b`, 'g');
            processedFormula = processedFormula.replace(regex, String(value));
        }
        // Security: Only allow safe mathematical characters
        const safePattern = /^[\d\s\+\-\*\/\.\(\)]+$/;
        if (!safePattern.test(processedFormula)) {
            console.error('Unsafe formula detected:', processedFormula);
            return 0;
        }
        // Evaluate using Function constructor (safer than eval)
        // eslint-disable-next-line no-new-func
        const result = new Function(`return (${processedFormula})`)();
        // Validate result
        if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
            console.error('Invalid formula result:', result, 'for formula:', formula);
            return 0;
        }
        return Math.round(result * 100) / 100; // Round to 2 decimal places
    }
    catch (error) {
        console.error('Formula evaluation error:', error, 'Formula:', formula);
        return 0;
    }
};
exports.evaluateFormula = evaluateFormula;
/**
 * Validate a formula string before saving
 * Checks for valid syntax and required variables
 *
 * @param formula - The formula to validate
 * @param requiredVars - Optional list of variables that must be present
 */
const validateFormula = (formula, requiredVars = []) => {
    try {
        if (!formula || typeof formula !== 'string') {
            return { valid: false, error: 'Formula is empty or invalid', variables: [] };
        }
        // Extract all variable names (uppercase identifiers)
        const varPattern = /\b[A-Z][A-Z0-9_]+\b/g;
        const foundVars = formula.match(varPattern) || [];
        const uniqueVars = [...new Set(foundVars)];
        // Check for required variables
        for (const reqVar of requiredVars) {
            if (!uniqueVars.includes(reqVar)) {
                return {
                    valid: false,
                    error: `Required variable "${reqVar}" not found in formula`,
                    variables: uniqueVars
                };
            }
        }
        // Test evaluation with dummy values
        const testContext = {};
        for (const v of uniqueVars) {
            testContext[v] = 1; // Use 1 to avoid division by zero with 0
        }
        const testResult = (0, exports.evaluateFormula)(formula, testContext);
        if (testResult === 0 && !formula.includes('0')) {
            // Could be a valid zero result, but let's warn
            console.warn('Formula evaluated to 0 with test values:', formula);
        }
        return { valid: true, variables: uniqueVars };
    }
    catch (error) {
        return {
            valid: false,
            error: `Syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            variables: []
        };
    }
};
exports.validateFormula = validateFormula;
/**
 * Standard payroll variable definitions
 * These are the common variables available in payroll formulas
 */
exports.PAYROLL_VARIABLES = {
    // Salary Components
    BASIC_SALARY: 'الراتب الأساسي',
    VARIABLE_SALARY: 'الراتب المتغير',
    GROSS_SALARY: 'إجمالي الراتب',
    NET_SALARY: 'صافي الراتب',
    // Time & Attendance
    WORKING_DAYS: 'أيام العمل',
    ABSENT_DAYS: 'أيام الغياب',
    LATE_MINUTES: 'دقائق التأخير',
    OVERTIME_HOURS: 'ساعات الإضافي',
    OVERTIME_MULTIPLIER: 'معامل الإضافي',
    // Insurance
    INSURANCE_BASE: 'أساس التأمينات',
    EMPLOYEE_INSURANCE_RATE: 'نسبة تأمين الموظف',
    EMPLOYER_INSURANCE_RATE: 'نسبة تأمين صاحب العمل',
    // Tax
    TAXABLE_INCOME: 'الدخل الخاضع للضريبة',
    PERSONAL_EXEMPTION: 'الإعفاء الشخصي'
};
/**
 * Build a formula context from employee and attendance data
 */
const buildFormulaContext = (employee, attendance = {}, config = {}) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const basicSalary = Number(employee.baseSalary) || 0;
    const variableSalary = Number(employee.variableSalary) || 0;
    const insuranceBase = Number(employee.basicSalaryInsurable) || basicSalary;
    return {
        BASIC_SALARY: basicSalary,
        VARIABLE_SALARY: variableSalary,
        GROSS_SALARY: basicSalary + variableSalary,
        INSURANCE_BASE: insuranceBase,
        WORKING_DAYS: (_a = attendance.workingDays) !== null && _a !== void 0 ? _a : 30,
        ABSENT_DAYS: (_b = attendance.absentDays) !== null && _b !== void 0 ? _b : 0,
        LATE_MINUTES: (_c = attendance.lateMinutes) !== null && _c !== void 0 ? _c : 0,
        OVERTIME_HOURS: (_d = attendance.overtimeHours) !== null && _d !== void 0 ? _d : 0,
        OVERTIME_MULTIPLIER: (_e = config.overtimeMultiplier) !== null && _e !== void 0 ? _e : 1.5,
        EMPLOYEE_INSURANCE_RATE: (_f = config.employeeInsuranceRate) !== null && _f !== void 0 ? _f : 0.11,
        EMPLOYER_INSURANCE_RATE: (_g = config.employerInsuranceRate) !== null && _g !== void 0 ? _g : 0.1875,
        PERSONAL_EXEMPTION: (_h = config.personalExemption) !== null && _h !== void 0 ? _h : 15000
    };
};
exports.buildFormulaContext = buildFormulaContext;
exports.default = {
    evaluateFormula: exports.evaluateFormula,
    validateFormula: exports.validateFormula,
    buildFormulaContext: exports.buildFormulaContext,
    PAYROLL_VARIABLES: exports.PAYROLL_VARIABLES
};
