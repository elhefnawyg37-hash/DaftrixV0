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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updatePreferences = exports.updateUser = exports.createUser = exports.getUsers = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const auditController_1 = require("./auditController");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const errorHandler_1 = require("../utils/errorHandler");
const getUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Filter out hidden users (like master admin) from the list
        const [rows] = yield db_1.pool.query('SELECT * FROM users WHERE isHidden = FALSE OR isHidden IS NULL');
        const users = rows.map(row => (Object.assign(Object.assign({}, row), { permissions: row.permissions ? JSON.parse(row.permissions) : [], preferences: row.preferences ? (typeof row.preferences === 'string' ? JSON.parse(row.preferences) : row.preferences) : {} })));
        res.json(users);
    }
    catch (error) {
        console.error('Error in getUsers:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getUsers = getUsers;
const createUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        const user = req.body;
        const id = user.id || (0, uuid_1.v4)();
        const permissions = JSON.stringify(user.permissions || []);
        const preferences = JSON.stringify(user.preferences || {});
        // Hash password if provided
        let hashedPassword = user.password;
        if (user.password) {
            const salt = yield bcryptjs_1.default.genSalt(10);
            hashedPassword = yield bcryptjs_1.default.hash(user.password, salt);
        }
        yield connection.query('INSERT INTO users (id, name, email, username, password, role, status, permissions, lastLogin, avatar, salesmanId, preferences) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, user.name, user.email, user.username, hashedPassword, user.role, user.status, permissions, user.lastLogin ? new Date(user.lastLogin) : null, user.avatar, user.salesmanId || null, preferences]);
        yield connection.commit();
        // Log audit trail
        const creator = req.body.creator || 'System';
        yield (0, auditController_1.logAction)(creator, 'USER', 'CREATE', `Created User: ${user.name}`, `Role: ${user.role}, Email: ${user.email}`);
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'users', updatedBy: creator });
        }
        res.status(201).json(Object.assign(Object.assign({}, user), { id }));
    }
    catch (error) {
        yield connection.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        connection.release();
    }
});
exports.createUser = createUser;
const updateUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        const { id } = req.params;
        const user = req.body;
        const permissions = JSON.stringify(user.permissions || []);
        // Hash password if it's being updated and not already hashed
        let hashedPassword = user.password;
        if (user.password && !user.password.startsWith('$2')) {
            const salt = yield bcryptjs_1.default.genSalt(10);
            hashedPassword = yield bcryptjs_1.default.hash(user.password, salt);
        }
        let updateSql = 'UPDATE users SET name=?, email=?, username=?, password=?, role=?, status=?, permissions=?, lastLogin=?, avatar=?, salesmanId=?';
        let params = [user.name, user.email, user.username, hashedPassword, user.role, user.status, permissions, user.lastLogin ? new Date(user.lastLogin) : null, user.avatar, user.salesmanId || null];
        // Only update preferences if present in body
        if (user.preferences !== undefined) {
            const preferences = JSON.stringify(user.preferences);
            updateSql += ', preferences=?';
            params.push(preferences);
        }
        updateSql += ' WHERE id=?';
        params.push(id);
        yield connection.query(updateSql, params);
        yield connection.commit();
        // Log audit trail
        const updater = req.body.updater || 'System';
        yield (0, auditController_1.logAction)(updater, 'USER', 'UPDATE', `Updated User: ${user.name}`, `Role: ${user.role}`);
        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:changed', { entityType: 'users', updatedBy: updater });
        }
        res.json(Object.assign(Object.assign({}, user), { id }));
    }
    catch (error) {
        yield connection.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        connection.release();
    }
});
exports.updateUser = updateUser;
const updatePreferences = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield db_1.pool.getConnection();
    try {
        const { id } = req.params;
        const { preferences } = req.body; // Expect partial or full preferences object
        if (!preferences) {
            return res.status(400).json({ message: 'Preferences required' });
        }
        // We can merge with existing preferences or overwrite. 
        // Let's merge for safer updates (e.g. only updating invoices settings, keeping others).
        // First get existing
        const [rows] = yield connection.query('SELECT preferences FROM users WHERE id=?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        let currentPrefs = rows[0].preferences ? (typeof rows[0].preferences === 'string' ? JSON.parse(rows[0].preferences) : rows[0].preferences) : {};
        const newPrefs = Object.assign(Object.assign({}, currentPrefs), preferences);
        yield connection.query('UPDATE users SET preferences=? WHERE id=?', [JSON.stringify(newPrefs), id]);
        res.json({ message: 'Preferences updated', preferences: newPrefs });
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        connection.release();
    }
});
exports.updatePreferences = updatePreferences;
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        const { id } = req.params;
        // Get user name before deletion
        const [users] = yield connection.query('SELECT name FROM users WHERE id=?', [id]);
        const userName = ((_a = users[0]) === null || _a === void 0 ? void 0 : _a.name) || id;
        yield connection.query('DELETE FROM users WHERE id=?', [id]);
        yield connection.commit();
        // Log audit trail
        const deleter = ((_b = req.body) === null || _b === void 0 ? void 0 : _b.deleter) || 'System';
        yield (0, auditController_1.logAction)(deleter, 'USER', 'DELETE', `Deleted User: ${userName}`, `ID: ${id}`);
        // Broadcast real-time deletion
        const io = req.app.get('io');
        if (io) {
            io.emit('entity:deleted', { entityType: 'users', entityId: id, deletedBy: deleter });
        }
        res.json({ message: 'User deleted' });
    }
    catch (error) {
        yield connection.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        connection.release();
    }
});
exports.deleteUser = deleteUser;
