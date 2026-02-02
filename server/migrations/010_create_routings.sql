-- Migration: 010_create_routings.sql
-- Purpose: Create routing and routing steps tables for production workflows
-- Date: 2025-12-02

-- Routings Table (Production Workflows)
CREATE TABLE IF NOT EXISTS routings (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  product_id VARCHAR(50) NOT NULL COMMENT 'Product this routing produces',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_code (code),
  INDEX idx_product (product_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Routing Steps Table (Operations in sequence)
CREATE TABLE IF NOT EXISTS routing_steps (
  id VARCHAR(50) PRIMARY KEY,
  routing_id VARCHAR(50) NOT NULL,
  sequence_number INT NOT NULL COMMENT 'Order of operation (10, 20, 30...)',
  work_center_id VARCHAR(50) NOT NULL,
  operation_name VARCHAR(255) NOT NULL,
  description TEXT,
  setup_time_minutes DECIMAL(10,2) DEFAULT 0 COMMENT 'Time to prepare work center',
  run_time_minutes DECIMAL(10,2) DEFAULT 0 COMMENT 'Time per unit',
  labor_cost_per_hour DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (routing_id) REFERENCES routings(id) ON DELETE CASCADE,
  FOREIGN KEY (work_center_id) REFERENCES work_centers(id) ON DELETE RESTRICT,
  INDEX idx_routing (routing_id),
  INDEX idx_sequence (routing_id, sequence_number),
  INDEX idx_work_center (work_center_id),
  UNIQUE KEY unique_routing_sequence (routing_id, sequence_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration completed successfully
SELECT 'Migration 010: Routing tables created successfully' AS status;
