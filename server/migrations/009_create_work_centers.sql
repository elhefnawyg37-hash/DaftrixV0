-- Migration: 009_create_work_centers.sql
-- Purpose: Create work centers table for production routing
-- Date: 2025-12-02

-- Work Centers Table (Production Stations/Machines)
CREATE TABLE IF NOT EXISTS work_centers (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) COMMENT 'MACHINE, WORKSTATION, ASSEMBLY_LINE, etc.',
  capacity_per_hour DECIMAL(10,2) DEFAULT 0 COMMENT 'Units per hour',
  cost_per_hour DECIMAL(10,2) DEFAULT 0 COMMENT 'Operating cost per hour',
  warehouse_id VARCHAR(50),
  status ENUM('ACTIVE', 'MAINTENANCE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_status (status),
  INDEX idx_warehouse (warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration completed successfully
SELECT 'Migration 009: Work centers table created successfully' AS status;
