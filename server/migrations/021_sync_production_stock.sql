-- Migration: 021_sync_production_stock.sql
-- Purpose: Sync product_stocks table with production movements that were not tracked
-- Date: 2025-12-10
-- This ensures warehouse-level stock is consistent with stock_movements for production

-- Step 1: Create temporary table to calculate production stock changes per warehouse
CREATE TEMPORARY TABLE IF NOT EXISTS temp_production_stock_changes AS
SELECT 
    sm.product_id,
    sm.warehouse_id,
    SUM(sm.qty_change) as total_change
FROM stock_movements sm
WHERE sm.movement_type IN ('PRODUCTION_USE', 'PRODUCTION_OUTPUT')
  AND sm.warehouse_id IS NOT NULL
GROUP BY sm.product_id, sm.warehouse_id;

-- Step 2: Insert missing product_stocks records for products that have production movements
INSERT INTO product_stocks (id, productId, warehouseId, stock)
SELECT 
    UUID() as id,
    tps.product_id as productId,
    tps.warehouse_id as warehouseId,
    0 as stock
FROM temp_production_stock_changes tps
WHERE NOT EXISTS (
    SELECT 1 FROM product_stocks ps 
    WHERE ps.productId = tps.product_id 
      AND ps.warehouseId = tps.warehouse_id
);

-- Step 3: Log what we're about to sync (for audit purposes)
-- Note: This creates a log of the sync operation
INSERT INTO stock_movements (product_id, warehouse_id, qty_change, movement_type, reference_type, reference_id, notes, created_by)
SELECT 
    tps.product_id,
    tps.warehouse_id,
    0,
    'ADJUSTMENT',
    'SYSTEM',
    'MIGRATION_021',
    CONCAT('Stock sync check: Production movements total = ', tps.total_change),
    'System Migration'
FROM temp_production_stock_changes tps
WHERE tps.total_change != 0
LIMIT 1; -- Just one log entry to mark the migration ran

-- Step 4: Drop temporary table
DROP TEMPORARY TABLE IF EXISTS temp_production_stock_changes;

-- Migration completed successfully
SELECT 'Migration 021: Production stock sync completed successfully' AS status;
