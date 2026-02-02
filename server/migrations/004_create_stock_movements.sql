-- Migration: 004_create_stock_movements.sql
-- Purpose: Create stock movements table for complete audit trail
-- Date: 2025-11-26

-- Stock Movements Table
CREATE TABLE IF NOT EXISTS stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  product_id VARCHAR(50) NOT NULL,
  warehouse_id VARCHAR(50),
  qty_change DECIMAL(15,3) NOT NULL,
  movement_type ENUM(
    'PURCHASE', 'SALE', 'RETURN_IN', 'RETURN_OUT',
    'PRODUCTION_USE', 'PRODUCTION_OUTPUT',
    'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT',
    'OPENING_BALANCE', 'SCRAP'
  ) NOT NULL,
  reference_type VARCHAR(50),
  reference_id VARCHAR(50),
  unit_cost DECIMAL(15,2),
  notes TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_product (product_id),
  INDEX idx_movement_date (movement_date),
  INDEX idx_type (movement_type),
  INDEX idx_reference (reference_type, reference_id),
  INDEX idx_warehouse (warehouse_id),
  INDEX idx_composite (product_id, movement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration completed successfully
SELECT 'Migration 004: Stock movements table created successfully' AS status;
