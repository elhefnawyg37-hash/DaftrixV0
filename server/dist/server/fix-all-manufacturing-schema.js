"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
function fixAllSchemas() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('Dropping tables...');
            // Order matters due to FKs
            yield db_1.pool.query('DROP TABLE IF EXISTS stock_movements'); // Just in case
            yield db_1.pool.query('DROP TABLE IF EXISTS production_orders');
            yield db_1.pool.query('DROP TABLE IF EXISTS bom_items');
            yield db_1.pool.query('DROP TABLE IF EXISTS bom');
            console.log('Creating BOM table...');
            yield db_1.pool.query(`
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
        `);
            console.log('Creating BOM Items table...');
            yield db_1.pool.query(`
            CREATE TABLE IF NOT EXISTS bom_items (
              id INT AUTO_INCREMENT PRIMARY KEY,
              bom_id VARCHAR(36) NOT NULL,
              raw_product_id VARCHAR(36) NOT NULL,
              quantity_per_unit DECIMAL(15,3) NOT NULL,
              waste_percent DECIMAL(5,2) DEFAULT 0,
              notes TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (bom_id) REFERENCES bom(id) ON DELETE CASCADE,
              FOREIGN KEY (raw_product_id) REFERENCES products(id) ON DELETE RESTRICT,
              INDEX idx_bom (bom_id),
              INDEX idx_raw_product (raw_product_id),
              UNIQUE KEY unique_bom_product (bom_id, raw_product_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
        `);
            console.log('Creating Production Orders table...');
            yield db_1.pool.query(`
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
        `);
            console.log('Creating Stock Movements table...');
            yield db_1.pool.query(`
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
              INDEX idx_reference (reference_type, reference_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
        `);
            console.log('All schemas fixed successfully!');
            process.exit(0);
        }
        catch (error) {
            console.error('Error fixing schemas:', error);
            process.exit(1);
        }
    });
}
fixAllSchemas();
