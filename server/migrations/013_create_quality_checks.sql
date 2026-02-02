-- Migration: 013_create_quality_checks.sql
-- Purpose: Create quality checks and results tables for actual inspections
-- Date: 2025-12-02

-- Quality Checks Table (actual inspection sessions)
CREATE TABLE IF NOT EXISTS quality_checks (
  id VARCHAR(50) PRIMARY KEY,
  check_number VARCHAR(50) UNIQUE NOT NULL,
  template_id VARCHAR(50) NOT NULL,
  production_order_id VARCHAR(50),
  routing_step_id VARCHAR(50) COMMENT 'Which step was inspected',
  product_id VARCHAR(50) NOT NULL,
  batch_number VARCHAR(100),
  qty_inspected DECIMAL(15,3) NOT NULL,
  qty_passed DECIMAL(15,3) DEFAULT 0,
  qty_failed DECIMAL(15,3) DEFAULT 0,
  status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
  result ENUM('PASS', 'FAIL', 'CONDITIONAL') COMMENT 'Overall result',
  inspector VARCHAR(100),
  check_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES quality_check_templates(id) ON DELETE RESTRICT,
  FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_template (template_id),
  INDEX idx_order (production_order_id),
  INDEX idx_product (product_id),
  INDEX idx_status (status),
  INDEX idx_result (result),
  INDEX idx_date (check_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quality Check Results Table (individual criterion results)
CREATE TABLE IF NOT EXISTS quality_check_results (
  id VARCHAR(50) PRIMARY KEY,
  quality_check_id VARCHAR(50) NOT NULL,
  criterion_id VARCHAR(50) NOT NULL,
  criterion_name VARCHAR(255),
  measurement_type ENUM('PASS_FAIL', 'NUMERIC', 'TEXT'),
  result_pass_fail BOOLEAN COMMENT 'For PASS_FAIL type',
  result_numeric DECIMAL(15,3) COMMENT 'For NUMERIC type',
  result_text TEXT COMMENT 'For TEXT type',
  min_value DECIMAL(15,3),
  max_value DECIMAL(15,3),
  is_within_spec BOOLEAN COMMENT 'True if result meets criteria',
  is_critical BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quality_check_id) REFERENCES quality_checks(id) ON DELETE CASCADE,
  FOREIGN KEY (criterion_id) REFERENCES quality_criteria(id) ON DELETE RESTRICT,
  INDEX idx_check (quality_check_id),
  INDEX idx_criterion (criterion_id),
  INDEX idx_spec (is_within_spec),
  INDEX idx_critical (is_critical)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Defects Table (track specific defects found)
CREATE TABLE IF NOT EXISTS quality_defects (
  id VARCHAR(50) PRIMARY KEY,
  quality_check_id VARCHAR(50) NOT NULL,
  criterion_id VARCHAR(50),
  defect_type VARCHAR(100) NOT NULL COMMENT 'Scratch, Dent, Color Off, etc.',
  severity ENUM('MINOR', 'MAJOR', 'CRITICAL') DEFAULT 'MAJOR',
  quantity INT DEFAULT 1,
  description TEXT,
  corrective_action TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quality_check_id) REFERENCES quality_checks(id) ON DELETE CASCADE,
  INDEX idx_check (quality_check_id),
  INDEX idx_type (defect_type),
  INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration completed successfully
SELECT 'Migration 013: Quality checks and results tables created successfully' AS status;
