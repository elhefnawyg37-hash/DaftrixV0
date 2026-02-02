-- Migration: Add Salesman Tracking to Transactions
-- Description: Track which salesman performed each transaction (sales & collections)
-- Created: 2025-12-03

-- Add salesmanId to invoices table to track sales representative
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS salesmanId VARCHAR(36);

-- Add index for better performance on salesman queries
CREATE INDEX IF NOT EXISTS idx_invoices_salesmanId ON invoices(salesmanId);

-- Add salesmanId to journal_entries table to track collection representative
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS salesmanId VARCHAR(36);

-- Add index for journal entries salesman queries
CREATE INDEX IF NOT EXISTS idx_journal_entries_salesmanId ON journal_entries(salesmanId);

-- Add type field to salesmen table to distinguish between sales and collection reps
ALTER TABLE salesmen 
ADD COLUMN IF NOT EXISTS type ENUM('SALES', 'COLLECTION', 'BOTH') DEFAULT 'SALES';

-- Add index for salesmen type
CREATE INDEX IF NOT EXISTS idx_salesmen_type ON salesmen(type);

-- Add foreign key constraints (optional, can be NULL if no salesman assigned)
-- ALTER TABLE invoices ADD FOREIGN KEY (salesmanId) REFERENCES salesmen(id) ON DELETE SET NULL;
-- ALTER TABLE journal_entries ADD FOREIGN KEY (salesmanId) REFERENCES salesmen(id) ON DELETE SET NULL;
