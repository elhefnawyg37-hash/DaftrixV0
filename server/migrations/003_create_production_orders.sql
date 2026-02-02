-- Migration: 003_create_production_orders.sql
-- Purpose: Create production orders table
-- Date: 2025-11-26

-- Production Orders Table
CREATE TABLE IF NOT EXISTS production_orders (
  id VARCHAR(50) PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  bom_id VARCHAR(50) NOT NULL,
  finished_product_id VARCHAR(50) NOT NULL,
  qty_planned DECIMAL(15,3) NOT NULL,
  qty_finished DECIMAL(15,3) DEFAULT 0,
  qty_scrapped DECIMAL(15,3) DEFAULT 0,
  status ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PLANNED',
  start_date DATE,
  end_date DATE,
  actual_start_date TIMESTAMP NULL,
  actual_end_date TIMESTAMP NULL,
  warehouse_id VARCHAR(50),
  notes TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (bom_id) REFERENCES bom(id) ON DELETE RESTRICT,
  FOREIGN KEY (finished_product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_status (status),
  INDEX idx_order_number (order_number),
  INDEX idx_dates (start_date, end_date),
  INDEX idx_product (finished_product_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration completed successfully
SELECT 'Migration 003: Production orders table created successfully' AS status;
