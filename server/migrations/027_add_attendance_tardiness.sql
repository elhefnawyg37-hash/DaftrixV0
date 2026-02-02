
-- Migration: Add late minutes tracking to attendance records
-- This enables automatic tardiness calculation in payroll

-- Add lateMinutes column to attendance_records if not exists
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS lateMinutes INT DEFAULT 0 COMMENT 'دقائق التأخير' AFTER overtimeHours,
  ADD COLUMN IF NOT EXISTS earlyLeaveMinutes INT DEFAULT 0 COMMENT 'دقائق الانصراف المبكر' AFTER lateMinutes,
  ADD COLUMN IF NOT EXISTS scheduledCheckIn TIME DEFAULT '09:00:00' COMMENT 'موعد الحضور المحدد' AFTER notes,
  ADD COLUMN IF NOT EXISTS scheduledCheckOut TIME DEFAULT '17:00:00' COMMENT 'موعد الانصراف المحدد' AFTER scheduledCheckIn;

-- Add hourDeductionRate to employees for calculating late/absence deductions
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS hourlyRate DECIMAL(15, 2) DEFAULT 0 COMMENT 'سعر الساعة (للخصومات)' AFTER baseSalary;
