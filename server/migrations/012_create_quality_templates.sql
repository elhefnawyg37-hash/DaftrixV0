-- Migration: 012_create_quality_templates.sql
-- Purpose: Create quality check templates and criteria for products
-- Date: 2025-12-02

-- Quality Check Templates Table
CREATE TABLE IF NOT EXISTS quality_check_templates (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  product_id VARCHAR(50),
  description TEXT,
  check_type ENUM('INCOMING', 'IN_PROCESS', 'FINAL', 'PERIODIC') DEFAULT 'FINAL',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id),
  INDEX idx_type (check_type),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quality Criteria Table (inspection points within a template)
CREATE TABLE IF NOT EXISTS quality_criteria (
  id VARCHAR(50) PRIMARY KEY,
  template_id VARCHAR(50) NOT NULL,
  sequence_number INT NOT NULL,
  criterion_name VARCHAR(255) NOT NULL,
  description TEXT,
  measurement_type ENUM('PASS_FAIL', 'NUMERIC', 'TEXT') DEFAULT 'PASS_FAIL',
  min_value DECIMAL(15,3) COMMENT 'For numeric measurements',
  max_value DECIMAL(15,3) COMMENT 'For numeric measurements',
  target_value DECIMAL(15,3) COMMENT 'Ideal value for numeric measurements',
  unit VARCHAR(50) COMMENT 'Unit of measurement (mm, kg, etc.)',
  is_critical BOOLEAN DEFAULT FALSE COMMENT 'If true, failure means reject entire batch',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES quality_check_templates(id) ON DELETE CASCADE,
  INDEX idx_template (template_id),
  INDEX idx_sequence (template_id, sequence_number),
  INDEX idx_critical (is_critical)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration completed successfully
SELECT 'Migration 012: Quality check templates created successfully' AS status;
