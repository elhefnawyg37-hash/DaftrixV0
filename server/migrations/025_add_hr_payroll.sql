
-- HR & Payroll Module

-- 1. Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(36) PRIMARY KEY,
  fullName VARCHAR(255) NOT NULL,
  nationalId VARCHAR(50) UNIQUE,
  jobTitle VARCHAR(100),
  department VARCHAR(100),
  employmentType ENUM('MONTHLY', 'DAILY') DEFAULT 'MONTHLY',
  baseSalary DECIMAL(15, 2) DEFAULT 0,
  branchId VARCHAR(36),
  treasuryAccountId VARCHAR(36) COMMENT 'Account ID for payout (Treasury)',
  status ENUM('ACTIVE', 'INACTIVE', 'TERMINATED') DEFAULT 'ACTIVE',
  hireDate DATE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (treasuryAccountId) REFERENCES accounts(id) ON DELETE SET NULL,
  INDEX idx_branch (branchId),
  INDEX idx_status (status)
);

-- 2. Payroll Cycles Table (The master record for a month's payroll)
CREATE TABLE IF NOT EXISTS payroll_cycles (
  id VARCHAR(36) PRIMARY KEY,
  month INT NOT NULL,
  year INT NOT NULL,
  status ENUM('DRAFT', 'REVIEW', 'APPROVED', 'PAID') DEFAULT 'DRAFT',
  totalAmount DECIMAL(15, 2) DEFAULT 0,
  generatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  approvedBy VARCHAR(36),
  approvedAt DATETIME,
  notes TEXT,
  UNIQUE KEY unique_period (month, year)
);

-- 3. Payroll Entries Table (Individual employee payroll details)
CREATE TABLE IF NOT EXISTS payroll_entries (
  id VARCHAR(36) PRIMARY KEY,
  payrollId VARCHAR(36) NOT NULL,
  employeeId VARCHAR(36) NOT NULL,
  baseSalary DECIMAL(15, 2) DEFAULT 0,
  allowances JSON COMMENT 'List of allowances {name, amount}',
  deductions JSON COMMENT 'List of deductions {name, amount}',
  advances DECIMAL(15, 2) DEFAULT 0,
  netSalary DECIMAL(15, 2) DEFAULT 0,
  status ENUM('PENDING', 'PAID') DEFAULT 'PENDING',
  notes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payrollId) REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_payroll (payrollId),
  INDEX idx_employee (employeeId)
);

-- 4. Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
  id VARCHAR(36) PRIMARY KEY,
  employeeId VARCHAR(36) NOT NULL,
  date DATE NOT NULL,
  checkIn TIME,
  checkOut TIME,
  status ENUM('PRESENT', 'ABSENT', 'LATE', 'LEAVE') DEFAULT 'PRESENT',
  isOvertime BOOLEAN DEFAULT FALSE,
  overtimeHours DECIMAL(4, 2) DEFAULT 0,
  notes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY unique_daily_attendance (employeeId, date),
  INDEX idx_date (date)
);

-- 5. Permissions
INSERT IGNORE INTO permissions (id, label, module) VALUES 
('hr.view', 'View Employees', 'HR'),
('hr.manage', 'Manage Employees', 'HR'),
('payroll.view', 'View Payroll', 'HR'),
('payroll.manage', 'Manage Payroll', 'HR'),
('attendance.manage', 'Manage Attendance', 'HR');
