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
exports.getWorkCenterSchedule = exports.getBottlenecks = exports.getCapacitySummary = exports.getCapacityLoad = void 0;
const db_1 = require("../db");
const errorHandler_1 = require("../utils/errorHandler");
/**
 * GET /api/capacity/load
 * Get capacity load for all or specific work centers over a date range
 */
const getCapacityLoad = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate, workCenterId, hoursPerDay = 8 } = req.query;
        // Default to next 14 days if no dates provided
        const start = startDate || new Date().toISOString().split('T')[0];
        const end = endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // Get all work centers (or specific one)
        let workCenterQuery = `
            SELECT id, code, name, capacity_per_hour, status
            FROM work_centers
            WHERE status = 'ACTIVE'
        `;
        const wcParams = [];
        if (workCenterId) {
            workCenterQuery += ' AND id = ?';
            wcParams.push(workCenterId);
        }
        workCenterQuery += ' ORDER BY code';
        const [workCenters] = yield db_1.pool.query(workCenterQuery, wcParams);
        // Get all planned production order steps grouped by work center and date
        const [loadData] = yield db_1.pool.query(`
            SELECT 
                pos.work_center_id,
                DATE(COALESCE(pos.planned_start, po.scheduled_start_date, po.created_at)) as production_date,
                po.id as order_id,
                po.order_number,
                p.name as product_name,
                pos.operation_name,
                pos.setup_time_minutes,
                pos.run_time_minutes,
                po.qty_planned as quantity
            FROM production_order_steps pos
            JOIN production_orders po ON pos.production_order_id = po.id
            LEFT JOIN products p ON po.finished_product_id = p.id
            WHERE po.status NOT IN ('COMPLETED', 'CANCELLED')
              AND pos.status IN ('PENDING', 'IN_PROGRESS')
              AND DATE(COALESCE(pos.planned_start, po.scheduled_start_date, po.created_at)) BETWEEN ? AND ?
            ORDER BY production_date, pos.work_center_id, pos.sequence_number
        `, [start, end]);
        // Build capacity data structure
        const hoursNum = Number(hoursPerDay);
        const result = workCenters.map(wc => {
            const capacityPerDay = wc.capacity_per_hour * hoursNum;
            // Group load by date for this work center
            const wcLoad = loadData.filter(l => l.work_center_id === wc.id);
            const dateMap = new Map();
            // Initialize all dates in range
            const startD = new Date(start);
            const endD = new Date(end);
            for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                dateMap.set(dateStr, {
                    date: dateStr,
                    plannedMinutes: 0,
                    capacityMinutes: hoursNum * 60,
                    loadPercent: 0,
                    orders: []
                });
            }
            // Populate with actual loads
            wcLoad.forEach(load => {
                const dateStr = new Date(load.production_date).toISOString().split('T')[0];
                const day = dateMap.get(dateStr);
                if (day) {
                    const loadMinutes = load.setup_time_minutes + (load.run_time_minutes * load.quantity);
                    day.plannedMinutes += loadMinutes;
                    day.orders.push({
                        orderId: load.order_id,
                        orderNumber: load.order_number,
                        productName: load.product_name,
                        stepName: load.operation_name,
                        quantity: load.quantity,
                        plannedMinutes: loadMinutes
                    });
                }
            });
            // Calculate load percentages
            dateMap.forEach(day => {
                day.loadPercent = day.capacityMinutes > 0
                    ? Math.round((day.plannedMinutes / day.capacityMinutes) * 100)
                    : 0;
            });
            return {
                workCenterId: wc.id,
                workCenterCode: wc.code,
                workCenterName: wc.name,
                capacityPerHour: wc.capacity_per_hour,
                hoursPerDay: hoursNum,
                capacityPerDay,
                status: wc.status,
                days: Array.from(dateMap.values())
            };
        });
        res.json(result);
    }
    catch (error) {
        console.error('Error getting capacity load:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getCapacityLoad = getCapacityLoad;
/**
 * GET /api/capacity/summary
 * Get high-level capacity summary with bottleneck detection
 */
const getCapacitySummary = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate, hoursPerDay = 8 } = req.query;
        const start = startDate || new Date().toISOString().split('T')[0];
        const end = endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const hoursNum = Number(hoursPerDay);
        // Get aggregated load per work center
        const [summary] = yield db_1.pool.query(`
            SELECT 
                wc.id as work_center_id,
                wc.code as work_center_code,
                wc.name as work_center_name,
                wc.capacity_per_hour,
                wc.status,
                COUNT(DISTINCT po.id) as order_count,
                COUNT(pos.id) as step_count,
                SUM(pos.setup_time_minutes + (pos.run_time_minutes * po.qty_planned)) as total_load_minutes,
                DATEDIFF(?, ?) + 1 as total_days
            FROM work_centers wc
            LEFT JOIN production_order_steps pos ON pos.work_center_id = wc.id
            LEFT JOIN production_orders po ON pos.production_order_id = po.id
                AND po.status NOT IN ('COMPLETED', 'CANCELLED')
                AND DATE(COALESCE(pos.planned_start, po.scheduled_start_date, po.created_at)) BETWEEN ? AND ?
            WHERE wc.status = 'ACTIVE'
            GROUP BY wc.id, wc.code, wc.name, wc.capacity_per_hour, wc.status
            ORDER BY total_load_minutes DESC
        `, [end, start, start, end]);
        // Calculate capacity and identify bottlenecks
        const totalDays = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const result = summary.map(wc => {
            const totalCapacityMinutes = wc.capacity_per_hour * hoursNum * 60 * totalDays;
            const loadPercent = totalCapacityMinutes > 0
                ? Math.round((wc.total_load_minutes || 0) / totalCapacityMinutes * 100)
                : 0;
            return Object.assign(Object.assign({}, wc), { totalCapacityMinutes,
                loadPercent, isBottleneck: loadPercent > 90, isOverloaded: loadPercent > 100, availableMinutes: Math.max(0, totalCapacityMinutes - (wc.total_load_minutes || 0)) });
        });
        // Summary stats
        const bottlenecks = result.filter(r => r.isBottleneck);
        const overloaded = result.filter(r => r.isOverloaded);
        const avgLoad = result.length > 0
            ? Math.round(result.reduce((sum, r) => sum + r.loadPercent, 0) / result.length)
            : 0;
        res.json({
            startDate: start,
            endDate: end,
            totalDays,
            hoursPerDay: hoursNum,
            workCenters: result,
            summary: {
                totalWorkCenters: result.length,
                bottleneckCount: bottlenecks.length,
                overloadedCount: overloaded.length,
                averageLoadPercent: avgLoad,
                bottleneckWorkCenters: bottlenecks.map(b => b.work_center_name)
            }
        });
    }
    catch (error) {
        console.error('Error getting capacity summary:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getCapacitySummary = getCapacitySummary;
/**
 * GET /api/capacity/bottlenecks
 * Get list of bottleneck days per work center
 */
const getBottlenecks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate, threshold = 90, hoursPerDay = 8 } = req.query;
        const start = startDate || new Date().toISOString().split('T')[0];
        const end = endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const thresholdNum = Number(threshold);
        const hoursNum = Number(hoursPerDay);
        // Get daily loads
        const [dailyLoads] = yield db_1.pool.query(`
            SELECT 
                wc.id as work_center_id,
                wc.code as work_center_code,
                wc.name as work_center_name,
                wc.capacity_per_hour,
                DATE(COALESCE(pos.planned_start, po.scheduled_start_date, po.created_at)) as production_date,
                SUM(pos.setup_time_minutes + (pos.run_time_minutes * po.qty_planned)) as total_load_minutes
            FROM work_centers wc
            JOIN production_order_steps pos ON pos.work_center_id = wc.id
            JOIN production_orders po ON pos.production_order_id = po.id
            WHERE wc.status = 'ACTIVE'
              AND po.status NOT IN ('COMPLETED', 'CANCELLED')
              AND pos.status IN ('PENDING', 'IN_PROGRESS')
              AND DATE(COALESCE(pos.planned_start, po.scheduled_start_date, po.created_at)) BETWEEN ? AND ?
            GROUP BY wc.id, wc.code, wc.name, wc.capacity_per_hour, production_date
            ORDER BY production_date, wc.code
        `, [start, end]);
        // Filter bottlenecks
        const bottlenecks = dailyLoads
            .map(load => {
            const capacityMinutes = load.capacity_per_hour * hoursNum * 60;
            const loadPercent = capacityMinutes > 0
                ? Math.round((load.total_load_minutes / capacityMinutes) * 100)
                : 0;
            return Object.assign(Object.assign({}, load), { capacityMinutes,
                loadPercent, overloadMinutes: Math.max(0, load.total_load_minutes - capacityMinutes) });
        })
            .filter(load => load.loadPercent >= thresholdNum);
        res.json({
            threshold: thresholdNum,
            bottleneckCount: bottlenecks.length,
            bottlenecks
        });
    }
    catch (error) {
        console.error('Error getting bottlenecks:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getBottlenecks = getBottlenecks;
/**
 * GET /api/capacity/work-center/:id/schedule
 * Get detailed schedule for a specific work center
 */
const getWorkCenterSchedule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;
        const start = startDate || new Date().toISOString().split('T')[0];
        const end = endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // Get work center info
        const [wcRows] = yield db_1.pool.query('SELECT * FROM work_centers WHERE id = ?', [id]);
        if (wcRows.length === 0) {
            return res.status(404).json({ message: 'Work center not found' });
        }
        const workCenter = wcRows[0];
        // Get all scheduled steps
        const [steps] = yield db_1.pool.query(`
            SELECT 
                pos.*,
                po.order_number,
                po.qty_planned,
                po.status as order_status,
                po.scheduled_start_date,
                po.scheduled_end_date,
                p.name as product_name,
                p.sku as product_sku
            FROM production_order_steps pos
            JOIN production_orders po ON pos.production_order_id = po.id
            LEFT JOIN products p ON po.finished_product_id = p.id
            WHERE pos.work_center_id = ?
              AND po.status NOT IN ('COMPLETED', 'CANCELLED')
              AND DATE(COALESCE(pos.planned_start, po.scheduled_start_date, po.created_at)) BETWEEN ? AND ?
            ORDER BY COALESCE(pos.planned_start, po.scheduled_start_date, po.created_at), pos.sequence_number
        `, [id, start, end]);
        res.json({
            workCenter: {
                id: workCenter.id,
                code: workCenter.code,
                name: workCenter.name,
                capacityPerHour: workCenter.capacity_per_hour,
                costPerHour: workCenter.cost_per_hour,
                status: workCenter.status
            },
            schedule: steps
        });
    }
    catch (error) {
        console.error('Error getting work center schedule:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getWorkCenterSchedule = getWorkCenterSchedule;
