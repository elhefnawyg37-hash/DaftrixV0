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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = void 0;
const db_1 = require("../db");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorHandler_1 = require("../utils/errorHandler");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    // Note: Master admin is now stored in database with isHidden=true
    // No more hardcoded credentials - all users authenticate through database
    try {
        // Find user by username or email
        const [rows] = yield db_1.pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
        const user = rows[0];
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Verify password
        // Check if password is hashed (starts with $2a$ or $2b$)
        const isHashed = user.password.startsWith('$2');
        let isValid = false;
        if (isHashed) {
            isValid = yield bcryptjs_1.default.compare(password, user.password);
        }
        else {
            // Fallback for plain text passwords (migration)
            isValid = password === user.password;
        }
        if (!isValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Generate Token
        const permissions = user.permissions ? JSON.parse(user.permissions) : [];
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            permissions,
            salesmanId: user.salesmanId || null // للتصفية حسب المندوب
        }, JWT_SECRET, { expiresIn: '24h' });
        // Remove password from response
        const { password: _ } = user, userWithoutPassword = __rest(user, ["password"]);
        res.json({
            token,
            user: Object.assign(Object.assign({}, userWithoutPassword), { permissions: user.permissions ? JSON.parse(user.permissions) : [], preferences: user.preferences ? (typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences) : {} })
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return (0, errorHandler_1.handleControllerError)(res, error, 'Internal server ');
    }
});
exports.login = login;
