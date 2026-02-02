-- Migration: Add Salesman Data Isolation Support
-- Description: Links salesmen to users for data isolation and adds necessary columns
-- Created: 2025-12-17

-- Add userId column to salesmen table to link salesman with their user account
ALTER TABLE salesmen 
ADD COLUMN IF NOT EXISTS userId VARCHAR(36);

-- Add unique index to ensure one-to-one relationship
CREATE UNIQUE INDEX IF NOT EXISTS idx_salesmen_userId ON salesmen(userId);

-- Add index on partners.salesmanId if not exists
CREATE INDEX IF NOT EXISTS idx_partners_salesmanId ON partners(salesmanId);

-- Note: After running this migration, link salesmen to users in the Salesman Master screen:
-- When creating/editing a salesman, select which user account they use
-- 
-- When salesmanIsolation is enabled in system config:
-- - Salesmen will only see partners assigned to them (via partners.salesmanId)
-- - Salesmen will only see invoices for those partners
-- - MASTER_ADMIN and ADMIN roles are exempt by default
