-- Migration: 005_enhance_manufacturing_schema.sql
-- Purpose: Add priority and scheduling fields to production_orders
-- Date: 2025-11-26

-- Add new columns to production_orders
ALTER TABLE production_orders
ADD COLUMN priority ENUM('HIGH', 'MEDIUM', 'LOW') DEFAULT 'MEDIUM' AFTER status,
ADD COLUMN scheduled_start_date DATE AFTER priority,
ADD COLUMN scheduled_end_date DATE AFTER scheduled_start_date;

-- Add index for priority
CREATE INDEX idx_priority ON production_orders(priority);

SELECT 'Migration 005: Manufacturing schema enhanced successfully' AS status;
