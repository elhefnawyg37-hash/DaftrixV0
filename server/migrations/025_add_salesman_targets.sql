-- Salesman Targets Table (أهداف المندوبين)
-- Allows setting product-specific or category-specific quantity/amount targets

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
    
    -- Foreign keys
    FOREIGN KEY (salesmanId) REFERENCES salesmen(id) ON DELETE CASCADE,
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Indexes for performance
    INDEX idx_salesman (salesmanId),
    INDEX idx_product (productId),
    INDEX idx_category (categoryId),
    INDEX idx_period (periodStart, periodEnd),
    INDEX idx_active (isActive)
);
