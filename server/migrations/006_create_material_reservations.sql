CREATE TABLE IF NOT EXISTS material_reservations (
    id VARCHAR(36) PRIMARY KEY,
    productionOrderId VARCHAR(36) NOT NULL,
    productId VARCHAR(36) NOT NULL,
    warehouseId VARCHAR(36) NOT NULL,
    
    quantityReserved DECIMAL(15,4) NOT NULL,
    quantityConsumed DECIMAL(15,4) DEFAULT 0,
    
    status ENUM('RESERVED', 'PARTIALLY_CONSUMED', 'FULLY_CONSUMED', 'RELEASED') DEFAULT 'RESERVED',
    
    reservedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    releasedAt TIMESTAMP NULL,
    
    FOREIGN KEY (productionOrderId) REFERENCES production_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (productId) REFERENCES products(id),
    FOREIGN KEY (warehouseId) REFERENCES warehouses(id),
    INDEX idx_order (productionOrderId),
    INDEX idx_product_warehouse (productId, warehouseId),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
