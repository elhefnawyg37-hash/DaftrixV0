"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET;
// CRITICAL: Fail fast if JWT_SECRET is not configured
if (!JWT_SECRET) {
    console.error('❌ FATAL ERROR: JWT_SECRET environment variable is not set!');
    console.error('Please set JWT_SECRET in your .env file before starting the application.');
    console.error('Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
}
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token)
        return res.sendStatus(401);
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, user) => {
        if (err)
            return res.sendStatus(403);
        req.user = user;
        next();
    });
};
exports.authenticateToken = authenticateToken;
const requirePermission = (permissionId) => {
    return (req, res, next) => {
        var _a;
        const user = req.user;
        if (!user)
            return res.sendStatus(401);
        // Admin bypass
        const role = (_a = user.role) === null || _a === void 0 ? void 0 : _a.toUpperCase();
        if (role === 'ADMIN' || role === 'MASTER_ADMIN')
            return next();
        // Check permission
        if (user.permissions && (user.permissions.includes(permissionId) || user.permissions.includes('all'))) {
            return next();
        }
        return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    };
};
exports.requirePermission = requirePermission;
