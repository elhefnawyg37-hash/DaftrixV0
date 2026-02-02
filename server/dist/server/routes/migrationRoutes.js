"use strict";
/**
 * Migration Routes
 * Handles data import from Excel/CSV and external databases
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const migrationController_1 = require("../controllers/migrationController");
const router = express_1.default.Router();
// Configure multer for file uploads (memory storage)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept Excel and CSV files
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv',
            'application/csv',
            'text/plain' // Sometimes CSV is detected as plain text
        ];
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
        }
    }
});
// ========================================
// GENERAL ENDPOINTS
// ========================================
// Get list of supported entities
router.get('/entities', migrationController_1.getEntities);
// Get current database statistics
router.get('/stats', migrationController_1.getMigrationStats);
// Download Excel template for an entity
router.get('/template/:entity', migrationController_1.downloadTemplate);
// ========================================
// FILE UPLOAD ENDPOINTS
// ========================================
// Parse uploaded file and detect mappings
router.post('/parse', upload.single('file'), migrationController_1.parseUploadedFile);
// Validate data with mappings
router.post('/validate', upload.single('file'), migrationController_1.validateData);
// Import data into database
router.post('/import', upload.single('file'), migrationController_1.importData);
// ========================================
// DATABASE CONNECTOR ENDPOINTS
// ========================================
// Test connection to external database
router.post('/db/test-connection', migrationController_1.testDatabaseConnection);
// Get tables and structure from external database
router.post('/db/tables', migrationController_1.getDatabaseTables);
// Preview data from external table
router.post('/db/preview', migrationController_1.previewDatabaseTable);
// Import data from external database
router.post('/db/import', migrationController_1.importFromDatabase);
exports.default = router;
