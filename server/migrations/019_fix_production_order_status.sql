-- Migration: 019_fix_production_order_status.sql
-- Purpose: Update production_orders status column to include all statuses used in code
-- Date: 2025-12-09

-- Modify the status column to include CONFIRMED and WAITING_MATERIALS
ALTER TABLE production_orders 
MODIFY COLUMN status ENUM('PLANNED', 'CONFIRMED', 'WAITING_MATERIALS', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PLANNED';

-- Migration completed successfully
SELECT 'Migration 019: Production order status enum updated successfully' AS status;
