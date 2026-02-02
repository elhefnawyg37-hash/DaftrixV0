
import { pool } from '../db';

async function migrate() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Starting migration to add missing columns...');

        // Products Table
        console.log('Migrating products table...');
        try {
            await conn.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS bomId VARCHAR(36)`);
            await conn.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS type VARCHAR(50)`);
            await conn.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(50)`);
            await conn.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS isManufactured BOOLEAN DEFAULT FALSE`);
            await conn.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS leadTimeDays INT DEFAULT 0`);
            console.log('Products table migrated successfully.');
        } catch (error) {
            console.error('Error migrating products table:', error);
        }

        // Partners Table
        console.log('Migrating partners table...');
        try {
            await conn.query(`ALTER TABLE partners ADD COLUMN IF NOT EXISTS creditLimit DECIMAL(15, 2) DEFAULT 0`);
            await conn.query(`ALTER TABLE partners ADD COLUMN IF NOT EXISTS classification VARCHAR(50)`);
            await conn.query(`ALTER TABLE partners ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE'`);
            await conn.query(`ALTER TABLE partners ADD COLUMN IF NOT EXISTS groupId VARCHAR(36)`);
            await conn.query(`ALTER TABLE partners ADD COLUMN IF NOT EXISTS commercialRegister VARCHAR(50)`);
            console.log('Partners table migrated successfully.');
        } catch (error) {
            console.error('Error migrating partners table:', error);
        }

        console.log('Migration completed.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (conn) conn.release();
        process.exit();
    }
}

migrate();
