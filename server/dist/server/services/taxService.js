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
exports.calculateMonthlyTaxWithYTD = exports.calculateSocialInsurance = exports.calculateEgyptianIncomeTax = exports.getTaxBrackets = exports.getActiveInsuranceConfig = void 0;
const db_1 = require("../db");
/**
 * Get the current active insurance configuration
 */
const getActiveInsuranceConfig = () => __awaiter(void 0, void 0, void 0, function* () {
    const [rows] = yield db_1.pool.query(`
    SELECT minInsurableSalary, maxInsurableSalary, employeeRate, employerRate 
    FROM insurance_config 
    WHERE isActive = 1 
      AND effectiveFrom <= CURRENT_DATE
      AND (effectiveTo IS NULL OR effectiveTo >= CURRENT_DATE)
    ORDER BY effectiveFrom DESC 
    LIMIT 1
  `);
    return rows[0] || null;
});
exports.getActiveInsuranceConfig = getActiveInsuranceConfig;
/**
 * Get Egyptian tax brackets for a given year
 */
const getTaxBrackets = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (year = new Date().getFullYear()) {
    const [brackets] = yield db_1.pool.query(`
    SELECT lowerLimit, upperLimit, rate, displayOrder, notes
    FROM egyptian_tax_brackets 
    WHERE yearFrom <= ? 
      AND (yearTo IS NULL OR yearTo >= ?)
    ORDER BY displayOrder ASC
  `, [year, year]);
    return brackets;
});
exports.getTaxBrackets = getTaxBrackets;
/**
 * Calculate Egyptian income tax using progressive brackets
 *
 * @param annualGrossIncome - Total annual taxable income
 * @param annualInsurance - Annual social insurance deductions (exempt from tax)
 * @param personalExemption - Personal tax exemption (default: 15000 EGP)
 * @param year - Tax year for bracket lookup
 */
const calculateEgyptianIncomeTax = (annualGrossIncome_1, ...args_1) => __awaiter(void 0, [annualGrossIncome_1, ...args_1], void 0, function* (annualGrossIncome, annualInsurance = 0, personalExemption = 15000, year = new Date().getFullYear()) {
    // Step 1: Calculate taxable income after exemptions
    const taxableIncome = Math.max(0, annualGrossIncome - annualInsurance - personalExemption);
    // Step 2: Get tax brackets
    const brackets = yield (0, exports.getTaxBrackets)(year);
    if (!brackets || brackets.length === 0) {
        console.warn('No tax brackets found for year:', year);
        return {
            annualTax: 0,
            monthlyTax: 0,
            effectiveRate: 0,
            breakdown: []
        };
    }
    // Step 3: Calculate tax progressively
    let remainingIncome = taxableIncome;
    let totalTax = 0;
    const breakdown = [];
    for (const bracket of brackets) {
        if (remainingIncome <= 0)
            break;
        const bracketStart = parseFloat(bracket.lowerLimit);
        const bracketEnd = bracket.upperLimit ? parseFloat(bracket.upperLimit) : Infinity;
        const bracketRate = parseFloat(bracket.rate);
        const bracketSize = bracketEnd - bracketStart;
        // Calculate how much of the remaining income falls in this bracket
        const taxableInBracket = Math.min(remainingIncome, bracketSize);
        // Only tax if we're above this bracket's start
        if (taxableIncome > bracketStart) {
            const bracketTax = taxableInBracket * (bracketRate / 100);
            totalTax += bracketTax;
            if (taxableInBracket > 0) {
                breakdown.push({
                    bracket: `${bracketStart.toLocaleString()} - ${bracketEnd === Infinity ? '∞' : bracketEnd.toLocaleString()} EGP`,
                    taxableAmount: Math.round(taxableInBracket * 100) / 100,
                    rate: bracketRate,
                    tax: Math.round(bracketTax * 100) / 100
                });
            }
            remainingIncome -= taxableInBracket;
        }
    }
    // Calculate monthly tax and effective rate
    const monthlyTax = Math.round((totalTax / 12) * 100) / 100;
    const effectiveRate = taxableIncome > 0
        ? Math.round((totalTax / taxableIncome) * 10000) / 100
        : 0;
    return {
        annualTax: Math.round(totalTax * 100) / 100,
        monthlyTax,
        effectiveRate,
        breakdown
    };
});
exports.calculateEgyptianIncomeTax = calculateEgyptianIncomeTax;
/**
 * Calculate social insurance contributions
 *
 * @param basicSalary - Basic insurable salary (أساسي التأمينات)
 * @param variableSalary - Variable salary (متغير - usually exempt)
 */
