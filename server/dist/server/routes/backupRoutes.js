"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const backupController_1 = require("../controllers/backupController");
const router = express_1.default.Router();
// Create new backup
router.post('/create', backupController_1.createBackup);
// List all backups
router.get('/list', backupController_1.listBackups);
// Download specific backup
router.get('/:filename/download', backupController_1.downloadBackup);
// Restore from backup
router.post('/:filename/restore', backupController_1.restoreBackup);
// Delete backup
router.delete('/:filename', backupController_1.deleteBackup);
// Get backup settings (server-wide)
router.get('/settings', backupController_1.getBackupSettingsAPI);
// Update backup settings (server-wide)
router.post('/settings', backupController_1.updateBackupSettingsAPI);
// Browse server folders (for backup path selection)
router.get('/browse-folders', backupController_1.browseFolders);
// User-specific backup settings
router.get('/user-settings', backupController_1.getUserBackupSettings);
router.post('/user-settings', backupController_1.updateUserBackupSettings);
exports.default = router;
