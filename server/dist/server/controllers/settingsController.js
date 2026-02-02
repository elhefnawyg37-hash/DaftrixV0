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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLicense = exports.updateSystemConfig = exports.getSystemConfig = void 0;
const db_1 = require("../db");
const errorHandler_1 = require("../utils/errorHandler");
const getSystemConfig = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [rows] = yield db_1.pool.query('SELECT * FROM system_config LIMIT 1');
        if (rows.length > 0) {
            const row = rows[0];
            // Parse JSON config field if it exists
            let additionalConfig = {};
            if (row.config && typeof row.config === 'string') {
                try {
                    additionalConfig = JSON.parse(row.config);
                }
                catch (e) {
                    console.error("Error parsing config JSON", e);
                }
            }
            else if (row.config && typeof row.config === 'object') {
                additionalConfig = row.config;
            }
            // Merge flat columns with parsed config
            const fullConfig = Object.assign(Object.assign({}, additionalConfig), { companyName: row.companyName, companyAddress: row.companyAddress, companyPhone: row.companyPhone, companyEmail: row.companyEmail, taxId: row.taxId, commercialRegister: row.commercialRegister, currency: row.currency, vatRate: row.vatRate, 
                // Explicitly exclude the raw 'config' field to avoid confusion/duplication
                modules: Object.assign({ sales: true, purchase: true, inventory: true, accounting: true, treasury: true, banks: true, partners: true, manufacturing: true, hr: true }, additionalConfig.modules // Override with saved modules if they exist
                ) });
            res.json(fullConfig);
        }
        else {
            // No config exists yet - return default config with all modules enabled
            // This ensures the sidebar shows all menu items on first startup
            const defaultConfig = {
                companyName: '',
                companyAddress: '',
                companyPhone: '',
                companyEmail: '',
                taxId: '',
                commercialRegister: '',
                currency: 'SAR',
                vatRate: 15,
                modules: {
                    sales: true,
                    purchase: true,
                    inventory: true,
                    accounting: true,
                    treasury: true,
                    banks: true,
                    partners: true,
                    manufacturing: true,
                    hr: true
                }
            };
            res.json(defaultConfig);
        }
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getSystemConfig = getSystemConfig;
const updateSystemConfig = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = req.body;
    try {
        // 1. Extract known columns
        const { companyName, companyAddress, companyPhone, companyEmail, taxId, commercialRegister, currency, vatRate } = data, rest = __rest(data, ["companyName", "companyAddress", "companyPhone", "companyEmail", "taxId", "commercialRegister", "currency", "vatRate"]) // Everything else goes into the 'config' JSON column
        ;
        // 2. Prepare JSON config
        const jsonConfig = JSON.stringify(rest);
        // 3. Check if config exists
        const [rows] = yield db_1.pool.query('SELECT * FROM system_config LIMIT 1');
        if (rows.length > 0) {
            // Update
            yield db_1.pool.query(`UPDATE system_config SET 
                companyName=?, companyAddress=?, companyPhone=?, companyEmail=?, 
                taxId=?, commercialRegister=?, currency=?, vatRate=?, config=?`, [
                companyName, companyAddress, companyPhone, companyEmail,
                taxId, commercialRegister, currency, vatRate, jsonConfig
            ]);
        }
        else {
            // Insert
            yield db_1.pool.query(`INSERT INTO system_config (companyName, companyAddress, companyPhone, companyEmail, taxId, commercialRegister, currency, vatRate, config)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                companyName, companyAddress, companyPhone, companyEmail,
                taxId, commercialRegister, currency, vatRate, jsonConfig
            ]);
        }
        // 4. Return updated config (re-using get logic to ensure consistency)
        // We can just call the get logic or construct it manually. 
        // Manual construction is faster here since we have the data.
        const updatedConfig = Object.assign(Object.assign({}, rest), { companyName,
            companyAddress,
            companyPhone,
            companyEmail,
            taxId,
            commercialRegister,
            currency,
            vatRate });
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'settings', updatedBy: 'System' });
        }
        res.json(updatedConfig);
    }
    catch (error) {
        console.error("Error updating config:", error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.updateSystemConfig = updateSystemConfig;
/**
 * Validate and activate a license key
 */
const validateLicense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { licenseKey } = req.body;
    if (!licenseKey) {
        return res.status(400).json({ error: 'License key is required' });
    }
    try {
        const { validateLicenseKey } = yield Promise.resolve().then(() => __importStar(require('../utils/licenseValidator')));
        const result = validateLicenseKey(licenseKey);
        if (!result.valid) {
            return res.status(400).json({ valid: false, error: result.error || 'Invalid license key' });
        }
        if (result.expired) {
            return res.status(400).json({ valid: false, expired: true, error: 'License expired', expiry: result.expiry });
        }
        // Update system config with license info
        const [rows] = yield db_1.pool.query('SELECT * FROM system_config LIMIT 1');
        if (rows.length > 0) {
            const row = rows[0];
            let additionalConfig = {};
            if (row.config && typeof row.config === 'string') {
                try {
                    additionalConfig = JSON.parse(row.config);
                }
                catch (e) { }
            }
            else if (row.config && typeof row.config === 'object') {
                additionalConfig = row.config;
            }
            additionalConfig.licenseKey = licenseKey;
            additionalConfig.licenseExpiryDate = result.expiry;
            additionalConfig.licenseClient = result.client;
            if (result.modules)
                additionalConfig.modules = Object.assign(Object.assign({}, additionalConfig.modules), result.modules);
            yield db_1.pool.query('UPDATE system_config SET config=?', [JSON.stringify(additionalConfig)]);
            const io = req.app.get('io');
            if (io)
                io.emit('entity:changed', { entityType: 'settings', updatedBy: 'License' });
        }
        res.json({ valid: true, client: result.client, expiry: result.expiry, daysRemaining: result.daysRemaining, modules: result.modules, message: 'License activated' });
    }
    catch (error) {
        console.error("Error validating license:", error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.validateLicense = validateLicense;