const calculateSocialInsurance = (basicSalary_1, ...args_1) => __awaiter(void 0, [basicSalary_1, ...args_1], void 0, function* (basicSalary, variableSalary = 0) {
    const config = yield (0, exports.getActiveInsuranceConfig)();
    if (!config) {
        console.warn('No active insurance configuration found');
        return {
            insuranceBase: 0,
            employeeContribution: 0,
            employerContribution: 0,
            totalContribution: 0
        };
    }
    // Apply min/max caps to insurance base
    // Insurance is typically calculated on basic salary only, capped at min/max
    const insuranceBase = Math.max(config.minInsurableSalary, Math.min(basicSalary, config.maxInsurableSalary));
    // Calculate contributions
    const employeeContribution = Math.round(insuranceBase * (config.employeeRate / 100) * 100) / 100;
    const employerContribution = Math.round(insuranceBase * (config.employerRate / 100) * 100) / 100;
    return {
        insuranceBase,
        employeeContribution,
        employerContribution,
        totalContribution: employeeContribution + employerContribution
    };
});
exports.calculateSocialInsurance = calculateSocialInsurance;
/**
 * Calculate monthly tax deduction considering cumulative income
 * This is useful for year-to-date tax calculation adjustments
 *
 * @param monthlyIncome - Current month's taxable income
 * @param ytdIncome - Year-to-date income (excluding current month)
 * @param ytdTaxPaid - Year-to-date tax already paid
 * @param monthNumber - Current month (1-12)
 */
const calculateMonthlyTaxWithYTD = (monthlyIncome_1, ...args_1) => __awaiter(void 0, [monthlyIncome_1, ...args_1], void 0, function* (monthlyIncome, ytdIncome = 0, ytdTaxPaid = 0, monthNumber = new Date().getMonth() + 1) {
    // Project annual income
    const remainingMonths = 12 - monthNumber + 1;
    const projectedAnnualIncome = ytdIncome + (monthlyIncome * remainingMonths);
    // Calculate annual tax on projected income
    const { annualTax } = yield (0, exports.calculateEgyptianIncomeTax)(projectedAnnualIncome);
    // Calculate what YTD tax should have been
    const ytdShouldBe = (annualTax / 12) * (monthNumber - 1);
    // Calculate adjustment if there's a difference
    const adjustment = ytdShouldBe - ytdTaxPaid;
    // Current month's tax
    const monthlyTax = (annualTax / 12) + (adjustment > 0 ? adjustment / remainingMonths : 0);
    return {
        monthlyTax: Math.max(0, Math.round(monthlyTax * 100) / 100),
        ytdTax: ytdTaxPaid + monthlyTax,
        adjustment: Math.round(adjustment * 100) / 100
    };
});
exports.calculateMonthlyTaxWithYTD = calculateMonthlyTaxWithYTD;
exports.default = {
    calculateEgyptianIncomeTax: exports.calculateEgyptianIncomeTax,
    calculateSocialInsurance: exports.calculateSocialInsurance,
    calculateMonthlyTaxWithYTD: exports.calculateMonthlyTaxWithYTD,
    getTaxBrackets: exports.getTaxBrackets,
    getActiveInsuranceConfig: exports.getActiveInsuranceConfig
};
