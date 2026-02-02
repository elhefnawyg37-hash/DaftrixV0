"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settingsController_1 = require("../controllers/settingsController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Authentication required for all routes
router.use(authMiddleware_1.authenticateToken);
// GET - Allow ALL authenticated users to read settings (company name, logo, etc.)
// This is needed for printing, invoice headers, and general UI display
router.get('/', settingsController_1.getSystemConfig);
// PUT - Require 'system.settings' permission to UPDATE settings
router.put('/', (0, authMiddleware_1.requirePermission)('system.settings'), settingsController_1.updateSystemConfig);
// POST - Validate and activate a license key
router.post('/validate-license', settingsController_1.validateLicense);
exports.default = router;
