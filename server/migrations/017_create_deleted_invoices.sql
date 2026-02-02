-- Migration: Create deleted_invoices table to track deleted invoices
-- Purpose: Archive invoices before deletion for audit trail and recovery

-- Create deleted_invoices table
CREATE TABLE IF NOT EXISTS deleted_invoices (
    id VARCHAR(255) PRIMARY KEY,
    original_id VARCHAR(255) NOT NULL,
    date DATETIME,
    type VARCHAR(50),
    partnerId VARCHAR(255),
    partnerName VARCHAR(255),
    total DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50),
    paymentMethod VARCHAR(50),
    posted BOOLEAN DEFAULT FALSE,
    notes TEXT,
    dueDate DATETIME,
    taxAmount DECIMAL(15, 2) DEFAULT 0,
    whtAmount DECIMAL(15, 2) DEFAULT 0,
    shippingFee DECIMAL(15, 2) DEFAULT 0,
    globalDiscount DECIMAL(15, 2) DEFAULT 0,
    warehouseId VARCHAR(255),
    costCenterId VARCHAR(255),
    paidAmount DECIMAL(15, 2) DEFAULT 0,
    bankAccountId VARCHAR(255),
    bankName VARCHAR(255),
    paymentBreakdown TEXT,
    salesmanId VARCHAR(255),
    createdBy VARCHAR(255),
    
    -- Deletion metadata
    deletedBy VARCHAR(255) NOT NULL,
    deletedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deletionReason TEXT,
    
    -- Indexes
    INDEX idx_deleted_invoices_original_id (original_id),
    INDEX idx_deleted_invoices_deletedAt (deletedAt),
    INDEX idx_deleted_invoices_deletedBy (deletedBy),
    INDEX idx_deleted_invoices_type (type),
    INDEX idx_deleted_invoices_partnerId (partnerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create deleted_invoice_lines table to archive invoice lines
CREATE TABLE IF NOT EXISTS deleted_invoice_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deletedInvoiceId VARCHAR(255) NOT NULL,
    originalInvoiceId VARCHAR(255) NOT NULL,
    productId VARCHAR(255),
    productName VARCHAR(255),
    quantity DECIMAL(15, 3) DEFAULT 0,
    price DECIMAL(15, 2) DEFAULT 0,
    cost DECIMAL(15, 2) DEFAULT 0,
    discount DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) DEFAULT 0,
    
    INDEX idx_deleted_lines_deletedInvoiceId (deletedInvoiceId),
    INDEX idx_deleted_lines_originalInvoiceId (originalInvoiceId),
    FOREIGN KEY (deletedInvoiceId) REFERENCES deleted_invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log successful migration
SELECT 'Migration 017: deleted_invoices table created successfully' AS status;
