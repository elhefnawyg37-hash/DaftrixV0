-- Migration: 014_create_batch_tracking.sql
-- Purpose: Create batch inventory and genealogy tracking system
-- Date: 2025-12-02

-- Inventory Batches Table
CREATE TABLE IF NOT EXISTS inventory_batches (
  id VARCHAR(50) PRIMARY KEY,
  batch_number VARCHAR(100) UNIQUE NOT NULL,
  product_id VARCHAR(50) NOT NULL,
  warehouse_id VARCHAR(50),
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  available_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(15,2),
  manufacture_date DATE,
  expiry_date DATE,
  supplier_batch VARCHAR(100) COMMENT 'Original supplier batch number for raw materials',
  supplier_id VARCHAR(50),
  production_order_id VARCHAR(50) COMMENT 'If produced internally',
  status ENUM('ACTIVE', 'QUARANTINE', 'EXPIRED', 'CONSUMED') DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
  FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE SET NULL,
  INDEX idx_batch_number (batch_number),
  INDEX idx_product (product_id),
  INDEX idx_status (status),
  INDEX idx_expiry (expiry_date),
  INDEX idx_warehouse (warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Batch Genealogy Table (Links parent batches to child batches)
CREATE TABLE IF NOT EXISTS batch_genealogy (
  id VARCHAR(50) PRIMARY KEY,
  child_batch_id VARCHAR(50) NOT NULL COMMENT 'Finished goods batch',
  parent_batch_id VARCHAR(50) NOT NULL COMMENT 'Raw material batch consumed',
  production_order_id VARCHAR(50) NOT NULL,
  quantity_consumed DECIMAL(15,3) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (child_batch_id) REFERENCES inventory_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE,
  INDEX idx_child (child_batch_id),
  INDEX idx_parent (parent_batch_id),
  INDEX idx_production_order (production_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add batch_id to stock_movements table
ALTER TABLE stock_movements 
ADD COLUMN batch_id VARCHAR(50) AFTER product_id,
ADD INDEX idx_batch (batch_id);

-- Add finished_batch_id to production_orders
ALTER TABLE production_orders 
ADD COLUMN finished_batch_id VARCHAR(50) AFTER finished_product_id,
ADD INDEX idx_finished_batch (finished_batch_id);

-- Migration completed successfully
SELECT 'Migration 014: Batch tracking and genealogy system created successfully' AS status;
