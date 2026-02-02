-- Migration: Add User-Level Data Filtering Support
-- Date: 2025-12-03
-- Description: Adds createdBy columns to support user-level data isolation

-- =============================================
-- Add createdBy to partners table
-- =============================================
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS createdBy VARCHAR(100);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_partners_createdBy ON partners(createdBy);

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS update_partners_createdby()
BEGIN
    -- Set existing records to 'System' if createdBy is NULL
    UPDATE partners SET createdBy = 'System' WHERE createdBy IS NULL OR createdBy = '';
END //
DELIMITER ;

CALL update_partners_createdby();
DROP PROCEDURE IF EXISTS update_partners_createdby;

-- =============================================
-- Add createdBy to products table
-- =============================================
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS createdBy VARCHAR(100);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_createdBy ON products(createdBy);

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS update_products_createdby()
BEGIN
    -- Set existing records to 'System' if createdBy is NULL
    UPDATE products SET createdBy = 'System' WHERE createdBy IS NULL OR createdBy = '';
END //
DELIMITER ;

CALL update_products_createdby();
DROP PROCEDURE IF EXISTS update_products_createdby;

-- =============================================
-- Verify existing tables have createdBy
-- =============================================

-- These should already exist from previous migrations, but verify:
-- invoices.createdBy
-- journal_entries.createdBy
-- cheques.createdBy
-- stock_permits.createdBy

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_invoices_createdBy ON invoices(createdBy);
CREATE INDEX IF NOT EXISTS idx_journal_entries_createdBy ON journal_entries(createdBy);
CREATE INDEX IF NOT EXISTS idx_cheques_createdBy ON cheques(createdBy);
CREATE INDEX IF NOT EXISTS idx_stock_permits_createdBy ON stock_permits(createdBy);

-- =============================================
-- Update existing NULL values to 'System'
-- =============================================

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS fix_null_createdby()
BEGIN
    -- Update invoices
    UPDATE invoices SET createdBy = 'System' WHERE createdBy IS NULL OR createdBy = '';
    
    -- Update journal_entries
    UPDATE journal_entries SET createdBy = 'System' WHERE createdBy IS NULL OR createdBy = '';
    
    -- Update cheques
    UPDATE cheques SET createdBy = 'System' WHERE createdBy IS NULL OR createdBy = '';
    
    -- Update stock_permits
    UPDATE stock_permits SET createdBy = 'System' WHERE createdBy IS NULL OR createdBy = '';
END //
DELIMITER ;

CALL fix_null_createdby();
DROP PROCEDURE IF EXISTS fix_null_createdby;

-- =============================================
-- Verification Queries
-- =============================================

-- Check if columns exist and have data
SELECT 
    'partners' as table_name,
    COUNT(*) as total_records,
    COUNT(createdBy) as records_with_creator,
    COUNT(*) - COUNT(createdBy) as null_creators
FROM partners

UNION ALL

SELECT 
    'products',
    COUNT(*),
    COUNT(createdBy),
    COUNT(*) - COUNT(createdBy)
FROM products

UNION ALL

SELECT 
    'invoices',
    COUNT(*),
    COUNT(createdBy),
    COUNT(*) - COUNT(createdBy)
FROM invoices

UNION ALL

SELECT 
    'journal_entries',
    COUNT(*),
    COUNT(createdBy),
    COUNT(*) - COUNT(createdBy)
FROM journal_entries

UNION ALL

SELECT 
    'cheques',
    COUNT(*),
    COUNT(createdBy),
    COUNT(*) - COUNT(createdBy)
FROM cheques

UNION ALL

SELECT 
    'stock_permits',
    COUNT(*),
    COUNT(createdBy),
    COUNT(*) - COUNT(createdBy)
FROM stock_permits;

-- =============================================
-- Create view for data visibility audit
-- =============================================

CREATE OR REPLACE VIEW v_data_ownership_summary AS
SELECT 
    'invoices' as entity_type,
    createdBy,
    COUNT(*) as record_count,
    MIN(date) as earliest_record,
    MAX(date) as latest_record
FROM invoices
WHERE createdBy IS NOT NULL
GROUP BY createdBy

UNION ALL

SELECT 
    'journal_entries',
    createdBy,
    COUNT(*),
    MIN(date),
    MAX(date)
FROM journal_entries
WHERE createdBy IS NOT NULL
GROUP BY createdBy

UNION ALL

SELECT 
    'cheques',
    createdBy,
    COUNT(*),
    MIN(createdDate),
    MAX(createdDate)
FROM cheques
WHERE createdBy IS NOT NULL
GROUP BY createdBy

UNION ALL

SELECT 
    'stock_permits',
    createdBy,
    COUNT(*),
    MIN(date),
    MAX(date)
FROM stock_permits
WHERE createdBy IS NOT NULL
GROUP BY createdBy

UNION ALL

SELECT 
    'partners',
    createdBy,
    COUNT(*),
    NULL as earliest_record,
    NULL as latest_record
FROM partners
WHERE createdBy IS NOT NULL
GROUP BY createdBy

UNION ALL

SELECT 
    'products',
    createdBy,
    COUNT(*),
    NULL,
    NULL
FROM products
WHERE createdBy IS NOT NULL
GROUP BY createdBy

ORDER BY entity_type, createdBy;

-- =============================================
-- Performance optimization
-- =============================================

-- Analyze tables for query optimization
ANALYZE TABLE partners;
ANALYZE TABLE products;
ANALYZE TABLE invoices;
ANALYZE TABLE journal_entries;
ANALYZE TABLE cheques;
ANALYZE TABLE stock_permits;

-- =============================================
-- Success Message
-- =============================================

SELECT 
    '✅ Migration completed successfully!' as status,
    'User-level data filtering is now available' as message,
    'Check v_data_ownership_summary for data distribution' as next_step;
