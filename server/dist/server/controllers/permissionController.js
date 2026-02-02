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
exports.deletePermission = exports.updatePermission = exports.createPermission = exports.getPermissions = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const errorHandler_1 = require("../utils/errorHandler");
const getPermissions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [rows] = yield db_1.pool.query('SELECT * FROM permissions');
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching permissions:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'fetching permissions');
    }
});
exports.getPermissions = getPermissions;
const createPermission = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, label, module } = req.body;
    try {
        // ID is often manually provided for permissions (e.g. 'sales.view'), but if not, generate one
        const permId = id || (0, uuid_1.v4)();
        yield db_1.pool.query('INSERT INTO permissions (id, label, module) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE label = VALUES(label), module = VALUES(module)', [permId, label, module]);
        const [rows] = yield db_1.pool.query('SELECT * FROM permissions WHERE id = ?', [permId]);
        res.status(201).json(rows[0]);
    }
    catch (error) {
        console.error('Error creating permission:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'creating permission');
    }
});
exports.createPermission = createPermission;
const updatePermission = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { label, module } = req.body;
    try {
        yield db_1.pool.query('UPDATE permissions SET label = ?, module = ? WHERE id = ?', [label, module, id]);
        const [rows] = yield db_1.pool.query('SELECT * FROM permissions WHERE id = ?', [id]);
        res.json(rows[0]);
    }
    catch (error) {
        console.error('Error updating permission:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'updating permission');
    }
});
exports.updatePermission = updatePermission;
const deletePermission = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield db_1.pool.query('DELETE FROM permissions WHERE id = ?', [id]);
        res.json({ message: 'Permission deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting permission:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'deleting permission');
    }
});
exports.deletePermission = deletePermission;
