-- Migration: 001_enhance_products_table.sql
-- Purpose: Add manufacturing fields to existing products table
-- Date: 2025-11-26

-- Add manufacturing-related columns to products table (one at a time)
ALTER TABLE products ADD COLUMN type ENUM('RAW', 'FINISHED', 'SERVICE') DEFAULT 'FINISHED';
ALTER TABLE products ADD COLUMN unit VARCHAR(50) DEFAULT 'piece';
ALTER TABLE products ADD COLUMN min_stock DECIMAL(15,3) DEFAULT 0;
ALTER TABLE products ADD COLUMN avg_cost DECIMAL(15,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN is_manufactured BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN lead_time_days INT DEFAULT 0;

-- Update existing products to FINISHED type
UPDATE products SET type = 'FINISHED' WHERE type IS NULL;

-- Add indexes for better performance
CREATE INDEX idx_product_type ON products(type);
CREATE INDEX idx_product_manufactured ON products(is_manufactured);

-- Migration completed successfully
SELECT 'Migration 001: Products table enhanced with manufacturing fields' AS status;
