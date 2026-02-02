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
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Manufacturing Module Migration Runner
 * Runs all SQL migration files in sequence
 */
function runMigrations() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        console.log('🚀 Starting Manufacturing Module Migrations...\n');
        const migrationsDir = path.join(__dirname, 'migrations');
        const migrationFiles = [
            '001_enhance_products_table.sql',
            '002_create_bom_tables.sql',
            '003_create_production_orders.sql',
            '004_create_stock_movements.sql',
            '005_enhance_manufacturing_schema.sql',
            '006_create_material_reservations.sql',
            '007_create_scrap_management.sql',
            '008_add_variance_analysis.sql',
            '009_create_work_centers.sql',
            '010_create_routings.sql',
            '011_create_production_order_steps.sql',
            '012_create_quality_templates.sql',
            '013_create_quality_checks.sql',
            '014_create_batch_tracking.sql'
        ];
        try {
            for (const file of migrationFiles) {
                const filePath = path.join(migrationsDir, file);
                if (!fs.existsSync(filePath)) {
                    console.error(`❌ Migration file not found: ${file}`);
                    continue;
                }
                console.log(`📄 Running migration: ${file}`);
                const sql = fs.readFileSync(filePath, 'utf8');
                // Split by semicolon and filter out empty statements
                const statements = sql
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && !s.startsWith('--'));
                for (const statement of statements) {
                    if (statement.toLowerCase().startsWith('select')) {
                        // This is the status message
                        const [rows] = yield db_1.pool.query(statement);
                        console.log(`   ✅ ${((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.status) || 'Success'}`);
                    }
                    else {
                        try {
                            yield db_1.pool.query(statement);
                        }
                        catch (err) {
                            // Ignore duplicate column/index errors (1060, 1061, 1091) and missing index (1072)
                            if ([1060, 1061, 1091, 1072].includes(err.errno)) {
                                console.log(`   ⚠️  Skipping (already exists or not needed): ${err.sqlMessage}`);
                            }
                            else {
                                throw err;
                            }
                        }
                    }
                }
                console.log(`   ✓ ${file} completed\n`);
            }
            console.log('✅ All migrations completed successfully!');
            console.log('\n📊 Verifying tables...');
            // Verify tables exist
            const tables = ['products', 'bom', 'bom_items', 'production_orders', 'stock_movements', 'material_reservations', 'production_scrap'];
            for (const table of tables) {
                const [rows] = yield db_1.pool.query(`SHOW TABLES LIKE '${table}'`);
                if (rows.length > 0) {
                    console.log(`   ✓ Table '${table}' exists`);
                }
                else {
                    console.log(`   ❌ Table '${table}' missing`);
                }
            }
            // Check products table columns
            console.log('\n📋 Verifying products table columns...');
            const [columns] = yield db_1.pool.query(`SHOW COLUMNS FROM products`);
            const columnNames = columns.map((c) => c.Field);
            const requiredColumns = ['type', 'unit', 'min_stock', 'avg_cost', 'is_manufactured', 'lead_time_days'];
            for (const col of requiredColumns) {
                if (columnNames.includes(col)) {
                    console.log(`   ✓ Column '${col}' exists`);
                }
                else {
                    console.log(`   ❌ Column '${col}' missing`);
                }
            }
            console.log('\n✨ Migration verification completed!');
            process.exit(0);
        }
        catch (error) {
            console.error('❌ Migration failed:', error.message);
            console.error(error);
            process.exit(1);
        }
    });
}
// Run migrations
runMigrations();
