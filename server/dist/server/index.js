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
console.log('🚀🚀🚀 STARTING SERVER - DEBUG VERSION 1000 🚀🚀🚀');
console.log('If you do not see this, you are running the WRONG CODE/FOLDER');
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const socket_1 = require("./socket");
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./db");
const rateLimiter_1 = require("./middleware/rateLimiter");
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const partnerRoutes_1 = __importDefault(require("./routes/partnerRoutes"));
const accountRoutes_1 = __importDefault(require("./routes/accountRoutes"));
const invoiceRoutes_1 = __importDefault(require("./routes/invoiceRoutes"));
const syncRoutes_1 = __importDefault(require("./routes/syncRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const masterDataRoutes_1 = __importDefault(require("./routes/masterDataRoutes"));
const treasuryRoutes_1 = __importDefault(require("./routes/treasuryRoutes"));
const productStockRoutes_1 = __importDefault(require("./routes/productStockRoutes"));
const priceListRoutes_1 = __importDefault(require("./routes/priceListRoutes"));
const permissionRoutes_1 = __importDefault(require("./routes/permissionRoutes"));
const bomRoutes_1 = __importDefault(require("./routes/bomRoutes"));
const productionRoutes_1 = __importDefault(require("./routes/productionRoutes"));
const stockMovementRoutes_1 = __importDefault(require("./routes/stockMovementRoutes"));
const scrapRoutes_1 = __importDefault(require("./routes/scrapRoutes"));
const backupRoutes_1 = __importDefault(require("./routes/backupRoutes"));
const settingsRoutes_1 = __importDefault(require("./routes/settingsRoutes"));
const inventoryRoutes_1 = __importDefault(require("./routes/inventoryRoutes"));
const fixedAssetsRoutes_1 = __importDefault(require("./routes/fixedAssetsRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const journalRoutes_1 = __importDefault(require("./routes/journalRoutes"));
const stockPermitRoutes_1 = __importDefault(require("./routes/stockPermitRoutes"));
const auditRoutes_1 = __importDefault(require("./routes/auditRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const workCenterRoutes_1 = __importDefault(require("./routes/workCenterRoutes"));
const routingRoutes_1 = __importDefault(require("./routes/routingRoutes"));
const qualityRoutes_1 = __importDefault(require("./routes/qualityRoutes"));
const batchRoutes_1 = __importDefault(require("./routes/batchRoutes"));
const migrationRoutes_1 = __importDefault(require("./routes/migrationRoutes"));
const installmentRoutes_1 = __importDefault(require("./routes/installmentRoutes"));
const capacityRoutes_1 = __importDefault(require("./routes/capacityRoutes"));
const mrpRoutes_1 = __importDefault(require("./routes/mrpRoutes"));
const hrRoutes_1 = __importDefault(require("./routes/hrRoutes"));
const vehicleRoutes_1 = __importDefault(require("./routes/vehicleRoutes"));
const deltaSyncRoutes_1 = __importDefault(require("./routes/deltaSyncRoutes"));
const salesmanTargetRoutes_1 = __importDefault(require("./routes/salesmanTargetRoutes"));
const commissionRoutes_1 = __importDefault(require("./routes/commissionRoutes"));
const posRoutes_1 = __importDefault(require("./routes/posRoutes"));
const authMiddleware_1 = require("./middleware/authMiddleware");
const backupController_1 = require("./controllers/backupController");
dotenv_1.default.config();
// Force Egyptian timezone (UTC+2 / EET) for all date operations
process.env.TZ = 'Africa/Cairo';
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Global Error Handling for Debugging
process.on('uncaughtException', (err) => {
    console.error('❌ UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED REJECTION:', reason);
});
// Create HTTP server for WebSocket support
const httpServer = http_1.default.createServer(app);
// Enhanced CORS for ngrok and external access
app.use((0, cors_1.default)({
    origin: true, // Reflects the request origin, effectively allowing all but enabling credentials
    credentials: true,
    exposedHeaders: ['ngrok-skip-browser-warning'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));
app.use(body_parser_1.default.json({ limit: '50mb' }));
app.use(body_parser_1.default.urlencoded({ limit: '50mb', extended: true }));
// Apply rate limiting to all API routes
app.use('/api/', rateLimiter_1.apiLimiter);
// Public Routes
app.use('/api/auth', authRoutes_1.default);
// Health check for mobile (no auth required)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.5.0' });
});
// DEBUG: Check bank invoices (temp - remove after debugging)
app.get('/api/debug-bank', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { pool } = yield Promise.resolve().then(() => __importStar(require('./db')));
        const [invoices] = yield pool.query(`
            SELECT id, date as rawDate, DATE(date) as dateOnly, total, paymentMethod, status, type 
            FROM invoices 
            WHERE paymentMethod = 'BANK' 
            AND status = 'POSTED'
            ORDER BY date DESC
            LIMIT 10
        `);
        const [settlements] = yield pool.query(`
            SELECT id, settlementDate, totalBankTransfers, salesmanId 
            FROM vehicle_settlements 
            ORDER BY settlementDate DESC 
            LIMIT 10
        `);
        // Test calculation for each settlement
        const calculatedSettlements = yield Promise.all(settlements.map((s) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const settDate = s.settlementDate ? new Date(s.settlementDate) : null;
            // Add 2 hours to convert UTC to Egypt time (UTC+2)
            const egyptDate = settDate ? new Date(settDate.getTime() + 2 * 60 * 60 * 1000) : null;
            const dateStr = egyptDate ? egyptDate.toISOString().slice(0, 10) : null;
            let calculated = { dateStr, bankTotal: 0, count: 0, error: null };
            if (dateStr) {
                try {
                    const [bankResult] = yield pool.query(`
                        SELECT COALESCE(SUM(total), 0) as totalBank, COUNT(*) as count
                        FROM invoices 
                        WHERE DATE(date) = ?
                        AND paymentMethod = 'BANK'
                        AND status = 'POSTED'
                    `, [dateStr]);
                    calculated.bankTotal = Number((_a = bankResult[0]) === null || _a === void 0 ? void 0 : _a.totalBank) || 0;
                    calculated.count = Number((_b = bankResult[0]) === null || _b === void 0 ? void 0 : _b.count) || 0;
                }
                catch (e) {
                    calculated.error = e.message;
                }
            }
            return { id: s.id, settlementDate: s.settlementDate, storedValue: s.totalBankTransfers, calculated };
        })));
        res.json({
            bankInvoicesCount: invoices.length,
            bankInvoices: invoices,
            calculatedSettlements,
            message: `Found ${invoices.length} BANK invoices in database`
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}));
// DEBUG: Check discounts on invoices (temp - for settlement debugging)
app.get('/api/debug-discounts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { pool } = yield Promise.resolve().then(() => __importStar(require('./db')));
        const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
        // Get ALL invoices for this date (not filtered by type)
        const [allInvoices] = yield pool.query(`
            SELECT id, type, globalDiscount, discount, total, status, partnerName, DATE(date) as invoiceDate
            FROM invoices 
            WHERE DATE(date) = ?
        `, [dateStr]);
        // Get only sale invoices with the settlement filter
        const [saleInvoices] = yield pool.query(`
            SELECT id, type, globalDiscount, discount, total, status, partnerName
            FROM invoices 
            WHERE DATE(date) = ?
            AND (type LIKE '%SALE%' AND type NOT LIKE '%RETURN%')
            AND status = 'POSTED'
        `, [dateStr]);
        // Calculate total
        let totalDiscounts = 0;
        const saleDetails = saleInvoices.map((inv) => {
            const discountAmount = (Number(inv.globalDiscount) || 0) + (Number(inv.discount) || 0);
            totalDiscounts += discountAmount;
            return {
                id: inv.id,
                type: inv.type,
                globalDiscount: inv.globalDiscount,
                discount: inv.discount,
                calculatedDiscount: discountAmount,
                total: inv.total,
                partnerName: inv.partnerName,
                status: inv.status
            };
        });
        res.json({
            queryDate: dateStr,
            totalInvoicesOnDate: allInvoices.length,
            allInvoiceTypes: allInvoices.map((i) => ({ type: i.type, total: i.total, status: i.status, globalDiscount: i.globalDiscount, discount: i.discount })),
            saleInvoicesWithDiscounts: saleDetails,
            calculatedTotalDiscounts: totalDiscounts,
            message: `Found ${saleInvoices.length} sale invoices with ${totalDiscounts} total discounts`
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}));
// Protected Routes Middleware
// Protect all other API routes
app.use('/api', (req, res, next) => {
    // Exclude auth routes (already handled above, but double check)
    if (req.path.startsWith('/auth'))
        return next();
    (0, authMiddleware_1.authenticateToken)(req, res, next);
});
// Routes
// Root route removed to allow frontend serving
// app.get('/', (req, res) => {
//     res.send('Cloud ERP API is running');
// });
app.use('/api/products', productRoutes_1.default);
app.use('/api/partners', partnerRoutes_1.default);
app.use('/api/accounts', accountRoutes_1.default);
app.use('/api/invoices', invoiceRoutes_1.default);
app.use('/api/sync', syncRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/master', masterDataRoutes_1.default);
app.use('/api/treasury', treasuryRoutes_1.default);
app.use('/api/settings', settingsRoutes_1.default);
app.use('/api/inventory', inventoryRoutes_1.default);
app.use('/api/accounting', fixedAssetsRoutes_1.default);
app.use('/api/product-stocks', productStockRoutes_1.default);
app.use('/api/price-lists', priceListRoutes_1.default);
app.use('/api/permissions', permissionRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/journals', journalRoutes_1.default);
// Manufacturing Module Routes
app.use('/api/bom', bomRoutes_1.default);
app.use('/api/production', productionRoutes_1.default);
app.use('/api/stock-movements', stockMovementRoutes_1.default);
app.use('/api/scrap', scrapRoutes_1.default);
app.use('/api/work-centers', workCenterRoutes_1.default);
app.use('/api/routings', routingRoutes_1.default);
app.use('/api/quality', qualityRoutes_1.default);
app.use('/api/batches', batchRoutes_1.default);
app.use('/api/stock-permits', stockPermitRoutes_1.default);
app.use('/api/backup', backupRoutes_1.default);
app.use('/api/audit', auditRoutes_1.default);
app.use('/api/migration', migrationRoutes_1.default);
app.use('/api/installments', installmentRoutes_1.default);
app.use('/api/capacity', capacityRoutes_1.default);
app.use('/api/mrp', mrpRoutes_1.default);
// HR & Payroll Module Routes
app.use('/api/hr', hrRoutes_1.default);
// Van Sales / Mobile Distribution Routes
app.use('/api/vehicles', vehicleRoutes_1.default);
app.use('/api/salesman-targets', salesmanTargetRoutes_1.default);
app.use('/api/commissions', commissionRoutes_1.default);
// POS (Point of Sale) Routes
app.use('/api/pos', posRoutes_1.default);
// Delta Sync Routes (for mobile offline)
app.use('/api', deltaSyncRoutes_1.default);
// Chat stub route (chat uses WebSockets primarily, this prevents 404 errors)
app.get('/api/chat/messages', (req, res) => {
    res.json({ messages: [] });
});
// Serve static frontend files (production build)
// Check multiple possible locations for the frontend build:
// 1. Root-level dist (when running with ts-node from server/)
// 2. Root-level dist (when running compiled JS from server/dist/server/)
// 3. Fallback to build folder for legacy packages
const fs = require('fs');
const possiblePaths = [
    path_1.default.join(__dirname, '..', 'dist'), // When running ts-node from server/
    path_1.default.join(__dirname, '..', '..', '..', 'dist'), // When running compiled from server/dist/server/
    path_1.default.join(__dirname, '..', '..', 'dist'), // Alternative structure
    path_1.default.join(__dirname, '..', 'build'), // Legacy build folder
    path_1.default.join(__dirname, '..', '..', '..', 'build') // Legacy when compiled
];
const frontendPath = possiblePaths.find(p => fs.existsSync(path_1.default.join(p, 'index.html'))) || possiblePaths[0];
console.log(`📂 Serving frontend from: ${frontendPath}`);
// Add cache control - no caching for HTML, short cache for assets
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path === '/') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});
app.use(express_1.default.static(frontendPath, {
    etag: false,
    lastModified: false
}));
// Handle SPA routing - send all non-API requests to index.html
app.get('*', (req, res) => {
    // Don't intercept API routes or WebSocket
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path_1.default.join(frontendPath, 'index.html'));
});
// Initialize Database and Start Server
(0, db_1.initDB)().then(() => {
    // Initialize WebSocket
    const io = (0, socket_1.initializeWebSocket)(httpServer);
    console.log('✅ WebSocket server initialized');
    // Store io instance
    app.set('io', io);
    httpServer.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`🔌 WebSocket ready on ws://0.0.0.0:${PORT}`);
        // Initialize backup scheduler
        (0, backupController_1.initBackupScheduler)().catch(err => {
            console.error('Failed to initialize backup scheduler:', err);
        });
        // Initialize user-specific backup schedulers
        (0, backupController_1.initAllUserBackupSchedulers)().catch(err => {
            console.error('Failed to initialize user backup schedulers:', err);
        });
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
