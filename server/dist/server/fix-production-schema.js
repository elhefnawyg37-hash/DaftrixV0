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
function fixSchema() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('Dropping production_orders table...');
            yield db_1.pool.query('DROP TABLE IF EXISTS production_orders');
            console.log('Creating production_orders table...');
            const createTableSQL = `
            CREATE TABLE IF NOT EXISTS production_orders (
              id VARCHAR(50) PRIMARY KEY,
              order_number VARCHAR(50) UNIQUE NOT NULL,
              bom_id VARCHAR(50) NOT NULL,
              finished_product_id VARCHAR(50) NOT NULL,
              qty_planned DECIMAL(15,3) NOT NULL,
              qty_finished DECIMAL(15,3) DEFAULT 0,
              qty_scrapped DECIMAL(15,3) DEFAULT 0,
              status ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PLANNED',
              start_date DATE,
              end_date DATE,
              actual_start_date TIMESTAMP NULL,
              actual_end_date TIMESTAMP NULL,
              warehouse_id VARCHAR(50),
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
            yield db_1.pool.query(createTableSQL);
            console.log('Schema fixed successfully!');
            process.exit(0);
        }
        catch (error) {
            console.error('Error fixing schema:', error);
            process.exit(1);
        }
    });
}
fixSchema();
