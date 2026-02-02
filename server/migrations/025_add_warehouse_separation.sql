-- Migration: 025_add_warehouse_separation.sql
-- Purpose: Add source_warehouse_id and dest_warehouse_id to production_orders
-- Date: 2025-12-18
-- Description: Separates raw material source warehouse from finished product destination warehouse

-- Add source_warehouse_id column (for raw materials)
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS source_warehouse_id VARCHAR(50) NULL AFTER warehouse_id;

-- Add dest_warehouse_id column (for finished products)
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS dest_warehouse_id VARCHAR(50) NULL AFTER source_warehouse_id;

-- Copy existing warehouse_id to both columns for existing records
UPDATE production_orders 
SET source_warehouse_id = warehouse_id,
    dest_warehouse_id = warehouse_id
WHERE source_warehouse_id IS NULL AND warehouse_id IS NOT NULL;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_source_warehouse ON production_orders(source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_dest_warehouse ON production_orders(dest_warehouse_id);

-- Migration completed successfully
SELECT 'Migration 025: Source and destination warehouse separation added' AS status;
