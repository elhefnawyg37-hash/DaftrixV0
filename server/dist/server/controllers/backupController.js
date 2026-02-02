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
exports.createBackup = createBackup;
exports.listBackups = listBackups;
exports.downloadBackup = downloadBackup;
exports.restoreBackup = restoreBackup;
exports.deleteBackup = deleteBackup;
exports.initBackupScheduler = initBackupScheduler;
exports.getBackupSettingsAPI = getBackupSettingsAPI;
exports.updateBackupSettingsAPI = updateBackupSettingsAPI;
exports.browseFolders = browseFolders;
exports.getUserBackupSettings = getUserBackupSettings;
exports.updateUserBackupSettings = updateUserBackupSettings;
exports.initAllUserBackupSchedulers = initAllUserBackupSchedulers;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const zlib_1 = require("zlib");
const fs_1 = require("fs");
const promises_1 = require("stream/promises");
const schedule = __importStar(require("node-schedule"));
const nodemailer = __importStar(require("nodemailer"));
const db_1 = require("../db");
const errorHandler_1 = require("../utils/errorHandler");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Configuration
const BACKUP_DIR = path.join(__dirname, '../../backups');
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'admin123';
const DB_NAME = process.env.DB_NAME || 'cloud_erp';
const MAX_BACKUPS = 10; // Keep last 10 backups
// Cache backup directory from settings
let customBackupDir = null;
// Get the current backup directory (from settings or default)
function getBackupDir() {
    return __awaiter(this, void 0, void 0, function* () {
        if (customBackupDir !== null) {
            return customBackupDir;
        }
        try {
            const settings = yield getBackupSettings();
            if (settings.backupPath && settings.backupPath.trim()) {
                customBackupDir = settings.backupPath.trim();
                return customBackupDir;
            }
        }
        catch (error) {
            console.error('Error getting backup path from settings:', error);
        }
        return BACKUP_DIR;
    });
}
// Clear cached backup directory (called when settings change)
function clearBackupDirCache() {
    customBackupDir = null;
}
// Scheduler state
let schedulerJob = null;
let emailTransporter = null;
// Find MariaDB bin directory on Windows
function findMariaDBBin() {
    if (process.platform !== 'win32') {
        return null; // On Unix, mysqldump should be in PATH
    }
    const fsSync = require('fs');
    const searchPaths = [
        'C:\\Program Files\\MariaDB 12.1\\bin',
        'C:\\Program Files\\MariaDB 11.0\\bin',
        'C:\\Program Files\\MariaDB 10.11\\bin',
        'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin',
        'C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin',
    ];
    // Also search for any MariaDB installation
    try {
        const programFiles = 'C:\\Program Files';
        const dirs = fsSync.readdirSync(programFiles);
        for (const dir of dirs) {
            if (dir.startsWith('MariaDB')) {
                const binPath = path.join(programFiles, dir, 'bin');
                if (fsSync.existsSync(binPath)) {
                    searchPaths.unshift(binPath);
                }
            }
        }
    }
    catch (err) {
        // Ignore errors
    }
    for (const binPath of searchPaths) {
        const mysqldumpPath = path.join(binPath, 'mysqldump.exe');
        if (fsSync.existsSync(mysqldumpPath)) {
            return binPath;
        }
    }
    return null;
}
// Get full path to mysql command
function getMySQLCommand(command) {
    const exeName = process.platform === 'win32' ? `${command}.exe` : command;
    // First check if it's in PATH
    try {
        (0, child_process_1.execSync)(`where ${exeName}`, { stdio: 'ignore' });
        return exeName;
    }
    catch (_a) {
        // Not in PATH
    }
    // On Windows, try to find MariaDB installation
    const binDir = findMariaDBBin();
    if (binDir) {
        return path.join(binDir, exeName);
    }
    // Fall back to just the command name
    return exeName;
}
// Ensure backup directory exists
function ensureBackupDir() {
    return __awaiter(this, void 0, void 0, function* () {
        const backupDir = yield getBackupDir();
        try {
            yield fs.mkdir(backupDir, { recursive: true });
        }
        catch (err) {
            console.error('Failed to create backup directory:', err);
        }
        return backupDir;
    });
}
// Get backup filename
function getBackupFilename() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
    return `${DB_NAME}-${timestamp[0]}_${timestamp[1].split('Z')[0]}.sql.gz`;
}
// Create backup
function createBackup(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const backupDir = yield ensureBackupDir();
            const filename = getBackupFilename();
            const sqlFile = path.join(backupDir, filename.replace('.gz', ''));
            const gzFile = path.join(backupDir, filename);
            // Get mysqldump command path
            const mysqldumpCmd = getMySQLCommand('mysqldump');
            // Build mysqldump command
            const cmd = `"${mysqldumpCmd}" -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p"${DB_PASSWORD}" ` +
                `--single-transaction --routines --triggers --events ` +
                `--add-drop-database --add-drop-table --complete-insert ` +
                `--hex-blob --set-charset --databases ${DB_NAME} > "${sqlFile}"`;
            // Execute mysqldump
            yield execAsync(cmd, {
                env: Object.assign(Object.assign({}, process.env), { MYSQL_PWD: DB_PASSWORD }),
                maxBuffer: 50 * 1024 * 1024 // 50MB buffer
            });
            // Compress the SQL file
            yield (0, promises_1.pipeline)((0, fs_1.createReadStream)(sqlFile), (0, zlib_1.createGzip)(), (0, fs_1.createWriteStream)(gzFile));
            // Delete uncompressed SQL file
            yield fs.unlink(sqlFile);
            // Get file stats
            const stats = yield fs.stat(gzFile);
            // Rotate old backups
            yield rotateBackups();
            // Send email notification if enabled
            const settings = yield getBackupSettings();
            if (settings.emailEnabled) {
                yield sendBackupEmail(true, filename);
            }
            res.json({
                success: true,
                filename,
                size: stats.size,
                created: stats.mtime
            });
        }
        catch (error) {
            console.error('Backup creation failed:', error);
            return (0, errorHandler_1.handleControllerError)(res, error, 'createBackup');
        }
    });
}
// List all backups
function listBackups(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const backupDir = yield ensureBackupDir();
            const files = yield fs.readdir(backupDir);
            const backups = yield Promise.all(files
                .filter(f => f.endsWith('.sql.gz'))
                .map((filename) => __awaiter(this, void 0, void 0, function* () {
                const filepath = path.join(backupDir, filename);
                const stats = yield fs.stat(filepath);
                return {
                    filename,
                    size: stats.size,
                    created: stats.mtime,
                    humanSize: formatBytes(stats.size)
                };
            })));
            // Sort by date (newest first)
            backups.sort((a, b) => b.created.getTime() - a.created.getTime());
            res.json({ success: true, backups });
        }
        catch (error) {
            console.error('Failed to list backups:', error);
            return (0, errorHandler_1.handleControllerError)(res, error, 'listBackups');
        }
    });
}
// Download backup
function downloadBackup(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { filename } = req.params;
            // Validate filename (prevent path traversal)
            if (!filename || filename.includes('..') || !filename.endsWith('.sql.gz')) {
                return res.status(400).json({ success: false, error: 'Invalid filename' });
            }
            const backupDir = yield getBackupDir();
            const filepath = path.join(backupDir, filename);
            // Check if file exists
            try {
                yield fs.access(filepath);
            }
            catch (_a) {
                return res.status(404).json({ success: false, error: 'Backup not found' });
            }
            // Send file
            res.setHeader('Content-Type', 'application/gzip');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            const fileStream = (0, fs_1.createReadStream)(filepath);
            fileStream.pipe(res);
        }
        catch (error) {
            console.error('Download failed:', error);
            return (0, errorHandler_1.handleControllerError)(res, error, 'downloadBackup');
        }
    });
}
// Restore backup
function restoreBackup(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { filename } = req.params;
            // Validate filename
            if (!filename || filename.includes('..') || !filename.endsWith('.sql.gz')) {
                return res.status(400).json({ success: false, error: 'Invalid filename' });
            }
            const backupDir = yield getBackupDir();
            const gzFile = path.join(backupDir, filename);
            const sqlFile = gzFile.replace('.gz', '');
            // Check if file exists
            try {
                yield fs.access(gzFile);
            }
            catch (_a) {
                return res.status(404).json({ success: false, error: 'Backup not found' });
            }
            // Decompress
            yield (0, promises_1.pipeline)((0, fs_1.createReadStream)(gzFile), (0, zlib_1.createGunzip)(), (0, fs_1.createWriteStream)(sqlFile));
            // Get mysql command path
            const mysqlCmd = getMySQLCommand('mysql');
            // Build mysql restore command
            const cmd = `"${mysqlCmd}" -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p"${DB_PASSWORD}" < "${sqlFile}"`;
            // Execute restore
            yield execAsync(cmd, {
                env: Object.assign(Object.assign({}, process.env), { MYSQL_PWD: DB_PASSWORD }),
                maxBuffer: 50 * 1024 * 1024
            });
            // Delete temporary SQL file
            yield fs.unlink(sqlFile);
            res.json({ success: true, message: 'Database restored successfully' });
        }
        catch (error) {
            console.error('Restore failed:', error);
            return (0, errorHandler_1.handleControllerError)(res, error, 'restoreBackup');
        }
    });
}
// Delete backup
function deleteBackup(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { filename } = req.params;
            // Validate filename
            if (!filename || filename.includes('..') || !filename.endsWith('.sql.gz')) {
                return res.status(400).json({ success: false, error: 'Invalid filename' });
            }
            const backupDir = yield getBackupDir();
            const filepath = path.join(backupDir, filename);
            // Check if file exists
            try {
                yield fs.access(filepath);
            }
            catch (_a) {
                return res.status(404).json({ success: false, error: 'Backup not found' });
            }
            // Delete file
            yield fs.unlink(filepath);
            res.json({ success: true, message: 'Backup deleted successfully' });
        }
        catch (error) {
            console.error('Delete failed:', error);
            return (0, errorHandler_1.handleControllerError)(res, error, 'deleteBackup');
        }
    });
}
// Rotate backups (keep only maxBackups from settings or default)
function rotateBackups() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const settings = yield getBackupSettings();
            const maxBackups = settings.maxBackups || MAX_BACKUPS;
            const backupDir = yield getBackupDir();
            const files = yield fs.readdir(backupDir);
            const backups = yield Promise.all(files
                .filter(f => f.endsWith('.sql.gz'))
                .map((filename) => __awaiter(this, void 0, void 0, function* () {
                const filepath = path.join(backupDir, filename);
                const stats = yield fs.stat(filepath);
                return { filename, filepath, mtime: stats.mtime };
            })));
            // Sort by date (oldest first)
            backups.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
            // Delete old backups
            const toDelete = backups.slice(0, Math.max(0, backups.length - maxBackups));
            for (const backup of toDelete) {
                yield fs.unlink(backup.filepath);
                console.log(`Rotated old backup: ${backup.filename}`);
            }
        }
        catch (error) {
            console.error('Backup rotation failed:', error);
        }
    });
}
// Helper: Format bytes to human readable
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
// ===== EMAIL NOTIFICATIONS =====
function getBackupSettings() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const conn = yield (0, db_1.getConnection)();
            const [rows] = yield conn.query('SELECT config FROM system_config LIMIT 1');
            conn.release();
            if (rows.length > 0) {
                const config = JSON.parse(rows[0].config || '{}');
                return config.backup || {};
            }
            return {};
        }
        catch (error) {
            console.error('Failed to load backup settings:', error);
            return {};
        }
    });
}
function initEmailTransporter(settings) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!settings.emailEnabled || !settings.smtpHost) {
            emailTransporter = null;
            return;
        }
        emailTransporter = nodemailer.createTransport({
            host: settings.smtpHost,
            port: settings.smtpPort || 587,
            secure: settings.smtpSecure || false,
            auth: {
                user: settings.smtpUser,
                pass: settings.smtpPassword
            }
        });
    });
}
function sendBackupEmail(success, filename, error) {
    return __awaiter(this, void 0, void 0, function* () {
        const settings = yield getBackupSettings();
        if (!emailTransporter || !settings.notificationEmail) {
            return;
        }
        const subject = success
            ? `✅ Backup Successful - ${filename}`
            : `❌ Backup Failed`;
        const html = success
            ? `<h2>Backup Created Successfully</h2>
           <p>A new database backup has been created:</p>
           <ul>
               <li><strong>Filename:</strong> ${filename}</li>
               <li><strong>Time:</strong> ${new Date().toLocaleString('ar-EG')}</li>
               <li><strong>Database:</strong> ${DB_NAME}</li>
           </ul>`
            : `<h2>Backup Failed</h2>
           <p>The automated backup process encountered an error:</p>
           <pre>${error}</pre>`;
        try {
            yield emailTransporter.sendMail({
                from: settings.smtpUser,
                to: settings.notificationEmail,
                subject,
                html
            });
            console.log('📧 Backup notification sent to:', settings.notificationEmail);
        }
        catch (err) {
            console.error('Failed to send backup email:', err);
        }
    });
}
// ===== SCHEDULER =====
function createScheduledBackup() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🔄 Running scheduled backup...');
        try {
            const backupDir = yield ensureBackupDir();
            const filename = getBackupFilename();
            const sqlFile = path.join(backupDir, filename.replace('.gz', ''));
            const gzFile = path.join(backupDir, filename);
            const mysqldumpCmd = getMySQLCommand('mysqldump');
            const cmd = `"${mysqldumpCmd}" -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p"${DB_PASSWORD}" ` +
                `--single-transaction --routines --triggers --events ` +
                `--add-drop-database --add-drop-table --complete-insert ` +
                `--hex-blob --set-charset --databases ${DB_NAME} > "${sqlFile}"`;
            yield execAsync(cmd, {
                env: Object.assign(Object.assign({}, process.env), { MYSQL_PWD: DB_PASSWORD }),
                maxBuffer: 50 * 1024 * 1024
            });
            yield (0, promises_1.pipeline)((0, fs_1.createReadStream)(sqlFile), (0, zlib_1.createGzip)(), (0, fs_1.createWriteStream)(gzFile));
            yield fs.unlink(sqlFile);
            yield rotateBackups();
            console.log('✅ Scheduled backup created:', filename);
            yield sendBackupEmail(true, filename);
        }
        catch (error) {
            console.error('❌ Scheduled backup failed:', error);
            yield sendBackupEmail(false, undefined, error.message);
        }
    });
}
function initBackupScheduler() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const settings = yield getBackupSettings();
            // Initialize email if enabled
            yield initEmailTransporter(settings);
            // Cancel existing job
            if (schedulerJob) {
                schedulerJob.cancel();
                schedulerJob = null;
            }
            // Schedule new job if enabled
            if (settings.scheduleEnabled && settings.scheduleFrequency) {
                // Get custom time or default to 2 AM
                const hour = settings.scheduleHour !== undefined ? settings.scheduleHour : 2;
                const minute = settings.scheduleMinute !== undefined ? settings.scheduleMinute : 0;
                let cronExpression;
                switch (settings.scheduleFrequency) {
                    case 'daily':
                        cronExpression = `${minute} ${hour} * * *`; // User-specified time daily
                        break;
                    case 'weekly':
                        // Day of week: settings.scheduleDayOfWeek or default to Sunday (0)
                        const dayOfWeek = settings.scheduleDayOfWeek !== undefined ? settings.scheduleDayOfWeek : 0;
                        cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;
                        break;
                    case 'monthly':
                        // Day of month: settings.scheduleDayOfMonth or default to 1st
                        const dayOfMonth = settings.scheduleDayOfMonth !== undefined ? settings.scheduleDayOfMonth : 1;
                        cronExpression = `${minute} ${hour} ${dayOfMonth} * *`;
                        break;
                    case 'hourly': // For testing
                        cronExpression = `${minute} * * * *`; // Every hour at specified minute
                        break;
                    default:
                        console.log('Invalid schedule frequency:', settings.scheduleFrequency);
                        return;
                }
                schedulerJob = schedule.scheduleJob(cronExpression, createScheduledBackup);
                console.log(`✅ Backup scheduler initialized (${settings.scheduleFrequency} at ${hour}:${minute.toString().padStart(2, '0')})`);
            }
            else {
                console.log('ℹ️ Backup scheduler is disabled');
            }
        }
        catch (error) {
            console.error('Failed to initialize backup scheduler:', error);
        }
    });
}
// ===== SETTINGS API =====
function getBackupSettingsAPI(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const settings = yield getBackupSettings();
            res.json({ success: true, settings });
        }
        catch (error) {
            return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
        }
    });
}
function updateBackupSettingsAPI(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const newSettings = req.body;
            const conn = yield (0, db_1.getConnection)();
            // Get current config
            const [rows] = yield conn.query('SELECT config FROM system_config LIMIT 1');
            const currentConfig = rows.length > 0
                ? JSON.parse(rows[0].config || '{}')
                : {};
            // Update backup settings
            currentConfig.backup = newSettings;
            // Save to database
            yield conn.query('UPDATE system_config SET config = ?', [JSON.stringify(currentConfig)]);
            conn.release();
            // Clear cached backup directory so it's re-read
            clearBackupDirCache();
            // Reinitialize scheduler with new settings
            yield initBackupScheduler();
            res.json({ success: true, message: 'Backup settings updated' });
        }
        catch (error) {
            return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
        }
    });
}
// ===== FOLDER BROWSER API =====
function browseFolders(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const requestedPath = req.query.path || '';
            const fsSync = require('fs');
            // Determine the base path to browse
            let basePath;
            if (!requestedPath) {
                // Return available drives on Windows or root folders
                if (process.platform === 'win32') {
                    const drives = [];
                    // Check common drive letters
                    for (const letter of ['C', 'D', 'E', 'F', 'G', 'H']) {
                        const drivePath = `${letter}:\\`;
                        try {
                            if (fsSync.existsSync(drivePath)) {
                                fsSync.accessSync(drivePath, fsSync.constants.R_OK);
                                drives.push({
                                    name: `القرص ${letter}:`,
                                    path: drivePath,
                                    type: 'drive'
                                });
                            }
                        }
                        catch (_a) {
                            // Drive doesn't exist or not accessible
                        }
                    }
                    // Add network paths option
                    drives.push({
                        name: 'مجلد شبكة...',
                        path: '\\\\',
                        type: 'network'
                    });
                    return res.json({
                        success: true,
                        currentPath: '',
                        parentPath: null,
                        folders: drives
                    });
                }
                else {
                    basePath = '/';
                }
            }
            else {
                basePath = requestedPath;
            }
            // Validate path exists and is accessible
            try {
                const stat = yield fs.stat(basePath);
                if (!stat.isDirectory()) {
                    return res.status(400).json({ success: false, error: 'Path is not a directory' });
                }
            }
            catch (err) {
                return res.status(400).json({ success: false, error: 'Path does not exist or is not accessible' });
            }
            // Read directory contents
            const entries = yield fs.readdir(basePath, { withFileTypes: true });
            const folders = [];
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // Skip hidden folders and system folders
                    if (entry.name.startsWith('.') || entry.name.startsWith('$')) {
                        continue;
                    }
                    const fullPath = path.join(basePath, entry.name);
                    // Check if folder is accessible
                    try {
                        fsSync.accessSync(fullPath, fsSync.constants.R_OK);
                        folders.push({
                            name: entry.name,
                            path: fullPath,
                            type: 'folder'
                        });
                    }
                    catch (_b) {
                        // Skip inaccessible folders
                    }
                }
            }
            // Sort folders alphabetically
            folders.sort((a, b) => a.name.localeCompare(b.name));
            // Get parent path
            const parentPath = path.dirname(basePath);
            const hasParent = parentPath !== basePath && basePath !== '';
            res.json({
                success: true,
                currentPath: basePath,
                parentPath: hasParent ? parentPath : null,
                folders
            });
        }
        catch (error) {
            console.error('Browse folders error:', error);
            return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
        }
    });
}
// ===== USER-SPECIFIC BACKUP SETTINGS =====
// Get user's personal backup settings
function getUserBackupSettings(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'User not authenticated' });
            }
            const conn = yield (0, db_1.getConnection)();
            const [rows] = yield conn.query('SELECT * FROM user_backup_settings WHERE userId = ?', [userId]);
            conn.release();
            const settings = rows.length > 0 ? rows[0] : null;
            res.json({ success: true, settings });
        }
        catch (error) {
            console.error('Error getting user backup settings:', error);
            return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
        }
    });
}
// Update user's personal backup settings
function updateUserBackupSettings(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'User not authenticated' });
            }
            const settings = req.body;
            const conn = yield (0, db_1.getConnection)();
            // Check if settings exist
            const [existing] = yield conn.query('SELECT id FROM user_backup_settings WHERE userId = ?', [userId]);
            if (existing.length > 0) {
                // Update existing
                yield conn.query(`
                UPDATE user_backup_settings SET
                    scheduleEnabled = ?,
                    scheduleFrequency = ?,
                    scheduleHour = ?,
                    scheduleMinute = ?,
                    scheduleDayOfWeek = ?,
                    scheduleDayOfMonth = ?,
                    backupPath = ?,
                    deliveryEmail = ?,
                    updatedAt = NOW()
                WHERE userId = ?
            `, [
                    settings.scheduleEnabled || false,
                    settings.scheduleFrequency || 'daily',
                    (_b = settings.scheduleHour) !== null && _b !== void 0 ? _b : 2,
                    (_c = settings.scheduleMinute) !== null && _c !== void 0 ? _c : 0,
                    (_d = settings.scheduleDayOfWeek) !== null && _d !== void 0 ? _d : 0,
                    (_e = settings.scheduleDayOfMonth) !== null && _e !== void 0 ? _e : 1,
                    settings.backupPath || null,
                    settings.deliveryEmail || null,
                    userId
                ]);
            }
            else {
                // Insert new
                const { v4: uuidv4 } = yield Promise.resolve().then(() => __importStar(require('uuid')));
                yield conn.query(`
                INSERT INTO user_backup_settings 
                (id, userId, scheduleEnabled, scheduleFrequency, scheduleHour, scheduleMinute, 
                 scheduleDayOfWeek, scheduleDayOfMonth, backupPath, deliveryEmail)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                    uuidv4(),
                    userId,
                    settings.scheduleEnabled || false,
                    settings.scheduleFrequency || 'daily',
                    (_f = settings.scheduleHour) !== null && _f !== void 0 ? _f : 2,
                    (_g = settings.scheduleMinute) !== null && _g !== void 0 ? _g : 0,
                    (_h = settings.scheduleDayOfWeek) !== null && _h !== void 0 ? _h : 0,
                    (_j = settings.scheduleDayOfMonth) !== null && _j !== void 0 ? _j : 1,
                    settings.backupPath || null,
                    settings.deliveryEmail || null
                ]);
            }
            conn.release();
            // Reinitialize user backup scheduler
            yield initUserBackupScheduler(userId);
            res.json({ success: true, message: 'User backup settings saved' });
        }
        catch (error) {
            console.error('Error updating user backup settings:', error);
            return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
        }
    });
}
// User backup scheduler state (one job per user)
const userSchedulerJobs = new Map();
// Initialize backup scheduler for a specific user
function initUserBackupScheduler(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            // Cancel existing job for this user
            const existingJob = userSchedulerJobs.get(userId);
            if (existingJob) {
                existingJob.cancel();
                userSchedulerJobs.delete(userId);
            }
            const conn = yield (0, db_1.getConnection)();
            const [rows] = yield conn.query('SELECT * FROM user_backup_settings WHERE userId = ? AND scheduleEnabled = TRUE', [userId]);
            conn.release();
            if (rows.length === 0) {
                console.log(`ℹ️ User ${userId} backup scheduler disabled or not configured`);
                return;
            }
            const settings = rows[0];
            const hour = (_a = settings.scheduleHour) !== null && _a !== void 0 ? _a : 2;
            const minute = (_b = settings.scheduleMinute) !== null && _b !== void 0 ? _b : 0;
            let cronExpression;
            switch (settings.scheduleFrequency) {
                case 'daily':
                    cronExpression = `${minute} ${hour} * * *`;
                    break;
                case 'weekly':
                    cronExpression = `${minute} ${hour} * * ${(_c = settings.scheduleDayOfWeek) !== null && _c !== void 0 ? _c : 0}`;
                    break;
                case 'monthly':
                    cronExpression = `${minute} ${hour} ${(_d = settings.scheduleDayOfMonth) !== null && _d !== void 0 ? _d : 1} * *`;
                    break;
                case 'hourly':
                    cronExpression = `${minute} * * * *`;
                    break;
                default:
                    console.log(`Invalid schedule frequency for user ${userId}`);
                    return;
            }
            const job = schedule.scheduleJob(cronExpression, () => createUserBackup(userId, settings.backupPath, settings.deliveryEmail));
            userSchedulerJobs.set(userId, job);
            console.log(`✅ User ${userId} backup scheduler initialized (${settings.scheduleFrequency} at ${hour}:${minute.toString().padStart(2, '0')})`);
        }
        catch (error) {
            console.error(`Failed to initialize user backup scheduler for ${userId}:`, error);
        }
    });
}
// Create backup for a specific user with optional custom path
function createUserBackup(userId, customPath, email) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`🔄 Running user backup for user ${userId}...`);
        try {
            // Use custom path if provided, otherwise use default backup dir
            let backupDir;
            if (customPath) {
                // Ensure custom directory exists
                try {
                    yield fs.access(customPath);
                }
                catch (_a) {
                    yield fs.mkdir(customPath, { recursive: true });
                }
                backupDir = customPath;
                console.log(`📁 Using custom backup path: ${customPath}`);
            }
            else {
                backupDir = yield ensureBackupDir();
            }
            const filename = `user-${userId.slice(0, 8)}-${getBackupFilename()}`;
            const sqlFile = path.join(backupDir, filename.replace('.gz', ''));
            const gzFile = path.join(backupDir, filename);
            const mysqldumpCmd = getMySQLCommand('mysqldump');
            const cmd = `"${mysqldumpCmd}" -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p"${DB_PASSWORD}" ` +
                `--single-transaction --routines --triggers --events ` +
                `--add-drop-database --add-drop-table --complete-insert ` +
                `--hex-blob --set-charset --databases ${DB_NAME} > "${sqlFile}"`;
            yield execAsync(cmd, {
                env: Object.assign(Object.assign({}, process.env), { MYSQL_PWD: DB_PASSWORD }),
                maxBuffer: 50 * 1024 * 1024
            });
            yield (0, promises_1.pipeline)((0, fs_1.createReadStream)(sqlFile), (0, zlib_1.createGzip)(), (0, fs_1.createWriteStream)(gzFile));
            yield fs.unlink(sqlFile);
            // Update user backup status
            const conn = yield (0, db_1.getConnection)();
            yield conn.query(`
            UPDATE user_backup_settings 
            SET lastBackupDate = NOW(), lastBackupStatus = 'SUCCESS', lastBackupFilename = ?
            WHERE userId = ?
        `, [filename, userId]);
            // Send email with attachment if email is provided
            if (email) {
                yield sendUserBackupEmail(email, gzFile, filename, true);
            }
            conn.release();
            console.log(`✅ User backup created: ${filename} (path: ${backupDir})`);
            // Clean up user-specific backups (keep last 5)
            yield rotateUserBackups(userId, backupDir);
        }
        catch (error) {
            console.error(`❌ User backup failed for ${userId}:`, error);
            // Update status to failed
            try {
                const conn = yield (0, db_1.getConnection)();
                yield conn.query(`
                UPDATE user_backup_settings 
                SET lastBackupDate = NOW(), lastBackupStatus = 'FAILED'
                WHERE userId = ?
            `, [userId]);
                conn.release();
            }
            catch (e) { }
            // Send failure email if email is provided
            if (email) {
                yield sendUserBackupEmail(email, null, null, false, error.message);
            }
        }
    });
}
// Send backup email to user
function sendUserBackupEmail(email, filePath, filename, success, errorMessage) {
    return __awaiter(this, void 0, void 0, function* () {
        const settings = yield getBackupSettings();
        if (!settings.smtpHost) {
            console.log('📧 Email not configured, skipping user backup email');
            return;
        }
        try {
            const transporter = nodemailer.createTransport({
                host: settings.smtpHost,
                port: settings.smtpPort || 587,
                secure: settings.smtpSecure || false,
                auth: {
                    user: settings.smtpUser,
                    pass: settings.smtpPassword
                }
            });
            const subject = success
                ? `✅ نسختك الاحتياطية جاهزة - ${filename}`
                : '❌ فشل في إنشاء النسخة الاحتياطية';
            const html = success
                ? `<h2>تم إنشاء نسختك الاحتياطية بنجاح</h2>
               <p>مرفق نسخة احتياطية من قاعدة البيانات:</p>
               <ul>
                   <li><strong>الملف:</strong> ${filename}</li>
                   <li><strong>التاريخ:</strong> ${new Date().toLocaleString('ar-EG')}</li>
               </ul>
               <p>يرجى الاحتفاظ بهذا الملف في مكان آمن.</p>`
                : `<h2>فشل في إنشاء النسخة الاحتياطية</h2>
               <p>حدث خطأ أثناء إنشاء نسختك الاحتياطية:</p>
               <pre>${errorMessage}</pre>`;
            const mailOptions = {
                from: settings.smtpUser,
                to: email,
                subject,
                html
            };
            // Attach the backup file if success
            if (success && filePath) {
                mailOptions.attachments = [{
                        filename: filename,
                        path: filePath
                    }];
            }
            yield transporter.sendMail(mailOptions);
            console.log(`📧 User backup email sent to: ${email}`);
        }
        catch (err) {
            console.error('Failed to send user backup email:', err);
        }
    });
}
// Rotate user-specific backups (keep last 5)
function rotateUserBackups(userId, customBackupDir) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const backupDir = customBackupDir || (yield getBackupDir());
            const files = yield fs.readdir(backupDir);
            const userBackups = files.filter(f => f.startsWith(`user-${userId.slice(0, 8)}`) && f.endsWith('.sql.gz'));
            if (userBackups.length <= 5)
                return;
            // Get file dates and sort
            const backupsWithDates = yield Promise.all(userBackups.map((filename) => __awaiter(this, void 0, void 0, function* () {
                const filepath = path.join(backupDir, filename);
                const stats = yield fs.stat(filepath);
                return { filename, filepath, mtime: stats.mtime };
            })));
            // Sort by date (oldest first)
            backupsWithDates.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
            // Delete old backups
            const toDelete = backupsWithDates.slice(0, backupsWithDates.length - 5);
            for (const backup of toDelete) {
                yield fs.unlink(backup.filepath);
                console.log(`🗑️ Rotated old user backup: ${backup.filename}`);
            }
        }
        catch (error) {
            console.error('User backup rotation failed:', error);
        }
    });
}
// Initialize all user backup schedulers on server start
function initAllUserBackupSchedulers() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const conn = yield (0, db_1.getConnection)();
            const [rows] = yield conn.query('SELECT userId FROM user_backup_settings WHERE scheduleEnabled = TRUE');
            conn.release();
            for (const row of rows) {
                yield initUserBackupScheduler(row.userId);
            }
            console.log(`✅ Initialized ${rows.length} user backup schedulers`);
        }
        catch (error) {
            console.error('Failed to initialize user backup schedulers:', error);
        }
    });
}
