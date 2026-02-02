-- Migration: 020_add_missing_production_columns.sql
-- Purpose: Add any missing columns needed for production module
-- Date: 2025-12-09
-- Note: Uses IF NOT EXISTS pattern to safely run on any database state

-- Add batch_id column to stock_movements if not exists
SET @dbname = DATABASE();
SET @tablename = 'stock_movements';
SET @columnname = 'batch_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = @tablename
    AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE stock_movements ADD COLUMN batch_id VARCHAR(50)'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add finished_batch_id column to production_orders if not exists
SET @tablename = 'production_orders';
SET @columnname = 'finished_batch_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = @tablename
    AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE production_orders ADD COLUMN finished_batch_id VARCHAR(50)'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Update production_orders status ENUM
ALTER TABLE production_orders 
MODIFY COLUMN status ENUM('PLANNED', 'CONFIRMED', 'WAITING_MATERIALS', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PLANNED';

-- Create inventory_batches table if not exists
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
  supplier_batch VARCHAR(100),
  supplier_id VARCHAR(50),
  production_order_id VARCHAR(50),
  status ENUM('ACTIVE', 'QUARANTINE', 'EXPIRED', 'CONSUMED') DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_batch_number (batch_number),
  INDEX idx_product (product_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create batch_genealogy table if not exists
CREATE TABLE IF NOT EXISTS batch_genealogy (
  id VARCHAR(50) PRIMARY KEY,
  child_batch_id VARCHAR(50) NOT NULL,
  parent_batch_id VARCHAR(50) NOT NULL,
  production_order_id VARCHAR(50) NOT NULL,
  quantity_consumed DECIMAL(15,3) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_child (child_batch_id),
  INDEX idx_parent (parent_batch_id),
  INDEX idx_production_order (production_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration completed successfully
SELECT 'Migration 020: Missing production columns added successfully' AS status;
