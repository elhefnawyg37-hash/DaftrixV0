-- Migration: 002_create_bom_tables.sql
-- Purpose: Create Bill of Materials (BOM) tables
-- Date: 2025-11-26

-- Bill of Materials Header Table
CREATE TABLE IF NOT EXISTS bom (
  id VARCHAR(50) PRIMARY KEY,
  finished_product_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  labor_cost DECIMAL(15,2) DEFAULT 0,
  overhead_cost DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (finished_product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_finished_product (finished_product_id),
  INDEX idx_active (is_active),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- BOM Line Items (Raw Materials) Table
CREATE TABLE IF NOT EXISTS bom_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bom_id VARCHAR(50) NOT NULL,
  raw_product_id VARCHAR(50) NOT NULL,
  quantity_per_unit DECIMAL(15,3) NOT NULL,
  waste_percent DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bom_id) REFERENCES bom(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_bom (bom_id),
  INDEX idx_raw_product (raw_product_id),
  UNIQUE KEY unique_bom_product (bom_id, raw_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration completed successfully
SELECT 'Migration 002: BOM tables created successfully' AS status;
