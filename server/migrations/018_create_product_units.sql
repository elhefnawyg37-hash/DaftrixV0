-- Migration: 018_create_product_units.sql
-- Purpose: Create product units table for multi-unit selling
-- Date: 2025-12-09
-- Feature: البيع بوحدات قياس متعددة للصنف الواحد

-- Product Units Table (وحدات قياس المنتج)
CREATE TABLE IF NOT EXISTS product_units (
  id VARCHAR(36) PRIMARY KEY,
  productId VARCHAR(36) NOT NULL,
  unitName VARCHAR(50) NOT NULL COMMENT 'اسم الوحدة (كرتونة، عبوة، قطعة)',
  unitNameEn VARCHAR(50) COMMENT 'English unit name',
  conversionFactor DECIMAL(15,4) NOT NULL DEFAULT 1 COMMENT 'عامل التحويل للوحدة الأساسية',
  isBaseUnit BOOLEAN DEFAULT FALSE COMMENT 'هل هي الوحدة الأساسية للمخزون؟',
  barcode VARCHAR(50) COMMENT 'باركود خاص بهذه الوحدة',
  purchasePrice DECIMAL(15,2) COMMENT 'سعر الشراء لهذه الوحدة',
  salePrice DECIMAL(15,2) COMMENT 'سعر البيع لهذه الوحدة',
  wholesalePrice DECIMAL(15,2) COMMENT 'سعر الجملة',
  minSaleQty DECIMAL(15,3) DEFAULT 1 COMMENT 'أقل كمية للبيع',
  isActive BOOLEAN DEFAULT TRUE,
  sortOrder INT DEFAULT 0 COMMENT 'ترتيب العرض',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (productId),
  INDEX idx_barcode (barcode),
  INDEX idx_base_unit (productId, isBaseUnit),
  UNIQUE KEY unique_product_unit (productId, unitName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add unit tracking columns to invoice_lines
ALTER TABLE invoice_lines 
  ADD COLUMN IF NOT EXISTS unitId VARCHAR(36) COMMENT 'وحدة البيع المستخدمة',
  ADD COLUMN IF NOT EXISTS unitName VARCHAR(50) COMMENT 'اسم الوحدة',
  ADD COLUMN IF NOT EXISTS conversionFactor DECIMAL(15,4) DEFAULT 1 COMMENT 'عامل التحويل',
  ADD COLUMN IF NOT EXISTS baseQuantity DECIMAL(15,3) COMMENT 'الكمية بالوحدة الأساسية';

-- Add base unit column to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS baseUnit VARCHAR(50) DEFAULT 'piece' COMMENT 'الوحدة الأساسية للمخزون',
  ADD COLUMN IF NOT EXISTS hasMultipleUnits BOOLEAN DEFAULT FALSE COMMENT 'هل للمنتج وحدات متعددة؟';

-- Migration completed successfully
SELECT 'Migration 018: Product units table created successfully' AS status;
