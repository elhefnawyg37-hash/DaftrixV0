"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.getConnection = getConnection;
exports.initDB = initDB;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
const seedData_1 = require("./seedData");
dotenv_1.default.config();
console.log('DB Config:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    hasPassword: !!process.env.DB_PASSWORD
});
exports.pool = promise_1.default.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    authPlugins: {
        mysql_clear_password: () => () => Buffer.from(process.env.DB_PASSWORD + '\0')
    }
});
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function getConnection() {
    return __awaiter(this, arguments, void 0, function* (maxRetries = 5) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const conn = yield exports.pool.getConnection();
                // console.log('✅ Database connected');
                return conn;
            }
            catch (error) {
                console.error(`❌ DB connection attempt ${i + 1} failed`);
                if (i === maxRetries - 1)
                    throw error;
                yield sleep(5000 * (i + 1)); // Exponential backoff: 5s, 10s, 15s...
            }
        }
        throw new Error('Failed to obtain database connection after retries');
    });
}
function initDB() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        let conn;
        try {
            // Connect without database selected to create it if not exists
            const rootConn = yield promise_1.default.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                port: Number(process.env.DB_PORT) || 3306,
            });
            yield rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
            yield rootConn.end();
            // Now connect to the database
            conn = yield exports.pool.getConnection();
            console.log("Connected to MariaDB/MySQL");
            // Products Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100),
        barcode VARCHAR(100),
        description TEXT,
        price DECIMAL(10, 2) DEFAULT 0,
        cost DECIMAL(10, 2) DEFAULT 0,
        stock INT DEFAULT 0,
        minStock INT DEFAULT 0,
        maxStock INT DEFAULT 0,
        warehouseId VARCHAR(36),
        categoryId VARCHAR(36),
        image TEXT,
        bomId VARCHAR(36),
        type VARCHAR(50),
        unit VARCHAR(50),
        isManufactured BOOLEAN DEFAULT FALSE,
        leadTimeDays INT DEFAULT 0
      )
    `);
            // Partners Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS partners (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type ENUM('CUSTOMER', 'SUPPLIER', 'BOTH') NOT NULL,
        isCustomer BOOLEAN DEFAULT FALSE,
        isSupplier BOOLEAN DEFAULT FALSE,
        balance DECIMAL(15, 2) DEFAULT 0,
        phone VARCHAR(50),
        email VARCHAR(100),
        taxId VARCHAR(50),
        address TEXT,
        contactPerson VARCHAR(100),
        openingBalance DECIMAL(15, 2) DEFAULT 0,
        paymentTerms INT DEFAULT 0,
        creditLimit DECIMAL(15, 2) DEFAULT 0,
        classification VARCHAR(50),
        status VARCHAR(50) DEFAULT 'ACTIVE',
        groupId VARCHAR(36),
        commercialRegister VARCHAR(50),
        INDEX idx_type (type),
        INDEX idx_isCustomer (isCustomer),
        INDEX idx_isSupplier (isSupplier),
        INDEX idx_balance (balance),
        INDEX idx_name (name),
        INDEX idx_phone (phone)
      )
    `);
            // Add salesmanId column to partners table if it doesn't exist
            yield conn.query(`
      ALTER TABLE partners 
      ADD COLUMN IF NOT EXISTS salesmanId VARCHAR(36)
    `).catch(() => {
                // Ignore error if column already exists
            });
            // Accounts Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(36) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE') NOT NULL,
        balance DECIMAL(15, 2) DEFAULT 0,
        openingBalance DECIMAL(15, 2) DEFAULT 0
      )
    `);
            // Invoices Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(36) PRIMARY KEY,
        date DATETIME NOT NULL,
        type VARCHAR(50) NOT NULL,
        partnerId VARCHAR(36),
        partnerName VARCHAR(255),
        total DECIMAL(15, 2) DEFAULT 0,
        status VARCHAR(50) NOT NULL,
        paymentMethod VARCHAR(50),
        posted BOOLEAN DEFAULT FALSE,
        notes TEXT,
        dueDate DATETIME,
        taxAmount DECIMAL(15, 2) DEFAULT 0,
        whtAmount DECIMAL(15, 2) DEFAULT 0,
        shippingFee DECIMAL(15, 2) DEFAULT 0,
        globalDiscount DECIMAL(15, 2) DEFAULT 0,
        warehouseId VARCHAR(36),
        costCenterId VARCHAR(36),
        bankAccountId VARCHAR(36),
        bankName VARCHAR(100),
        FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE SET NULL
      )
    `);
            // Add costCenterId column if it doesn't exist (migration for existing databases)
            yield conn.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS costCenterId VARCHAR(36)
    `).catch(() => {
                // Ignore error if column already exists (MySQL/MariaDB might not support IF NOT EXISTS)
            });
            // Add priceListId column if it doesn't exist (migration for existing databases)
            yield conn.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS priceListId VARCHAR(36)
    `).catch(() => {
                // Ignore error if column already exists
            });
            // Add paidAmount column if it doesn't exist
            yield conn.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS paidAmount DECIMAL(15, 2) DEFAULT 0
    `).catch(() => {
                // Ignore error
            });
            // Add salesmanId column if it doesn't exist to track salesman per transaction
            yield conn.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS salesmanId VARCHAR(36)
    `).catch(() => {
                // Ignore error
            });
            // Add number column for readable invoice numbers (VAN-2025-00001)
            yield conn.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS number VARCHAR(50)
    `).catch(() => {
                // Ignore error
            });
            // Add createdBy column to track who created the invoice
            yield conn.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS createdBy VARCHAR(255)
    `).catch(() => {
                // Ignore error
            });
            // Add referenceInvoiceId column to link treasury receipts to their source invoices
            yield conn.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS referenceInvoiceId VARCHAR(36) COMMENT 'Links receipts to their source invoice'
    `).catch(() => {
                // Ignore error
            });
            // Add index on referenceInvoiceId for faster lookups
            yield conn.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_referenceInvoiceId ON invoices(referenceInvoiceId)
    `).catch(() => {
                // Ignore error if index exists
            });
            // Add paymentBreakdown column for detailed payment info
            yield conn.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS paymentBreakdown TEXT COMMENT 'JSON breakdown of payment methods'
    `).catch(() => {
                // Ignore error
            });
            // Invoice Lines Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS invoice_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoiceId VARCHAR(36) NOT NULL,
        productId VARCHAR(36),
        productName VARCHAR(255),
        quantity INT DEFAULT 0,
        price DECIMAL(15, 2) DEFAULT 0,
        cost DECIMAL(15, 2) DEFAULT 0,
        discount DECIMAL(15, 2) DEFAULT 0,
        total DECIMAL(15, 2) DEFAULT 0,
        FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL
      )
    `);
            // Deleted Invoices Table (Archive for audit trail and recovery)
            yield conn.query(`
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
        deletedBy VARCHAR(255) NOT NULL,
        deletedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deletionReason TEXT,
        INDEX idx_deleted_invoices_original_id (original_id),
        INDEX idx_deleted_invoices_deletedAt (deletedAt),
        INDEX idx_deleted_invoices_deletedBy (deletedBy),
        INDEX idx_deleted_invoices_type (type),
        INDEX idx_deleted_invoices_partnerId (partnerId)
      )
    `);
            // Deleted Invoice Lines Table
            yield conn.query(`
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
      )
    `);
            // Journal Entries Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id VARCHAR(36) PRIMARY KEY,
        date DATETIME NOT NULL,
        description TEXT,
        referenceId VARCHAR(36)
      )
    `);
            // Journal Lines Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS journal_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        journalId VARCHAR(36) NOT NULL,
        accountId VARCHAR(36) NOT NULL,
        accountName VARCHAR(255),
        debit DECIMAL(15, 2) DEFAULT 0,
        credit DECIMAL(15, 2) DEFAULT 0,
        costCenterId VARCHAR(36),
        FOREIGN KEY (journalId) REFERENCES journal_entries(id) ON DELETE CASCADE,
        FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);
            // Cheques Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS cheques (
        id VARCHAR(36) PRIMARY KEY,
        number VARCHAR(50),
        bankName VARCHAR(100),
        amount DECIMAL(15, 2) DEFAULT 0,
        dueDate DATETIME,
        status VARCHAR(50),
        type VARCHAR(50),
        partnerId VARCHAR(36),
        partnerName VARCHAR(255),
        description TEXT,
        createdDate DATETIME,
        bankAccountId VARCHAR(36),
        bounceReason TEXT,
        FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE SET NULL
      )
    `);
            // Installment Plans Table - خطط التقسيط
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS installment_plans (
        id VARCHAR(36) PRIMARY KEY,
        invoiceId VARCHAR(36) NOT NULL,
        partnerId VARCHAR(36) NOT NULL,
        partnerName VARCHAR(255),
        totalAmount DECIMAL(15, 2) NOT NULL,
        downPayment DECIMAL(15, 2) DEFAULT 0,
        remainingAmount DECIMAL(15, 2) NOT NULL,
        numberOfInstallments INT NOT NULL,
        intervalDays INT DEFAULT 30,
        startDate DATE NOT NULL,
        status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED', 'OVERDUE') DEFAULT 'ACTIVE',
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdBy VARCHAR(100),
        FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE CASCADE,
        INDEX idx_installment_plan_partner (partnerId),
        INDEX idx_installment_plan_invoice (invoiceId),
        INDEX idx_installment_plan_status (status)
      )
    `);
            // Installments Table - الأقساط الفردية
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS installments (
        id VARCHAR(36) PRIMARY KEY,
        planId VARCHAR(36) NOT NULL,
        installmentNumber INT NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        dueDate DATE NOT NULL,
        paidAmount DECIMAL(15, 2) DEFAULT 0,
        paidDate DATETIME,
        status ENUM('PENDING', 'PARTIAL', 'PAID', 'OVERDUE') DEFAULT 'PENDING',
        paymentMethod VARCHAR(50),
        paymentReference VARCHAR(100),
        notes TEXT,
        FOREIGN KEY (planId) REFERENCES installment_plans(id) ON DELETE CASCADE,
        INDEX idx_installment_plan (planId),
        INDEX idx_installment_due_date (dueDate),
        INDEX idx_installment_status (status)
      )
    `);
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS banks (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        accountNumber VARCHAR(100),
        currency VARCHAR(10),
        balance DECIMAL(15, 2) DEFAULT 0,
        branch VARCHAR(100),
        iban VARCHAR(100),
        swift VARCHAR(50),
        type VARCHAR(50),
        accountId VARCHAR(36),
        color VARCHAR(100)
      )
    `);
            // Fixed Assets Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS fixed_assets (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        purchaseDate DATETIME,
        purchaseCost DECIMAL(15, 2) DEFAULT 0,
        salvageValue DECIMAL(15, 2) DEFAULT 0,
        lifeYears INT,
        assetAccountId VARCHAR(36),
        accumulatedDepreciationAccountId VARCHAR(36),
        expenseAccountId VARCHAR(36),
        status VARCHAR(50),
        lastDepreciationDate DATETIME
      )
    `);
            // Stock Permits Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS stock_permits (
        id VARCHAR(36) PRIMARY KEY,
        number INT AUTO_INCREMENT UNIQUE,
        date DATETIME NOT NULL,
        type VARCHAR(50),
        description TEXT,
        sourceWarehouseId VARCHAR(36),
        destWarehouseId VARCHAR(36),
        createdBy VARCHAR(100),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
            // Stock Permit Items Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS stock_permit_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        permitId VARCHAR(36) NOT NULL,
        productId VARCHAR(36),
        productName VARCHAR(255),
        quantity DECIMAL(18, 8) DEFAULT 0,
        cost DECIMAL(15, 2) DEFAULT 0,
        FOREIGN KEY (permitId) REFERENCES stock_permits(id) ON DELETE CASCADE,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL
      )
    `);
            // Migrations for stock permit tables (for existing databases)
            yield conn.query(`
      ALTER TABLE stock_permits 
      ADD COLUMN IF NOT EXISTS createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    `).catch(() => {
                // Ignore error if column already exists
            });
            yield conn.query(`
      ALTER TABLE stock_permits 
      ADD COLUMN IF NOT EXISTS number INT AUTO_INCREMENT UNIQUE
    `).catch(() => {
                // Ignore error if column already exists
            });
            yield conn.query(`
      ALTER TABLE stock_permits 
      ADD COLUMN IF NOT EXISTS updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    `).catch(() => {
                // Ignore error if column already exists
            });
            yield conn.query(`
      ALTER TABLE stock_permits 
      ADD COLUMN IF NOT EXISTS createdBy VARCHAR(100)
    `).catch(() => {
                // Ignore error if column already exists
            });
            yield conn.query(`
      ALTER TABLE stock_permit_items 
      ADD COLUMN IF NOT EXISTS productName VARCHAR(255)
    `).catch(() => {
                // Ignore error if column already exists
            });
            yield conn.query(`
      ALTER TABLE stock_permit_items 
      ADD COLUMN IF NOT EXISTS driverName VARCHAR(255)
    `).catch(() => {
                // Ignore error if column already exists
            });
            // Users Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(100) UNIQUE,
        username VARCHAR(100),
        password VARCHAR(255),
        role VARCHAR(50),
        status VARCHAR(50),
        permissions TEXT,
        lastLogin DATETIME,
        avatar TEXT,
        isHidden BOOLEAN DEFAULT FALSE,
        salesmanId VARCHAR(36)
      )
    `);
            // Add salesmanId column if it doesn't exist (for existing databases)
            yield conn.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS salesmanId VARCHAR(36)
    `).catch(() => { });
            // System Config Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        companyName VARCHAR(255),
        companyAddress TEXT,
        companyPhone VARCHAR(50),
        companyEmail VARCHAR(100),
        taxId VARCHAR(50),
        commercialRegister VARCHAR(50),
        currency VARCHAR(10),
        vatRate DECIMAL(5, 2) DEFAULT 15,
        config JSON,
        enabledModules JSON
      )
    `);
            // Migration: Add enabledModules column for existing databases
            yield conn.query(`
      ALTER TABLE system_config 
      ADD COLUMN IF NOT EXISTS enabledModules JSON
    `).catch(() => {
                // Ignore error if column already exists
            });
            // Migration: Add isHidden column to users table for existing databases
            yield conn.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS isHidden BOOLEAN DEFAULT FALSE
    `).catch(() => {
                // Ignore error if column already exists
            });
            // Migration: Add salesmanId column to users table for salesman data isolation
            yield conn.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS salesmanId VARCHAR(36)
    `).catch(() => {
                // Ignore error if column already exists
            });
            // Add index for users.salesmanId
            try {
                yield conn.query('CREATE INDEX idx_users_salesmanId ON users(salesmanId)');
            }
            catch (e) { /* Ignore if exists */ }
            // Migration: Add preferences column to users table for storing user preferences (column visibility, etc.)
            yield conn.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS preferences JSON NULL
    `).catch(() => {
                // Ignore error if column already exists
            });
            // Taxes Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS taxes (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        rate DECIMAL(5, 2) DEFAULT 0,
        type VARCHAR(50)
      )
    `);
            // Cost Centers Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS cost_centers (
        id VARCHAR(36) PRIMARY KEY,
        code VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        description TEXT
      )
    `);
            // Cash Categories Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS cash_categories (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50),
        accountId VARCHAR(36)
      )
    `);
            // Add accountId column to cash_categories if it doesn't exist
            yield conn.query(`
      ALTER TABLE cash_categories 
      ADD COLUMN IF NOT EXISTS accountId VARCHAR(36)
    `).catch(() => {
                // Ignore error
            });
            // Add parentId column to cash_categories for subcategories support
            yield conn.query(`
      ALTER TABLE cash_categories 
      ADD COLUMN IF NOT EXISTS parentId VARCHAR(36)
    `).catch(() => {
                // Ignore error
            });
            // Stock Taking Sessions Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS stock_taking_sessions (
        id VARCHAR(36) PRIMARY KEY,
        date DATETIME NOT NULL,
        warehouseId VARCHAR(36),
        status VARCHAR(50)
      )
    `);
            // Stock Taking Items Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS stock_taking_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sessionId VARCHAR(36) NOT NULL,
        productId VARCHAR(36),
        systemStock INT DEFAULT 0,
        actualStock INT DEFAULT 0,
        cost DECIMAL(15, 2) DEFAULT 0,
        touched BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (sessionId) REFERENCES stock_taking_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL
      )
    `);
            // ========================================
            // BRANCHES & WAREHOUSES (Must be created before product_stocks)
            // ========================================
            // Branches Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location TEXT,
        manager VARCHAR(100),
        phone VARCHAR(50)
      )
    `);
            // Warehouses Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        branchId VARCHAR(36),
        keeper VARCHAR(100),
        phone VARCHAR(50),
        FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE SET NULL
      )
    `);
            // Product Stocks Table (depends on warehouses)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS product_stocks (
        id VARCHAR(36) PRIMARY KEY,
        productId VARCHAR(36) NOT NULL,
        warehouseId VARCHAR(36) NOT NULL,
        stock DECIMAL(18, 8) DEFAULT 0,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE CASCADE,
        UNIQUE KEY unique_stock (productId, warehouseId)
      )
    `);
            // ========================================
            // MULTI-UNIT SELLING (البيع بوحدات متعددة)
            // ========================================
            // Product Units Table (وحدات قياس المنتج)
            yield conn.query(`
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
      )
    `);
            // Migration: Add multi-unit columns to invoice_lines
            yield conn.query(`
      ALTER TABLE invoice_lines 
      ADD COLUMN IF NOT EXISTS unitId VARCHAR(36) COMMENT 'وحدة البيع المستخدمة'
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE invoice_lines 
      ADD COLUMN IF NOT EXISTS unitName VARCHAR(50) COMMENT 'اسم الوحدة'
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE invoice_lines 
      ADD COLUMN IF NOT EXISTS conversionFactor DECIMAL(15,4) DEFAULT 1 COMMENT 'عامل التحويل'
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE invoice_lines 
      ADD COLUMN IF NOT EXISTS baseQuantity DECIMAL(15,3) COMMENT 'الكمية بالوحدة الأساسية'
    `).catch(() => { });
            // Migration: Add multi-unit columns to products table
            yield conn.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS baseUnit VARCHAR(50) DEFAULT 'piece' COMMENT 'الوحدة الأساسية للمخزون'
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS hasMultipleUnits BOOLEAN DEFAULT FALSE COMMENT 'هل للمنتج وحدات متعددة؟'
    `).catch(() => { });
            // Partner Groups Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS partner_groups (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50),
        description TEXT
      )
    `);
            // (Branches and Warehouses tables already created above)
            // Categories Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT
      )
    `);
            // Salesmen Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS salesmen (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        target DECIMAL(15, 2),
        achieved DECIMAL(15, 2),
        commissionRate DECIMAL(5, 2),
        region VARCHAR(100)
      )
    `);
            // Add type column to salesmen table if it doesn't exist
            yield conn.query(`
      ALTER TABLE salesmen 
      ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'SALES'
    `).catch(() => {
                // Ignore error if column already exists
            });
            // Add userId column to salesmen table for data isolation
            yield conn.query(`
      ALTER TABLE salesmen 
      ADD COLUMN IF NOT EXISTS userId VARCHAR(36)
    `).catch(() => {
                // Ignore error if column already exists
            });
            // Add targetType column to salesmen table (AMOUNT or PRODUCTS)
            yield conn.query(`
      ALTER TABLE salesmen 
      ADD COLUMN IF NOT EXISTS targetType VARCHAR(20) DEFAULT 'AMOUNT'
    `).catch(() => {
                // Ignore error if column already exists
            });
            // Add unique index on userId to ensure one-to-one relationship
            yield conn.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_salesmen_userId ON salesmen(userId)
    `).catch(() => {
                // Ignore error if index already exists
            });
            // Salesman Targets Table (أهداف المندوبين - حسب الصنف/الفئة)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS salesman_targets (
        id VARCHAR(36) PRIMARY KEY,
        salesmanId VARCHAR(36) NOT NULL,
        targetType ENUM('PRODUCT', 'CATEGORY') NOT NULL DEFAULT 'PRODUCT',
        productId VARCHAR(36) NULL,
        categoryId VARCHAR(36) NULL,
        targetQuantity DECIMAL(15,3) NOT NULL DEFAULT 0,
        targetAmount DECIMAL(15,2) NULL,
        achievedQuantity DECIMAL(15,3) DEFAULT 0,
        achievedAmount DECIMAL(15,2) DEFAULT 0,
        periodType ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
        periodStart DATE NOT NULL,
        periodEnd DATE NOT NULL,
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (salesmanId) REFERENCES salesmen(id) ON DELETE CASCADE,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
        INDEX idx_salesman (salesmanId),
        INDEX idx_product (productId),
        INDEX idx_category (categoryId),
        INDEX idx_period (periodStart, periodEnd),
        INDEX idx_active (isActive)
      )
    `);
            // Commission Tiers Table (نسب العمولة المتدرجة)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS commission_tiers (
        id VARCHAR(36) PRIMARY KEY,
        salesmanId VARCHAR(36) NULL,
        tierName VARCHAR(100) NOT NULL,
        minAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
        maxAmount DECIMAL(15,2) NULL,
        commissionRate DECIMAL(5,2) NOT NULL DEFAULT 0,
        isGlobal BOOLEAN DEFAULT FALSE,
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (salesmanId) REFERENCES salesmen(id) ON DELETE CASCADE,
        INDEX idx_salesman (salesmanId),
        INDEX idx_active (isActive)
      )
    `);
            // Commission Records Table (سجلات العمولات)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS commission_records (
        id VARCHAR(36) PRIMARY KEY,
        salesmanId VARCHAR(36) NOT NULL,
        periodStart DATE NOT NULL,
        periodEnd DATE NOT NULL,
        totalSales DECIMAL(15,2) NOT NULL DEFAULT 0,
        totalReturns DECIMAL(15,2) NOT NULL DEFAULT 0,
        netSales DECIMAL(15,2) NOT NULL DEFAULT 0,
        commissionRate DECIMAL(5,2) NOT NULL DEFAULT 0,
        commissionAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
        bonusAmount DECIMAL(15,2) DEFAULT 0,
        deductions DECIMAL(15,2) DEFAULT 0,
        finalAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
        status ENUM('PENDING', 'APPROVED', 'PAID', 'REJECTED') DEFAULT 'PENDING',
        approvedBy VARCHAR(36) NULL,
        approvedAt TIMESTAMP NULL,
        paidAt TIMESTAMP NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (salesmanId) REFERENCES salesmen(id) ON DELETE CASCADE,
        FOREIGN KEY (approvedBy) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_salesman (salesmanId),
        INDEX idx_period (periodStart, periodEnd),
        INDEX idx_status (status)
      )
    `);
            // Salesman Customer Assignments (تخصيص العملاء للمندوبين)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS salesman_customers (
        id VARCHAR(36) PRIMARY KEY,
        salesmanId VARCHAR(36) NOT NULL,
        partnerId VARCHAR(36) NOT NULL,
        assignedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (salesmanId) REFERENCES salesmen(id) ON DELETE CASCADE,
        FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE CASCADE,
        UNIQUE KEY unique_assignment (salesmanId, partnerId),
        INDEX idx_salesman (salesmanId),
        INDEX idx_partner (partnerId)
      )
    `);
            // Price Lists Table (Global/Master Data)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS price_lists (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        isActive BOOLEAN DEFAULT TRUE,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
            // Product Prices Table (Junction: Product ↔ Price List)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS product_prices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        productId VARCHAR(36) NOT NULL,
        priceListId VARCHAR(36) NOT NULL,
        price DECIMAL(15, 2) DEFAULT 0,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (priceListId) REFERENCES price_lists(id) ON DELETE CASCADE,
        UNIQUE KEY unique_product_price (productId, priceListId)
      )
    `);
            // Audit Logs Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        date DATETIME NOT NULL,
        user VARCHAR(100),
        module VARCHAR(50),
        action VARCHAR(50),
        description TEXT,
        details TEXT
      )
    `);
            // Migration: Add description column if it doesn't exist (MariaDB compatible)
            try {
                yield conn.query(`ALTER TABLE audit_logs ADD COLUMN description TEXT AFTER action`);
                console.log('✅ Added description column to audit_logs table');
            }
            catch (err) {
                // Column already exists or other error - ignore
                if (!err.message.includes('Duplicate column')) {
                    console.log('ℹ️ audit_logs.description column already exists or migration skipped');
                }
            }
            // Payment Allocations Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS payment_allocations (
        id VARCHAR(36) PRIMARY KEY,
        paymentId VARCHAR(36) NOT NULL,
        invoiceId VARCHAR(36) NOT NULL,
        amount DECIMAL(15, 2) DEFAULT 0,
        FOREIGN KEY (paymentId) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
      )
    `);
            // Permissions Table (Master List)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id VARCHAR(100) PRIMARY KEY,
        label VARCHAR(255) NOT NULL,
        module VARCHAR(100) NOT NULL
      )
    `);
            // ========================================
            // MANUFACTURING MODULE TABLES
            // ========================================
            // Bills of Materials (BOM) Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS bom (
        id VARCHAR(36) PRIMARY KEY,
        finished_product_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        version INT DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        labor_cost DECIMAL(15,2) DEFAULT 0,
        overhead_cost DECIMAL(15,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (finished_product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_finished_product (finished_product_id),
        INDEX idx_active (is_active),
        INDEX idx_name (name)
      )
    `);
            // BOM Items Table (Junction: BOM ↔ Raw Materials)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS bom_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bom_id VARCHAR(36) NOT NULL,
        raw_product_id VARCHAR(36) NOT NULL,
        quantity_per_unit DECIMAL(18,8) NOT NULL,
        waste_percent DECIMAL(5,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bom_id) REFERENCES bom(id) ON DELETE CASCADE,
        FOREIGN KEY (raw_product_id) REFERENCES products(id) ON DELETE RESTRICT,
        INDEX idx_bom (bom_id),
        INDEX idx_raw_product (raw_product_id),
        UNIQUE KEY unique_bom_product (bom_id, raw_product_id)
      )
    `);
            // Production Orders Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS production_orders (
        id VARCHAR(36) PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        bom_id VARCHAR(36) NOT NULL,
        finished_product_id VARCHAR(36) NOT NULL,
        qty_planned DECIMAL(15,3) NOT NULL,
        qty_finished DECIMAL(15,3) DEFAULT 0,
        qty_scrapped DECIMAL(15,3) DEFAULT 0,
        status ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PLANNED',
        start_date DATE,
        end_date DATE,
        actual_start_date TIMESTAMP NULL,
        actual_end_date TIMESTAMP NULL,
        warehouse_id VARCHAR(36),
        source_warehouse_id VARCHAR(36),
        dest_warehouse_id VARCHAR(36),
        notes TEXT,
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (bom_id) REFERENCES bom(id) ON DELETE RESTRICT,
        FOREIGN KEY (finished_product_id) REFERENCES products(id) ON DELETE RESTRICT,
        INDEX idx_status (status),
        INDEX idx_order_number (order_number),
        INDEX idx_dates (start_date, end_date),
        INDEX idx_product (finished_product_id),
        INDEX idx_created_at (created_at)
      )
    `);
            // Migration: Add source_warehouse_id and dest_warehouse_id columns for existing databases
            yield conn.query(`
      ALTER TABLE production_orders 
      ADD COLUMN IF NOT EXISTS source_warehouse_id VARCHAR(36)
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE production_orders 
      ADD COLUMN IF NOT EXISTS dest_warehouse_id VARCHAR(36)
    `).catch(() => { });
            // Migration: Add indexes to partners table for performance
            try {
                yield conn.query('CREATE INDEX idx_type ON partners(type)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_isCustomer ON partners(isCustomer)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_isSupplier ON partners(isSupplier)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_balance ON partners(balance)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_name ON partners(name)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_phone ON partners(phone)');
            }
            catch (e) { /* Ignore if exists */ }
            // ========================================
            // COMPREHENSIVE PERFORMANCE INDEXES
            // Added: 2025-11-30 for improved query performance
            // ========================================
            // Invoices table indexes - Critical for partner statements and reports
            try {
                yield conn.query('CREATE INDEX idx_invoices_date ON invoices(date)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_invoices_type ON invoices(type)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_invoices_partnerId ON invoices(partnerId)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_invoices_status ON invoices(status)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_invoices_posted ON invoices(posted)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_invoices_warehouseId ON invoices(warehouseId)');
            }
            catch (e) { /* Ignore if exists */ }
            // Journal entries and lines indexes
            try {
                yield conn.query('CREATE INDEX idx_journal_entries_date ON journal_entries(date)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_journal_entries_referenceId ON journal_entries(referenceId)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_journal_lines_accountId ON journal_lines(accountId)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_journal_lines_journalId ON journal_lines(journalId)');
            }
            catch (e) { /* Ignore if exists */ }
            // Accounts table indexes
            try {
                yield conn.query('CREATE INDEX idx_accounts_type ON accounts(type)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_accounts_code ON accounts(code)');
            }
            catch (e) { /* Ignore if exists */ }
            // Cheques table indexes - Important for cheque management
            try {
                yield conn.query('CREATE INDEX idx_cheques_status ON cheques(status)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_cheques_type ON cheques(type)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_cheques_dueDate ON cheques(dueDate)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_cheques_partnerId ON cheques(partnerId)');
            }
            catch (e) { /* Ignore if exists */ }
            // Payment allocations indexes
            try {
                yield conn.query('CREATE INDEX idx_payment_allocations_paymentId ON payment_allocations(paymentId)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_payment_allocations_invoiceId ON payment_allocations(invoiceId)');
            }
            catch (e) { /* Ignore if exists */ }
            // Invoice lines indexes
            try {
                yield conn.query('CREATE INDEX idx_invoice_lines_productId ON invoice_lines(productId)');
            }
            catch (e) { /* Ignore if exists */ }
            // Audit logs indexes
            try {
                yield conn.query('CREATE INDEX idx_audit_logs_date ON audit_logs(date)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_audit_logs_user ON audit_logs(user)');
            }
            catch (e) { /* Ignore if exists */ }
            try {
                yield conn.query('CREATE INDEX idx_audit_logs_module ON audit_logs(module)');
            }
            catch (e) { /* Ignore if exists */ }
            // Migration: Add createdBy column to journal_entries
            yield conn.query(`
      ALTER TABLE journal_entries 
      ADD COLUMN IF NOT EXISTS createdBy VARCHAR(100)
    `).catch(() => {
                // Ignore error if column already exists
            });
            // Add index for createdBy
            try {
                yield conn.query('CREATE INDEX idx_journal_entries_createdBy ON journal_entries(createdBy)');
            }
            catch (e) { /* Ignore if exists */ }
            // Migration: Add salesmanId column to journal_entries for transaction tracking
            yield conn.query(`
      ALTER TABLE journal_entries 
      ADD COLUMN IF NOT EXISTS salesmanId VARCHAR(36)
    `).catch(() => {
                // Ignore error if column already exists
            });
            // Add index for salesmanId in journal_entries
            try {
                yield conn.query('CREATE INDEX idx_journal_entries_salesmanId ON journal_entries(salesmanId)');
            }
            catch (e) { /* Ignore if exists */ }
            // Migration: Add createdBy to other tables
            const tablesToAddCreatedBy = ['invoices', 'cheques', 'stock_permits'];
            for (const table of tablesToAddCreatedBy) {
                yield conn.query(`
        ALTER TABLE ${table} 
        ADD COLUMN IF NOT EXISTS createdBy VARCHAR(100)
      `).catch(() => { });
                try {
                    yield conn.query(`CREATE INDEX idx_${table}_createdBy ON ${table}(createdBy)`);
                }
                catch (e) { /* Ignore if exists */ }
            }
            // Fixed assets indexes
            try {
                yield conn.query('CREATE INDEX idx_fixed_assets_status ON fixed_assets(status)');
            }
            catch (e) { /* Ignore if exists */ }
            console.log('✅ All performance indexes created successfully');
            // Stock Movements Table (Inventory Movement History)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        product_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36),
        qty_change DECIMAL(15,3) NOT NULL,
        movement_type ENUM(
          'PURCHASE', 'SALE', 'RETURN_IN', 'RETURN_OUT',
          'PRODUCTION_USE', 'PRODUCTION_OUTPUT',
          'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT',
          'OPENING_BALANCE', 'SCRAP'
        ) NOT NULL,
        reference_type VARCHAR(50),
        reference_id VARCHAR(36),
        unit_cost DECIMAL(15,2),
        notes TEXT,
        created_by VARCHAR(50),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
        INDEX idx_product (product_id),
        INDEX idx_date (movement_date),
        INDEX idx_type (movement_type),
        INDEX idx_warehouse (warehouse_id),
        INDEX idx_product_warehouse (product_id, warehouse_id),
        INDEX idx_reference (reference_type, reference_id)
      )
    `);
            // ========================================
            // MANUFACTURING MODULE MIGRATIONS
            // Added: 2025-12-09 for production batch tracking
            // ========================================
            // Migration: Add batch_id to stock_movements for batch tracking
            yield conn.query(`
      ALTER TABLE stock_movements 
      ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50)
    `).catch(() => { });
            // Migration: Add finished_batch_id to production_orders
            yield conn.query(`
      ALTER TABLE production_orders 
      ADD COLUMN IF NOT EXISTS finished_batch_id VARCHAR(50)
    `).catch(() => { });
            // Migration: Update production_orders status ENUM to include all statuses
            // Note: This might fail if ENUM already includes these values, which is fine
            try {
                yield conn.query(`
        ALTER TABLE production_orders 
        MODIFY COLUMN status ENUM('PLANNED', 'CONFIRMED', 'WAITING_MATERIALS', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PLANNED'
      `);
                console.log('✅ Updated production_orders status enum');
            }
            catch (e) {
                // Ignore if already updated
            }
            // Create inventory_batches table if not exists
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_batches (
        id VARCHAR(50) PRIMARY KEY,
        batch_number VARCHAR(100) UNIQUE NOT NULL,
        product_id VARCHAR(50) NOT NULL,
        warehouse_id VARCHAR(50),
        quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
        available_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
        unit_cost DECIMAL(15,2),
        manufacture_date DATE,
        expiry_date DATE,
        supplier_batch VARCHAR(100),
        supplier_id VARCHAR(50),
        production_order_id VARCHAR(50),
        status ENUM('ACTIVE', 'QUARANTINE', 'EXPIRED', 'CONSUMED') DEFAULT 'ACTIVE',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_batch_number (batch_number),
        INDEX idx_product (product_id),
        INDEX idx_status (status)
      )
    `);
            // Create batch_genealogy table if not exists
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS batch_genealogy (
        id VARCHAR(50) PRIMARY KEY,
        child_batch_id VARCHAR(50) NOT NULL,
        parent_batch_id VARCHAR(50) NOT NULL,
        production_order_id VARCHAR(50) NOT NULL,
        quantity_consumed DECIMAL(15,3) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_child (child_batch_id),
        INDEX idx_parent (parent_batch_id),
        INDEX idx_production_order (production_order_id)
      )
    `);
            // Material Reservations Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS material_reservations (
        id VARCHAR(36) PRIMARY KEY,
        productionOrderId VARCHAR(36) NOT NULL,
        productId VARCHAR(36) NOT NULL,
        warehouseId VARCHAR(36),
        quantityReserved DECIMAL(15,4) NOT NULL,
        quantityConsumed DECIMAL(15,4) DEFAULT 0,
        status ENUM('RESERVED', 'PARTIALLY_CONSUMED', 'FULLY_CONSUMED', 'RELEASED') DEFAULT 'RESERVED',
        reservedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        releasedAt TIMESTAMP NULL,
        INDEX idx_order (productionOrderId),
        INDEX idx_product (productId),
        INDEX idx_status (status)
      )
    `);
            // Production Scrap Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS production_scrap (
        id VARCHAR(36) PRIMARY KEY,
        production_order_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36),
        quantity DECIMAL(15,4) NOT NULL,
        unit VARCHAR(20),
        scrap_type ENUM('CUTTING_WASTE', 'DEFECTIVE_MATERIAL', 'PROCESS_LOSS', 'DAMAGED_GOODS', 'EXPIRED_MATERIALS', 'OTHER') DEFAULT 'CUTTING_WASTE',
        reason TEXT,
        unit_cost DECIMAL(15,4),
        total_value DECIMAL(15,2),
        disposal_status ENUM('PENDING', 'DISPOSED', 'SOLD', 'RECYCLED') DEFAULT 'PENDING',
        disposal_date TIMESTAMP NULL,
        disposal_notes TEXT,
        created_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_order (production_order_id),
        INDEX idx_product (product_id),
        INDEX idx_type (scrap_type),
        INDEX idx_status (disposal_status)
      )
    `);
            // Work Centers Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS work_centers (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50),
        capacity_per_hour DECIMAL(10,2) DEFAULT 0,
        cost_per_hour DECIMAL(10,2) DEFAULT 0,
        warehouse_id VARCHAR(50),
        status ENUM('ACTIVE', 'MAINTENANCE', 'INACTIVE') DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_status (status)
      )
    `);
            // Routings Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS routings (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        product_id VARCHAR(50) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_product (product_id),
        INDEX idx_active (is_active)
      )
    `);
            // Routing Steps Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS routing_steps (
        id VARCHAR(50) PRIMARY KEY,
        routing_id VARCHAR(50) NOT NULL,
        sequence_number INT NOT NULL,
        work_center_id VARCHAR(50) NOT NULL,
        operation_name VARCHAR(255) NOT NULL,
        description TEXT,
        setup_time_minutes DECIMAL(10,2) DEFAULT 0,
        run_time_minutes DECIMAL(10,2) DEFAULT 0,
        labor_cost_per_hour DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_routing (routing_id),
        INDEX idx_work_center (work_center_id)
      )
    `);
            // Quality Check Templates Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS quality_check_templates (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        product_id VARCHAR(50),
        description TEXT,
        check_type ENUM('INCOMING', 'IN_PROCESS', 'FINAL', 'PERIODIC') DEFAULT 'FINAL',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_product (product_id),
        INDEX idx_type (check_type),
        INDEX idx_active (is_active)
      )
    `);
            // Quality Criteria Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS quality_criteria (
        id VARCHAR(50) PRIMARY KEY,
        template_id VARCHAR(50) NOT NULL,
        sequence_number INT NOT NULL,
        criterion_name VARCHAR(255) NOT NULL,
        description TEXT,
        measurement_type ENUM('PASS_FAIL', 'NUMERIC', 'TEXT') DEFAULT 'PASS_FAIL',
        min_value DECIMAL(15,3),
        max_value DECIMAL(15,3),
        target_value DECIMAL(15,3),
        unit VARCHAR(50),
        is_critical BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_template (template_id),
        INDEX idx_critical (is_critical)
      )
    `);
            // Migration: Add variance analysis columns to production_orders
            yield conn.query(`
      ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS standard_cost DECIMAL(15,2) DEFAULT 0
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS actual_material_cost DECIMAL(15,2) DEFAULT 0
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS actual_scrap_cost DECIMAL(15,2) DEFAULT 0
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS material_variance DECIMAL(15,2) DEFAULT 0
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS yield_variance DECIMAL(15,2) DEFAULT 0
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS total_variance DECIMAL(15,2) DEFAULT 0
    `).catch(() => { });
            // Migration: Add priority and scheduling columns to production_orders
            yield conn.query(`
      ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS priority ENUM('HIGH', 'MEDIUM', 'LOW') DEFAULT 'MEDIUM'
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS scheduled_start_date DATE
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS scheduled_end_date DATE
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50)
    `).catch(() => { });
            // Migration: Add source and destination warehouse columns to production_orders
            // source_warehouse_id: where raw materials come from
            // dest_warehouse_id: where finished products go
            yield conn.query(`
      ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS source_warehouse_id VARCHAR(36)
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS dest_warehouse_id VARCHAR(36)
    `).catch(() => { });
            console.log('✅ Manufacturing module tables and migrations complete');
            // ========================================
            // HR & PAYROLL MODULE TABLES
            // ========================================
            // Employees Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id VARCHAR(36) PRIMARY KEY,
        fullName VARCHAR(255) NOT NULL,
        nationalId VARCHAR(50) UNIQUE,
        jobTitle VARCHAR(100),
        department VARCHAR(100),
        employmentType ENUM('MONTHLY', 'DAILY') DEFAULT 'MONTHLY',
        baseSalary DECIMAL(15, 2) DEFAULT 0,
        branchId VARCHAR(36),
        treasuryAccountId VARCHAR(36) COMMENT 'Account ID for payout (Treasury)',
        status ENUM('ACTIVE', 'INACTIVE', 'TERMINATED') DEFAULT 'ACTIVE',
        hireDate DATE,
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_branch (branchId),
        INDEX idx_status (status)
      )
    `);
            // Payroll Cycles Table (The master record for a month's payroll)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS payroll_cycles (
        id VARCHAR(36) PRIMARY KEY,
        month INT NOT NULL,
        year INT NOT NULL,
        status ENUM('DRAFT', 'REVIEW', 'APPROVED', 'PAID') DEFAULT 'DRAFT',
        totalAmount DECIMAL(15, 2) DEFAULT 0,
        generatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        approvedBy VARCHAR(36),
        approvedAt DATETIME,
        notes TEXT,
        UNIQUE KEY unique_period (month, year)
      )
    `);
            // Payroll Entries Table (Individual employee payroll details)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS payroll_entries (
        id VARCHAR(36) PRIMARY KEY,
        payrollId VARCHAR(36) NOT NULL,
        employeeId VARCHAR(36) NOT NULL,
        baseSalary DECIMAL(15, 2) DEFAULT 0,
        dailyRate DECIMAL(15, 2) DEFAULT 0 COMMENT 'قيمة وحدة اليوم',
        overtimeRate DECIMAL(15, 2) DEFAULT 0 COMMENT 'قيمة وحدة الأوفرتايم',
        overtimeHours DECIMAL(6, 2) DEFAULT 0 COMMENT 'عدد ساعات الأوفرتايم',
        overtimeAmount DECIMAL(15, 2) DEFAULT 0 COMMENT 'قيمة الأوفرتايم',
        incentives DECIMAL(15, 2) DEFAULT 0 COMMENT 'الحوافز',
        bonus DECIMAL(15, 2) DEFAULT 0 COMMENT 'مكافأة',
        allowances JSON COMMENT 'List of allowances {name, amount}',
        grossSalary DECIMAL(15, 2) DEFAULT 0 COMMENT 'إجمالي الراتب',
        purchases DECIMAL(15, 2) DEFAULT 0 COMMENT 'المشتريات',
        advances DECIMAL(15, 2) DEFAULT 0,
        absenceDays DECIMAL(6, 2) DEFAULT 0 COMMENT 'أيام الغياب',
        absenceAmount DECIMAL(15, 2) DEFAULT 0 COMMENT 'قيمة الغيابات',
        hourDeductions DECIMAL(15, 2) DEFAULT 0 COMMENT 'خصومات/ساعات',
        penaltyDays DECIMAL(6, 2) DEFAULT 0 COMMENT 'أيام الجزاءات',
        penalties DECIMAL(15, 2) DEFAULT 0 COMMENT 'الجزاءات',
        deductions JSON COMMENT 'List of deductions {name, amount}',
        totalDeductions DECIMAL(15, 2) DEFAULT 0 COMMENT 'إجمالي الاستقطاعات',
        netSalary DECIMAL(15, 2) DEFAULT 0,
        status ENUM('PENDING', 'PAID') DEFAULT 'PENDING',
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_payroll (payrollId),
        INDEX idx_employee (employeeId)
      )
    `);
            // Attendance Records Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id VARCHAR(36) PRIMARY KEY,
        employeeId VARCHAR(36) NOT NULL,
        date DATE NOT NULL,
        checkIn TIME,
        checkOut TIME,
        status ENUM('PRESENT', 'ABSENT', 'LATE', 'LEAVE') DEFAULT 'PRESENT',
        isOvertime BOOLEAN DEFAULT FALSE,
        overtimeHours DECIMAL(4, 2) DEFAULT 0,
        lateMinutes INT DEFAULT 0,
        earlyLeaveMinutes INT DEFAULT 0,
        scheduledCheckIn TIME DEFAULT '09:00:00',
        scheduledCheckOut TIME DEFAULT '17:00:00',
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_daily_attendance (employeeId, date),
        INDEX idx_date (date)
      )
    `);
            // Employee Advances / Loans Table
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS employee_advances (
        id VARCHAR(36) PRIMARY KEY,
        employeeId VARCHAR(36) NOT NULL,
        type ENUM('ADVANCE', 'LOAN') DEFAULT 'ADVANCE',
        amount DECIMAL(15, 2) NOT NULL,
        reason TEXT,
        issueDate DATE NOT NULL,
        monthlyDeduction DECIMAL(15, 2) DEFAULT 0 COMMENT 'Monthly deduction amount',
        totalPaid DECIMAL(15, 2) DEFAULT 0,
        remainingAmount DECIMAL(15, 2) DEFAULT 0,
        status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'ACTIVE',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_employee (employeeId),
        INDEX idx_status (status)
      )
    `);
            // Payroll Templates (Recurring Allowances/Deductions)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS payroll_templates (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type ENUM('ALLOWANCE', 'DEDUCTION') NOT NULL,
        calculationType ENUM('FIXED', 'PERCENTAGE') DEFAULT 'FIXED',
        amount DECIMAL(15, 2) DEFAULT 0,
        percentage DECIMAL(5, 2) DEFAULT 0,
        description TEXT,
        isActive BOOLEAN DEFAULT TRUE,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
            // Employee-Template Assignments
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS employee_payroll_templates (
        id VARCHAR(36) PRIMARY KEY,
        employeeId VARCHAR(36) NOT NULL,
        templateId VARCHAR(36) NOT NULL,
        customAmount DECIMAL(15, 2) DEFAULT NULL COMMENT 'Override template amount',
        isActive BOOLEAN DEFAULT TRUE,
        UNIQUE KEY unique_employee_template (employeeId, templateId)
      )
    `);
            // ========================================
            // ALL SYSTEM PERMISSIONS
            // ========================================
            // Sales Permissions (المبيعات)
            yield conn.query(`
      INSERT IGNORE INTO permissions (id, label, module) VALUES 
      ('sales.view', 'عرض فواتير المبيعات', 'المبيعات'),
      ('sales.create', 'إنشاء فاتورة مبيعات', 'المبيعات'),
      ('sales.edit', 'تعديل فواتير المبيعات', 'المبيعات'),
      ('sales.delete', 'حذف فواتير المبيعات', 'المبيعات'),
      ('sales.discount', 'تطبيق خصومات', 'المبيعات'),
      ('sales.return', 'مرتجعات المبيعات', 'المبيعات'),
      ('sales.void', 'إلغاء الفواتير', 'المبيعات'),
      ('sales.reports', 'تقارير المبيعات', 'المبيعات')
    `);
            // Purchase Permissions (المشتريات)
            yield conn.query(`
      INSERT IGNORE INTO permissions (id, label, module) VALUES 
      ('purchase.view', 'عرض فواتير المشتريات', 'المشتريات'),
      ('purchase.create', 'إنشاء فاتورة مشتريات', 'المشتريات'),
      ('purchase.edit', 'تعديل فواتير المشتريات', 'المشتريات'),
      ('purchase.delete', 'حذف فواتير المشتريات', 'المشتريات'),
      ('purchase.return', 'مرتجعات المشتريات', 'المشتريات'),
      ('purchase.reports', 'تقارير المشتريات', 'المشتريات')
    `);
            // Inventory Permissions (المخزون)
            yield conn.query(`
      INSERT IGNORE INTO permissions (id, label, module) VALUES 
      ('inventory.view', 'عرض المخزون', 'المخزون'),
      ('inventory.manage', 'إدارة الأصناف', 'المخزون'),
      ('inventory.adjust', 'تسوية المخزون', 'المخزون'),
      ('inventory.transfer', 'نقل بين المخازن', 'المخزون'),
      ('inventory.categories', 'إدارة التصنيفات', 'المخزون'),
      ('inventory.warehouses', 'إدارة المخازن', 'المخزون'),
      ('inventory.reports', 'تقارير المخزون', 'المخزون'),
      ('inventory.receipt.create', 'إنشاء إذن إضافة مخزني', 'المخزون'),
      ('inventory.receipt.edit', 'تعديل إذن إضافة مخزني', 'المخزون'),
      ('inventory.receipt.delete', 'حذف إذن إضافة مخزني', 'المخزون'),
      ('inventory.release.create', 'إنشاء إذن صرف مخزني', 'المخزون'),
      ('inventory.release.edit', 'تعديل إذن صرف مخزني', 'المخزون'),
      ('inventory.release.delete', 'حذف إذن صرف مخزني', 'المخزون')
    `);
            // Treasury Permissions (الخزينة)
            yield conn.query(`
      INSERT IGNORE INTO permissions (id, label, module) VALUES 
      ('treasury.view', 'عرض الخزينة', 'الخزينة'),
      ('treasury.receipt', 'سند قبض', 'الخزينة'),
      ('treasury.payment', 'سند صرف', 'الخزينة'),
      ('treasury.transfer', 'تحويل بين الخزائن', 'الخزينة'),
      ('treasury.manage', 'إدارة الصناديق', 'الخزينة'),
      ('treasury.cheques', 'إدارة الشيكات', 'الخزينة'),
      ('treasury.reports', 'تقارير الخزينة', 'الخزينة')
    `);
            // Accounting Permissions (الحسابات)
            yield conn.query(`
      INSERT IGNORE INTO permissions (id, label, module) VALUES 
      ('accounting.view', 'عرض الحسابات', 'الحسابات'),
      ('accounting.journal', 'قيود يومية', 'الحسابات'),
      ('accounting.statement', 'كشوف حساب', 'الحسابات'),
      ('accounting.manage', 'إدارة شجرة الحسابات', 'الحسابات'),
      ('accounting.costcenters', 'مراكز التكلفة', 'الحسابات'),
      ('accounting.reports', 'تقارير مالية', 'الحسابات')
    `);
            // Partners Permissions (العملاء والموردين)
            yield conn.query(`
      INSERT IGNORE INTO permissions (id, label, module) VALUES 
      ('partners.view', 'عرض العملاء والموردين', 'العملاء والموردين'),
      ('partners.create', 'إضافة عميل/مورد', 'العملاء والموردين'),
      ('partners.edit', 'تعديل عميل/مورد', 'العملاء والموردين'),
      ('partners.delete', 'حذف عميل/مورد', 'العملاء والموردين'),
      ('partners.statement', 'كشف حساب العميل', 'العملاء والموردين'),
      ('partners.credit', 'إدارة حدود الائتمان', 'العملاء والموردين')
    `);
            // System Settings Permissions (الإعدادات)
            yield conn.query(`
      INSERT IGNORE INTO permissions (id, label, module) VALUES 
      ('system.settings', 'إعدادات النظام', 'الإعدادات'),
      ('system.users', 'إدارة المستخدمين', 'الإعدادات'),
      ('system.backup', 'النسخ الاحتياطي', 'الإعدادات'),
      ('system.migration', 'ترحيل البيانات', 'الإعدادات'),
      ('system.reports', 'كل التقارير', 'الإعدادات')
    `);
            // HR Permissions
            yield conn.query(`
      INSERT IGNORE INTO permissions (id, label, module) VALUES 
      ('hr.view', 'عرض الموظفين', 'الموارد البشرية'),
      ('hr.manage', 'إدارة الموظفين', 'الموارد البشرية'),
      ('payroll.view', 'عرض كشف المرتبات', 'الموارد البشرية'),
      ('payroll.manage', 'إدارة المرتبات', 'الموارد البشرية'),
      ('attendance.manage', 'إدارة الحضور والانصراف', 'الموارد البشرية')
    `);
            console.log('✅ All permissions inserted');
            // ========================================
            // USER BACKUP SETTINGS TABLE
            // Per-user backup scheduling and delivery preferences
            // ========================================
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS user_backup_settings (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        scheduleEnabled BOOLEAN DEFAULT FALSE,
        scheduleFrequency ENUM('daily', 'weekly', 'monthly', 'hourly') DEFAULT 'daily',
        scheduleHour INT DEFAULT 2,
        scheduleMinute INT DEFAULT 0,
        scheduleDayOfWeek INT DEFAULT 0,
        scheduleDayOfMonth INT DEFAULT 1,
        backupPath VARCHAR(500),
        deliveryEmail VARCHAR(255),
        lastBackupDate DATETIME,
        lastBackupStatus VARCHAR(50),
        lastBackupFilename VARCHAR(255),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_backup (userId),
        INDEX idx_schedule_enabled (scheduleEnabled),
        INDEX idx_user (userId)
      )
    `);
            // Migration: Add backupPath column if it doesn't exist
            yield conn.query(`
      ALTER TABLE user_backup_settings 
      ADD COLUMN IF NOT EXISTS backupPath VARCHAR(500)
    `).catch(() => { });
            console.log('✅ User backup settings table ready');
            // ========================================
            // VAN SALES / MOBILE DISTRIBUTION TABLES
            // نظام المبيعات المتنقلة
            // ========================================
            // Vehicles Table (السيارات)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id VARCHAR(36) PRIMARY KEY,
        plateNumber VARCHAR(50) NOT NULL,
        name VARCHAR(100),
        type VARCHAR(50),
        capacity DECIMAL(10,2),
        salesmanId VARCHAR(36),
        warehouseId VARCHAR(36),
        status VARCHAR(20) DEFAULT 'AVAILABLE',
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_vehicle_status (status),
        INDEX idx_vehicle_salesman (salesmanId),
        INDEX idx_vehicle_warehouse (warehouseId)
      )
    `);
            // Vehicle Inventory Table (جرد السيارة)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_inventory (
        id VARCHAR(36) PRIMARY KEY,
        vehicleId VARCHAR(36) NOT NULL,
        productId VARCHAR(36) NOT NULL,
        quantity DECIMAL(15,3) DEFAULT 0,
        lastLoadDate DATETIME,
        FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_vehicle_product (vehicleId, productId),
        INDEX idx_vehicle_inv_vehicle (vehicleId),
        INDEX idx_vehicle_inv_product (productId)
      )
    `);
            // Vehicle Operations Table (عمليات التحميل والتفريغ)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_operations (
        id VARCHAR(36) PRIMARY KEY,
        vehicleId VARCHAR(36) NOT NULL,
        operationType VARCHAR(20) NOT NULL,
        date DATETIME NOT NULL,
        warehouseId VARCHAR(36),
        notes TEXT,
        createdBy VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE,
        INDEX idx_vehicle_op_vehicle (vehicleId),
        INDEX idx_vehicle_op_type (operationType),
        INDEX idx_vehicle_op_date (date)
      )
    `);
            // Vehicle Operation Items Table (تفاصيل العملية)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_operation_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        operationId VARCHAR(36) NOT NULL,
        productId VARCHAR(36),
        productName VARCHAR(255),
        quantity DECIMAL(15,3) NOT NULL,
        cost DECIMAL(15,2) DEFAULT 0,
        FOREIGN KEY (operationId) REFERENCES vehicle_operations(id) ON DELETE CASCADE,
        INDEX idx_vehicle_op_items_op (operationId)
      )
    `);
            // Van Sales Permissions
            yield conn.query(`
      INSERT IGNORE INTO permissions (id, label, module) VALUES 
      ('vansales.view', 'عرض المبيعات المتنقلة', 'المبيعات المتنقلة'),
      ('vansales.manage', 'إدارة السيارات', 'المبيعات المتنقلة'),
      ('vansales.operations', 'عمليات التحميل والتفريغ', 'المبيعات المتنقلة'),
      ('vansales.visits', 'تتبع زيارات العملاء', 'المبيعات المتنقلة'),
      ('vansales.settlement', 'تسوية نهاية اليوم', 'المبيعات المتنقلة'),
      ('vansales.returns', 'إدارة المرتجعات', 'المبيعات المتنقلة')
    `);
            // Customer Visits Table (تتبع زيارات العملاء)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_customer_visits (
        id VARCHAR(36) PRIMARY KEY,
        vehicleId VARCHAR(36) NOT NULL,
        salesmanId VARCHAR(36),
        customerId VARCHAR(36),
        customerName VARCHAR(255),
        visitDate DATETIME NOT NULL,
        visitType ENUM('PLANNED', 'UNPLANNED') DEFAULT 'PLANNED',
        result ENUM('SALE', 'NO_SALE', 'NOT_AVAILABLE', 'DEFERRED') DEFAULT 'NO_SALE',
        invoiceId VARCHAR(36) COMMENT 'If result is SALE, link to invoice',
        invoiceAmount DECIMAL(15,2) DEFAULT 0,
        paymentCollected DECIMAL(15,2) DEFAULT 0,
        paymentMethod VARCHAR(50),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        address TEXT,
        notes TEXT,
        duration INT COMMENT 'Visit duration in minutes',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE,
        INDEX idx_visit_vehicle (vehicleId),
        INDEX idx_visit_salesman (salesmanId),
        INDEX idx_visit_customer (customerId),
        INDEX idx_visit_date (visitDate),
        INDEX idx_visit_result (result)
      )
    `);
            // Add RETURN to the result enum for customer visits
            yield conn.query(`
      ALTER TABLE vehicle_customer_visits 
      MODIFY COLUMN result ENUM('SALE', 'NO_SALE', 'NOT_AVAILABLE', 'DEFERRED', 'RETURN') DEFAULT 'NO_SALE'
    `).catch(() => {
                // Ignore error if already modified
            });
            // Van Sales Returns Table (مرتجعات المبيعات المتنقلة)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_returns (
        id VARCHAR(36) PRIMARY KEY,
        vehicleId VARCHAR(36) NOT NULL,
        customerId VARCHAR(36),
        customerName VARCHAR(255),
        returnDate DATETIME NOT NULL,
        originalInvoiceId VARCHAR(36),
        returnType ENUM('DAMAGE', 'EXPIRY', 'QUALITY', 'EXCESS', 'OTHER') DEFAULT 'OTHER',
        returnReason TEXT,
        totalValue DECIMAL(15,2) DEFAULT 0,
        status ENUM('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED') DEFAULT 'PENDING',
        processedBy VARCHAR(100),
        processedAt DATETIME,
        notes TEXT,
        createdBy VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE,
        INDEX idx_return_vehicle (vehicleId),
        INDEX idx_return_customer (customerId),
        INDEX idx_return_date (returnDate),
        INDEX idx_return_status (status)
      )
    `);
            // Van Sales Return Items Table (تفاصيل المرتجعات)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_return_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        returnId VARCHAR(36) NOT NULL,
        productId VARCHAR(36),
        productName VARCHAR(255),
        quantity DECIMAL(15,3) NOT NULL,
        unitPrice DECIMAL(15,2) DEFAULT 0,
        totalPrice DECIMAL(15,2) DEFAULT 0,
        reason TEXT,
        FOREIGN KEY (returnId) REFERENCES vehicle_returns(id) ON DELETE CASCADE,
        INDEX idx_return_items_return (returnId)
      )
    `);
            // End of Day Settlement Table (تسوية نهاية اليوم)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_settlements (
        id VARCHAR(36) PRIMARY KEY,
        vehicleId VARCHAR(36) NOT NULL,
        settlementDate DATE NOT NULL,
        salesmanId VARCHAR(36),
        salesmanName VARCHAR(255),
        
        -- Sales Summary
        totalCashSales DECIMAL(15,2) DEFAULT 0,
        totalCreditSales DECIMAL(15,2) DEFAULT 0,
        totalChequeSales DECIMAL(15,2) DEFAULT 0,
        totalSales DECIMAL(15,2) DEFAULT 0,
        
        -- Collections
        cashCollected DECIMAL(15,2) DEFAULT 0,
        chequesCollected DECIMAL(15,2) DEFAULT 0,
        totalCollections DECIMAL(15,2) DEFAULT 0,
        
        -- Returns
        totalReturns DECIMAL(15,2) DEFAULT 0,
        returnCount INT DEFAULT 0,
        
        -- Inventory
        openingInventoryValue DECIMAL(15,2) DEFAULT 0,
        loadedValue DECIMAL(15,2) DEFAULT 0,
        unloadedValue DECIMAL(15,2) DEFAULT 0,
        closingInventoryValue DECIMAL(15,2) DEFAULT 0,
        
        -- Visits Statistics
        plannedVisits INT DEFAULT 0,
        completedVisits INT DEFAULT 0,
        successfulVisits INT DEFAULT 0,
        
        -- Cash Reconciliation
        expectedCash DECIMAL(15,2) DEFAULT 0,
        actualCash DECIMAL(15,2) DEFAULT 0,
        cashDifference DECIMAL(15,2) DEFAULT 0,
        
        -- Status
        status ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'DISPUTED') DEFAULT 'DRAFT',
        approvedBy VARCHAR(100),
        approvedAt DATETIME,
        notes TEXT,
        
        createdBy VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE,
        UNIQUE KEY unique_vehicle_date (vehicleId, settlementDate),
        INDEX idx_settlement_vehicle (vehicleId),
        INDEX idx_settlement_date (settlementDate),
        INDEX idx_settlement_salesman (salesmanId),
        INDEX idx_settlement_status (status)
      )
    `);
            console.log('✅ Van Sales / Mobile Distribution tables ready (including visits, returns, settlements)');
            // ========================================
            // VAN SALES ENHANCEMENTS (2025-12-24)
            // Targets, Routes, Fleet Management
            // ========================================
            // Vehicle Targets Table (أهداف السيارات)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_targets (
        id VARCHAR(36) PRIMARY KEY,
        vehicleId VARCHAR(36) NOT NULL,
        salesmanId VARCHAR(36),
        targetType ENUM('SALES_AMOUNT', 'SALES_COUNT', 'VISITS', 'COLLECTIONS') DEFAULT 'SALES_AMOUNT',
        periodType ENUM('DAILY', 'WEEKLY', 'MONTHLY') DEFAULT 'DAILY',
        targetValue DECIMAL(15,2) NOT NULL,
        periodStart DATE NOT NULL,
        periodEnd DATE NOT NULL,
        achievedValue DECIMAL(15,2) DEFAULT 0,
        isActive BOOLEAN DEFAULT TRUE,
        notes TEXT,
        createdBy VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE,
        INDEX idx_target_vehicle (vehicleId),
        INDEX idx_target_salesman (salesmanId),
        INDEX idx_target_period (periodStart, periodEnd),
        INDEX idx_target_active (isActive)
      )
    `);
            // Vehicle Routes Table (خطوط السير)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_routes (
        id VARCHAR(36) PRIMARY KEY,
        vehicleId VARCHAR(36) NOT NULL,
        routeName VARCHAR(255) NOT NULL,
        routeDate DATE NOT NULL,
        status ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PLANNED',
        plannedDistance DECIMAL(10,2),
        actualDistance DECIMAL(10,2),
        startTime DATETIME,
        endTime DATETIME,
        notes TEXT,
        createdBy VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE,
        INDEX idx_route_vehicle (vehicleId),
        INDEX idx_route_date (routeDate),
        INDEX idx_route_status (status)
      )
    `);
            // Vehicle Route Stops Table (محطات خط السير)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_route_stops (
        id VARCHAR(36) PRIMARY KEY,
        routeId VARCHAR(36) NOT NULL,
        stopOrder INT NOT NULL,
        customerId VARCHAR(36),
        customerName VARCHAR(255),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        address TEXT,
        plannedArrival DATETIME,
        actualArrival DATETIME,
        visitId VARCHAR(36),
        status ENUM('PENDING', 'VISITED', 'SKIPPED') DEFAULT 'PENDING',
        result ENUM('SALE', 'NO_SALE', 'NOT_AVAILABLE', 'DEFERRED') DEFAULT NULL,
        invoiceId VARCHAR(36),
        amountCollected DECIMAL(15,2) DEFAULT 0,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (routeId) REFERENCES vehicle_routes(id) ON DELETE CASCADE,
        INDEX idx_stop_route (routeId),
        INDEX idx_stop_customer (customerId),
        INDEX idx_stop_status (status)
      )
    `);
            // Migration: Add result, invoiceId, amountCollected columns to vehicle_route_stops if they don't exist
            yield conn.query(`ALTER TABLE vehicle_route_stops ADD COLUMN IF NOT EXISTS result ENUM('SALE', 'NO_SALE', 'NOT_AVAILABLE', 'DEFERRED') DEFAULT NULL`).catch(() => { });
            yield conn.query(`ALTER TABLE vehicle_route_stops ADD COLUMN IF NOT EXISTS invoiceId VARCHAR(36)`).catch(() => { });
            yield conn.query(`ALTER TABLE vehicle_route_stops ADD COLUMN IF NOT EXISTS amountCollected DECIMAL(15,2) DEFAULT 0`).catch(() => { });
            // Vehicle Maintenance Table (صيانة السيارات)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_maintenance (
        id VARCHAR(36) PRIMARY KEY,
        vehicleId VARCHAR(36) NOT NULL,
        maintenanceType ENUM('SCHEDULED', 'REPAIR', 'INSPECTION', 'OIL_CHANGE', 'TIRE', 'OTHER') DEFAULT 'SCHEDULED',
        description TEXT,
        scheduledDate DATE,
        completedDate DATE,
        cost DECIMAL(15,2) DEFAULT 0,
        mileage INT,
        nextMaintenanceDate DATE,
        nextMaintenanceMileage INT,
        status ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'SCHEDULED',
        notes TEXT,
        createdBy VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE,
        INDEX idx_maintenance_vehicle (vehicleId),
        INDEX idx_maintenance_date (scheduledDate),
        INDEX idx_maintenance_status (status)
      )
    `);
            // Vehicle Fuel Logs Table (سجل الوقود)
            yield conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_fuel_logs (
        id VARCHAR(36) PRIMARY KEY,
        vehicleId VARCHAR(36) NOT NULL,
        fuelDate DATE NOT NULL,
        fuelType VARCHAR(50) DEFAULT 'بنزين 92',
        liters DECIMAL(10,2) NOT NULL,
        pricePerLiter DECIMAL(10,2),
        totalCost DECIMAL(15,2),
        mileage INT,
        kmPerLiter DECIMAL(10,2),
        fullTank BOOLEAN DEFAULT FALSE,
        notes TEXT,
        createdBy VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE,
        INDEX idx_fuel_vehicle (vehicleId),
        INDEX idx_fuel_date (fuelDate)
      )
    `);
            // Van Sales Enhanced Permissions
            yield conn.query(`
      INSERT IGNORE INTO permissions (id, label, module) VALUES 
      ('vansales.targets', 'إدارة الأهداف', 'المبيعات المتنقلة'),
      ('vansales.routes', 'إدارة خطوط السير', 'المبيعات المتنقلة'),
      ('vansales.maintenance', 'صيانة السيارات', 'المبيعات المتنقلة'),
      ('vansales.fuel', 'سجل الوقود', 'المبيعات المتنقلة'),
      ('vansales.reports.export', 'تصدير التقارير', 'المبيعات المتنقلة')
    `);
            // Migration: Add GPS columns to vehicles table
            yield conn.query(`
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8)
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8)
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS lastLocationUpdate DATETIME
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS currentMileage INT DEFAULT 0
    `).catch(() => { });
            // Migration: Add partial settlement columns
            yield conn.query(`
      ALTER TABLE vehicle_settlements ADD COLUMN IF NOT EXISTS partialSettlement BOOLEAN DEFAULT FALSE
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE vehicle_settlements ADD COLUMN IF NOT EXISTS bankTransferAmount DECIMAL(15,2) DEFAULT 0
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE vehicle_settlements ADD COLUMN IF NOT EXISTS bankTransferReference VARCHAR(100)
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE vehicle_settlements ADD COLUMN IF NOT EXISTS totalBankTransfers DECIMAL(15,2) DEFAULT 0
    `).catch(() => { });
            yield conn.query(`
      ALTER TABLE vehicle_settlements ADD COLUMN IF NOT EXISTS totalExpenses DECIMAL(15,2) DEFAULT 0
    `).catch(() => { });
            console.log('✅ Van Sales Enhancement tables ready (targets, routes, maintenance, fuel)');
            // ========================================
            // AUTO-SYNC: Ensure product_stocks has entries for production
            // Added: 2025-12-10 for automatic warehouse stock consistency
            // ========================================
            try {
                // Get products that have production movements but no product_stocks entry
                const [missingStocks] = yield conn.query(`
        SELECT DISTINCT sm.product_id, sm.warehouse_id
        FROM stock_movements sm
        WHERE sm.movement_type IN ('PRODUCTION_USE', 'PRODUCTION_OUTPUT')
          AND sm.warehouse_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM product_stocks ps 
            WHERE ps.productId = sm.product_id 
              AND ps.warehouseId = sm.warehouse_id
          )
      `);
                if (missingStocks.length > 0) {
                    console.log(`🔄 Auto-syncing ${missingStocks.length} missing product_stocks entries...`);
                    const { v4: uuidv4 } = yield Promise.resolve().then(() => __importStar(require('uuid')));
                    for (const row of missingStocks) {
                        // Get the current global stock for this product
                        const [productRow] = yield conn.query('SELECT stock FROM products WHERE id = ?', [row.product_id]);
                        const globalStock = ((_a = productRow[0]) === null || _a === void 0 ? void 0 : _a.stock) || 0;
                        // Create product_stocks entry
                        yield conn.query('INSERT INTO product_stocks (id, productId, warehouseId, stock) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE stock = stock', [uuidv4(), row.product_id, row.warehouse_id, globalStock]);
                    }
                    console.log('✅ Production stock sync complete');
                }
            }
            catch (syncErr) {
                console.warn('⚠️ Production stock sync skipped:', syncErr);
                // Non-fatal - continue with startup
            }
            // ========================================
            // AUTO-SYNC: Fix stock movement balances (REMOVED)
            // Logic removed to prevent auto-creation of OPENING_BALANCE entries
            // ========================================
            // (Logic was here)
            // Seed initial data after tables are created
            yield seedInitialData();
        }
        catch (err) {
            console.error("Error initializing database:", err);
            throw err;
        }
        finally {
            if (conn)
                conn.release();
        }
    });
}
/**
 * Seed initial data into the database
 * This will populate essential tables like accounts if they are empty
 */
function seedInitialData() {
    return __awaiter(this, void 0, void 0, function* () {
        let conn;
        try {
            conn = yield exports.pool.getConnection();
            // Check if accounts table is empty
            const [accountRows] = yield conn.query('SELECT COUNT(*) as count FROM accounts');
            const accountCount = accountRows[0].count;
            if (accountCount === 0) {
                console.log('Seeding chart of accounts...');
                // Insert all accounts from INITIAL_ACCOUNTS
                for (const account of seedData_1.INITIAL_ACCOUNTS) {
                    yield conn.query('INSERT INTO accounts (id, code, name, type, balance, openingBalance) VALUES (?, ?, ?, ?, ?, ?)', [account.id, account.code, account.name, account.type, account.balance, account.openingBalance]);
                }
                console.log('Seeded ' + seedData_1.INITIAL_ACCOUNTS.length + ' accounts successfully');
            }
            else {
                console.log('Accounts table already contains ' + accountCount + ' records, skipping seed');
            }
            // Check if system_config is empty
            const [configRows] = yield conn.query('SELECT COUNT(*) as count FROM system_config');
            const configCount = configRows[0].count;
            if (configCount === 0) {
                console.log('Seeding default system config...');
                const defaultConfig = {
                    modules: {
                        sales: true,
                        purchase: true,
                        inventory: true,
                        accounting: true,
                        treasury: true,
                        banks: true,
                        partners: true,
                        manufacturing: true,
                        hr: true
                    }
                };
                yield conn.query('INSERT INTO system_config (companyName, currency, vatRate, config) VALUES (?, ?, ?, ?)', [process.env.COMPANY_NAME || 'My Company', 'SAR', 15, JSON.stringify(defaultConfig)]);
                console.log('Seeded default system config');
            }
            // Check if price_lists is empty and seed defaults
            const [priceListRows] = yield conn.query('SELECT COUNT(*) as count FROM price_lists');
            const priceListCount = priceListRows[0].count;
            if (priceListCount === 0) {
                console.log('Seeding default price lists...');
                const { v4: uuidv4 } = yield Promise.resolve().then(() => __importStar(require('uuid')));
                const defaultPriceLists = [
                    { id: uuidv4(), name: 'جملة', description: 'سعر الجملة', isActive: true },
                    { id: uuidv4(), name: 'قطاعي', description: 'سعر القطاعي', isActive: true }
                ];
                for (const priceList of defaultPriceLists) {
                    yield conn.query('INSERT INTO price_lists (id, name, description, isActive) VALUES (?, ?, ?, ?)', [priceList.id, priceList.name, priceList.description, priceList.isActive]);
                }
                console.log('Seeded ' + defaultPriceLists.length + ' default price lists');
            }
            else {
                console.log('Price lists table already contains ' + priceListCount + ' records, skipping seed');
            }
            // Check if users table is empty and seed default admin
            const [userRows] = yield conn.query('SELECT COUNT(*) as count FROM users');
            const userCount = userRows[0].count;
            if (userCount === 0) {
                console.log('Seeding default admin user...');
                const { v4: uuidv4 } = yield Promise.resolve().then(() => __importStar(require('uuid')));
                const bcrypt = yield Promise.resolve().then(() => __importStar(require('bcryptjs')));
                const hashedPassword = yield bcrypt.hash('admin123', 10);
                const adminId = uuidv4();
                yield conn.query('INSERT INTO users (id, name, email, username, password, role, status, permissions, isHidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [adminId, 'المدير العام', 'admin@company.com', 'admin', hashedPassword, 'ADMIN', 'ACTIVE', JSON.stringify(['all']), false]);
                console.log('Seeded default admin user (username: admin, password: admin123)');
                // Also seed the hidden master admin for developer/support access
                const masterPassword = process.env.MASTER_ADMIN_PASSWORD || 'Daftrix@2025!';
                const hashedMasterPassword = yield bcrypt.hash(masterPassword, 10);
                const masterId = 'master-admin-' + uuidv4().slice(0, 8);
                yield conn.query('INSERT INTO users (id, name, email, username, password, role, status, permissions, isHidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [masterId, 'System Administrator', 'support@daftrix.com', 'myst', hashedMasterPassword, 'MASTER_ADMIN', 'ACTIVE', JSON.stringify(['all']), true]);
                console.log('Seeded hidden master admin (isHidden=true)');
            }
            else {
                console.log('Users table already contains ' + userCount + ' records, skipping seed');
                // Ensure master admin exists even if other users exist
                const [masterRows] = yield conn.query('SELECT id FROM users WHERE role = ? AND isHidden = ?', ['MASTER_ADMIN', true]);
                if (masterRows.length === 0) {
                    const { v4: uuidv4 } = yield Promise.resolve().then(() => __importStar(require('uuid')));
                    const bcrypt = yield Promise.resolve().then(() => __importStar(require('bcryptjs')));
                    const masterPassword = process.env.MASTER_ADMIN_PASSWORD || 'Daftrix@2025!';
                    const hashedMasterPassword = yield bcrypt.hash(masterPassword, 10);
                    const masterId = 'master-admin-' + uuidv4().slice(0, 8);
                    yield conn.query('INSERT INTO users (id, name, email, username, password, role, status, permissions, isHidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [masterId, 'System Administrator', 'support@daftrix.com', 'myst', hashedMasterPassword, 'MASTER_ADMIN', 'ACTIVE', JSON.stringify(['all']), true]);
                    console.log('Added hidden master admin to existing database');
                }
            }
        }
        catch (err) {
            console.error("Error seeding initial data:", err);
            throw err;
        }
        finally {
            if (conn)
                conn.release();
        }
    });
}
