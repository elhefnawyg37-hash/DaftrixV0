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
const vehicleController_1 = require("./controllers/vehicleController");
function mergeSettlements() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Finding duplicate settlements...');
        // Find vehicles with > 1 SUBMITTED settlement
        const [duplicates] = yield db_1.pool.query(`
        SELECT vehicleId, COUNT(*) as cnt 
        FROM vehicle_settlements 
        WHERE status = 'SUBMITTED' 
        GROUP BY vehicleId 
        HAVING cnt > 1
    `);
        if (duplicates.length === 0) {
            console.log('No duplicates found.');
            process.exit(0);
        }
        console.log(`Found ${duplicates.length} vehicles with duplicate settlements.`);
        for (const dup of duplicates) {
            // Get all settlements for this vehicle
            const [settlements] = yield db_1.pool.query(`
            SELECT id, settlementDate 
            FROM vehicle_settlements 
            WHERE vehicleId = ? AND status = 'SUBMITTED' 
            ORDER BY settlementDate ASC
        `, [dup.vehicleId]);
            // Keep FIRST (Oldest) -> settlements[0]
            const main = settlements[0];
            const toDelete = settlements.slice(1);
            console.log(`Merging ${toDelete.length} settlements into ${main.id} (${main.settlementDate})`);
            const conn = yield db_1.pool.getConnection();
            try {
                yield conn.beginTransaction();
                // Delete others
                const idsToDelete = toDelete.map((s) => s.id);
                if (idsToDelete.length > 0) {
                    yield conn.query('DELETE FROM vehicle_settlements WHERE id IN (?)', [idsToDelete]);
                }
                // Recalculate Stats for Main (MERGE MODE: ignoreDateFilter = true)
                // Params: conn, vehicleId, date (use main.settlementDate), excludeSettlementId (NULL), ignoreDateFilter (TRUE)
                const stats = yield (0, vehicleController_1.calculateRefinedSettlementStats)(conn, dup.vehicleId, main.settlementDate, null, true // ignoreDateFilter
                );
                // Update Main
                yield conn.query(`
                UPDATE vehicle_settlements SET
                    totalCashSales = ?, totalCreditSales = ?, totalSales = ?, totalBankTransfers = ?,
                    cashCollected = ?, totalCollections = ?,
                    totalReturns = ?, returnCount = ?,
                    expectedCash = ?, updatedAt = NOW()
                WHERE id = ?
             `, [
                    stats.totalCashSales, stats.totalCreditSales, stats.totalSales, stats.totalBankTransfers,
                    stats.cashCollected, stats.totalCollections,
                    stats.totalReturns, stats.returnCount,
                    stats.expectedCash,
                    main.id
                ]);
                yield conn.commit();
                console.log('Merged successfully.');
            }
            catch (e) {
                yield conn.rollback();
                console.error('Error merging:', e);
            }
            finally {
                conn.release();
            }
        }
        process.exit(0);
    });
}
mergeSettlements();
