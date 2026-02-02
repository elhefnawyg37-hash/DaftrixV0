-- Migration: 024_enhance_production_steps.sql
-- Purpose: Enhance production order steps for shop floor tracking + MRP suggestions
-- Date: 2025-12-17

-- =====================================================
-- PART 1: Enhance production_order_steps table
-- =====================================================

-- Add tracking fields to production_order_steps
ALTER TABLE production_order_steps 
ADD COLUMN IF NOT EXISTS assigned_operator VARCHAR(100) COMMENT 'Operator assigned to this step',
ADD COLUMN IF NOT EXISTS output_quantity DECIMAL(15,4) DEFAULT 0 COMMENT 'Good units produced at this step',
ADD COLUMN IF NOT EXISTS scrap_quantity DECIMAL(15,4) DEFAULT 0 COMMENT 'Units scrapped at this step',
ADD COLUMN IF NOT EXISTS quality_status ENUM('PENDING', 'PASSED', 'FAILED', 'SKIPPED') DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS step_notes TEXT COMMENT 'Notes from operator';

-- Add pause/resume tracking
ALTER TABLE production_order_steps
ADD COLUMN IF NOT EXISTS pause_count INT DEFAULT 0 COMMENT 'Number of times step was paused',
ADD COLUMN IF NOT EXISTS total_pause_minutes DECIMAL(10,2) DEFAULT 0 COMMENT 'Total pause duration';

-- Add indexes for shop floor queries
ALTER TABLE production_order_steps
ADD INDEX IF NOT EXISTS idx_status_date (status, actual_start),
ADD INDEX IF NOT EXISTS idx_operator (assigned_operator);

-- =====================================================
-- PART 2: Create MRP Suggestions table
-- =====================================================

CREATE TABLE IF NOT EXISTS mrp_suggestions (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  product_name VARCHAR(255),
  product_sku VARCHAR(100),
  bom_id VARCHAR(36),
  bom_name VARCHAR(255),
  
  -- Demand Details
  suggested_quantity DECIMAL(15,4) NOT NULL,
  current_stock DECIMAL(15,4) DEFAULT 0,
  incoming_quantity DECIMAL(15,4) DEFAULT 0 COMMENT 'From pending production orders',
  demand_quantity DECIMAL(15,4) DEFAULT 0 COMMENT 'Total demand (sales + forecast + safety)',
  
  demand_source ENUM('SALES_ORDER', 'FORECAST', 'SAFETY_STOCK', 'MANUAL') DEFAULT 'SALES_ORDER',
  source_reference_ids TEXT COMMENT 'JSON array of source document IDs',
  
  -- Planning
  due_date DATE,
  lead_time_days INT DEFAULT 0,
  suggested_start_date DATE,
  priority ENUM('HIGH', 'MEDIUM', 'LOW') DEFAULT 'MEDIUM',
  
  -- Status
  status ENUM('PENDING', 'APPROVED', 'CONVERTED', 'REJECTED') DEFAULT 'PENDING',
  converted_order_id VARCHAR(36) COMMENT 'Link to production_orders.id when converted',
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  approved_by VARCHAR(100),
  
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (bom_id) REFERENCES bom(id) ON DELETE SET NULL,
  FOREIGN KEY (converted_order_id) REFERENCES production_orders(id) ON DELETE SET NULL,
  
  INDEX idx_status (status),
  INDEX idx_due_date (due_date),
  INDEX idx_priority (priority),
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PART 3: Capacity Planning View (Helper)
-- =====================================================

-- Create view for capacity load calculation
CREATE OR REPLACE VIEW v_capacity_load AS
SELECT 
    wc.id as work_center_id,
    wc.code as work_center_code,
    wc.name as work_center_name,
    wc.capacity_per_hour,
    DATE(po.scheduled_start_date) as production_date,
    po.id as production_order_id,
    po.order_number,
    pos.id as step_id,
    pos.operation_name,
    pos.sequence_number,
    pos.status as step_status,
    pos.setup_time_minutes,
    pos.run_time_minutes,
    po.qty_planned,
    (pos.setup_time_minutes + (pos.run_time_minutes * po.qty_planned)) as total_load_minutes
FROM production_order_steps pos
JOIN production_orders po ON pos.production_order_id = po.id
JOIN work_centers wc ON pos.work_center_id = wc.id
WHERE po.status NOT IN ('COMPLETED', 'CANCELLED');

-- =====================================================
-- PART 4: Shop Floor PIN for workers (optional)
-- =====================================================

-- Add PIN field to users for shop floor authentication
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS shop_floor_pin VARCHAR(6) COMMENT '4-6 digit PIN for shop floor login',
ADD COLUMN IF NOT EXISTS default_work_center_id VARCHAR(50) COMMENT 'Default work center for this user';

-- =====================================================
-- Migration completed
-- =====================================================

SELECT 'Migration 024: Enhanced production steps, MRP suggestions, and capacity view created successfully' AS status;
