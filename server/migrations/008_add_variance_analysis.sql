-- Migration: 008_add_variance_analysis.sql
-- Purpose: Add variance analysis columns to production orders for cost tracking
-- Date: 2025-12-02

-- Add variance tracking columns to production_orders
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS standard_cost DECIMAL(15,2) DEFAULT 0 COMMENT 'Planned cost from BOM (materials only)',
ADD COLUMN IF NOT EXISTS actual_material_cost DECIMAL(15,2) DEFAULT 0 COMMENT 'Actual material cost consumed',
ADD COLUMN IF NOT EXISTS actual_scrap_cost DECIMAL(15,2) DEFAULT 0 COMMENT 'Cost of scrapped materials',
ADD COLUMN IF NOT EXISTS actual_labor_cost DECIMAL(15,2) DEFAULT 0 COMMENT 'Labor cost (future use)',
ADD COLUMN IF NOT EXISTS actual_overhead_cost DECIMAL(15,2) DEFAULT 0 COMMENT 'Overhead allocation (future use)',
ADD COLUMN IF NOT EXISTS material_variance DECIMAL(15,2) DEFAULT 0 COMMENT 'Material variance (Actual - Standard)',
ADD COLUMN IF NOT EXISTS yield_variance DECIMAL(15,2) DEFAULT 0 COMMENT 'Yield variance (scrap impact)',
ADD COLUMN IF NOT EXISTS total_variance DECIMAL(15,2) DEFAULT 0 COMMENT 'Total cost variance';

-- Add indexes for reporting
ALTER TABLE production_orders
ADD INDEX IF NOT EXISTS idx_variance (total_variance),
ADD INDEX IF NOT EXISTS idx_status_variance (status, total_variance);

-- Migration completed successfully
SELECT 'Migration 008: Variance analysis columns added successfully' AS status;
