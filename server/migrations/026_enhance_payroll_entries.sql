
-- Migration: Enhanced Payroll Entries with Detailed Fields
-- Adds comprehensive payroll fields for manual mode editing

-- Add new columns to payroll_entries table
ALTER TABLE payroll_entries
  ADD COLUMN IF NOT EXISTS dailyRate DECIMAL(15, 2) DEFAULT 0 COMMENT 'قيمة وحدة اليوم' AFTER baseSalary,
  ADD COLUMN IF NOT EXISTS overtimeRate DECIMAL(15, 2) DEFAULT 0 COMMENT 'قيمة وحدة الأوفرتايم' AFTER dailyRate,
  ADD COLUMN IF NOT EXISTS overtimeHours DECIMAL(6, 2) DEFAULT 0 COMMENT 'عدد ساعات الأوفرتايم' AFTER overtimeRate,
  ADD COLUMN IF NOT EXISTS overtimeAmount DECIMAL(15, 2) DEFAULT 0 COMMENT 'قيمة الأوفرتايم' AFTER overtimeHours,
  ADD COLUMN IF NOT EXISTS incentives DECIMAL(15, 2) DEFAULT 0 COMMENT 'الحوافز' AFTER overtimeAmount,
  ADD COLUMN IF NOT EXISTS bonus DECIMAL(15, 2) DEFAULT 0 COMMENT 'مكافأة' AFTER incentives,
  ADD COLUMN IF NOT EXISTS grossSalary DECIMAL(15, 2) DEFAULT 0 COMMENT 'إجمالي الراتب' AFTER allowances,
  ADD COLUMN IF NOT EXISTS purchases DECIMAL(15, 2) DEFAULT 0 COMMENT 'المشتريات' AFTER grossSalary,
  ADD COLUMN IF NOT EXISTS absenceDays DECIMAL(6, 2) DEFAULT 0 COMMENT 'أيام الغياب' AFTER advances,
  ADD COLUMN IF NOT EXISTS absenceAmount DECIMAL(15, 2) DEFAULT 0 COMMENT 'قيمة الغيابات' AFTER absenceDays,
  ADD COLUMN IF NOT EXISTS hourDeductions DECIMAL(15, 2) DEFAULT 0 COMMENT 'خصومات/ساعات' AFTER absenceAmount,
  ADD COLUMN IF NOT EXISTS penaltyDays DECIMAL(6, 2) DEFAULT 0 COMMENT 'أيام الجزاءات' AFTER hourDeductions,
  ADD COLUMN IF NOT EXISTS penalties DECIMAL(15, 2) DEFAULT 0 COMMENT 'الجزاءات' AFTER penaltyDays,
  ADD COLUMN IF NOT EXISTS totalDeductions DECIMAL(15, 2) DEFAULT 0 COMMENT 'إجمالي الاستقطاعات' AFTER deductions;

-- Add employee contact fields if not exist
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50) AFTER address,
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) AFTER phone,
  ADD COLUMN IF NOT EXISTS address TEXT AFTER hireDate;

-- Create employee advances table for loan/advance tracking
CREATE TABLE IF NOT EXISTS employee_advances (
  id VARCHAR(36) PRIMARY KEY,
  employeeId VARCHAR(36) NOT NULL,
  type ENUM('ADVANCE', 'LOAN') DEFAULT 'ADVANCE',
  amount DECIMAL(15, 2) NOT NULL,
  reason TEXT,
  issueDate DATE NOT NULL,
  monthlyDeduction DECIMAL(15, 2) DEFAULT 0 COMMENT 'Monthly deduction amount',
  totalPaid DECIMAL(15, 2) DEFAULT 0,
  remainingAmount DECIMAL(15, 2) DEFAULT 0,
  status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'ACTIVE',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_employee (employeeId),
  INDEX idx_status (status)
);

-- Create payroll templates for recurring allowances/deductions
CREATE TABLE IF NOT EXISTS payroll_templates (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('ALLOWANCE', 'DEDUCTION') NOT NULL,
  calculationType ENUM('FIXED', 'PERCENTAGE') DEFAULT 'FIXED',
  amount DECIMAL(15, 2) DEFAULT 0,
  percentage DECIMAL(5, 2) DEFAULT 0,
  description TEXT,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Link templates to employees
CREATE TABLE IF NOT EXISTS employee_payroll_templates (
  id VARCHAR(36) PRIMARY KEY,
  employeeId VARCHAR(36) NOT NULL,
  templateId VARCHAR(36) NOT NULL,
  customAmount DECIMAL(15, 2) DEFAULT NULL COMMENT 'Override template amount',
  isActive BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (templateId) REFERENCES payroll_templates(id) ON DELETE CASCADE,
  UNIQUE KEY unique_employee_template (employeeId, templateId)
);

-- Insert default payroll templates
INSERT IGNORE INTO payroll_templates (id, name, type, calculationType, amount, description) VALUES
(UUID(), 'بدل انتقال', 'ALLOWANCE', 'FIXED', 500, 'Transportation allowance'),
(UUID(), 'بدل سكن', 'ALLOWANCE', 'FIXED', 1000, 'Housing allowance'),
(UUID(), 'بدل طعام', 'ALLOWANCE', 'FIXED', 300, 'Meal allowance'),
(UUID(), 'تأمينات اجتماعية', 'DEDUCTION', 'PERCENTAGE', 0, 'Social insurance - 11%'),
(UUID(), 'ضريبة دخل', 'DEDUCTION', 'PERCENTAGE', 0, 'Income tax');

-- Update percentage for insurance
UPDATE payroll_templates SET percentage = 11 WHERE name = 'تأمينات اجتماعية';
UPDATE payroll_templates SET percentage = 10 WHERE name = 'ضريبة دخل';
