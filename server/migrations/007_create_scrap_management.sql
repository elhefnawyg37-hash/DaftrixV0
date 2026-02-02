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
    
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    
    INDEX idx_order (production_order_id),
    INDEX idx_product (product_id),
    INDEX idx_type (scrap_type),
    INDEX idx_status (disposal_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
