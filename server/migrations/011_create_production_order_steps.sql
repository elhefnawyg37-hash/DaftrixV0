-- Migration: 011_create_production_order_steps.sql
-- Purpose: Track actual progress of production orders through routing steps
-- Date: 2025-12-02

-- Production Order Steps Table (Actual execution tracking)
CREATE TABLE IF NOT EXISTS production_order_steps (
  id VARCHAR(50) PRIMARY KEY,
  production_order_id VARCHAR(50) NOT NULL,
  routing_step_id VARCHAR(50) NOT NULL,
  sequence_number INT NOT NULL,
  work_center_id VARCHAR(50) NOT NULL,
  operation_name VARCHAR(255) NOT NULL,
  status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED') DEFAULT 'PENDING',
  planned_start TIMESTAMP NULL,
  planned_end TIMESTAMP NULL,
  actual_start TIMESTAMP NULL,
  actual_end TIMESTAMP NULL,
  actual_setup_time_minutes DECIMAL(10,2) DEFAULT 0,
  actual_run_time_minutes DECIMAL(10,2) DEFAULT 0,
  actual_labor_cost DECIMAL(10,2) DEFAULT 0,
  qty_completed DECIMAL(15,3) DEFAULT 0,
  qty_rejected DECIMAL(15,3) DEFAULT 0,
  notes TEXT,
  completed_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (routing_step_id) REFERENCES routing_steps(id) ON DELETE RESTRICT,
  FOREIGN KEY (work_center_id) REFERENCES work_centers(id) ON DELETE RESTRICT,
  INDEX idx_order (production_order_id),
  INDEX idx_status (status),
  INDEX idx_work_center (work_center_id),
  INDEX idx_sequence (production_order_id, sequence_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add routing_id to production_orders table
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS routing_id VARCHAR(50),
ADD INDEX IF NOT EXISTS idx_routing (routing_id);

-- Migration completed successfully
SELECT 'Migration 011: Production order steps table created successfully' AS status;
