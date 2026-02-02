"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auditController_1 = require("../controllers/auditController");
const router = (0, express_1.Router)();
router.get('/', auditController_1.getAuditLogs);
exports.default = router;
