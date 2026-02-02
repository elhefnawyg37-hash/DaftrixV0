"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stockPermitController_1 = require("../controllers/stockPermitController");
const router = (0, express_1.Router)();
// Middleware to check if user is admin for edit/delete operations
const requireAdminForEditDelete = (req, res, next) => {
    var _a, _b, _c, _d, _e, _f;
    const authReq = req;
    const user = authReq.user;
    if (!user) {
        return res.status(401).json({ error: 'غير مصرح' });
    }
    // Allow admins
    if (user.role === 'ADMIN' || user.role === 'admin') {
        return next();
    }
    // Check for specific permission
    const method = req.method;
    const permitType = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.type) || ((_b = req.query) === null || _b === void 0 ? void 0 : _b.type);
    if (method === 'PUT') {
        const permission = permitType === 'STOCK_PERMIT_OUT'
            ? 'inventory.release.edit'
            : 'inventory.receipt.edit';
        if (((_c = user.permissions) === null || _c === void 0 ? void 0 : _c.includes(permission)) || ((_d = user.permissions) === null || _d === void 0 ? void 0 : _d.includes('all'))) {
            return next();
        }
        return res.status(403).json({ error: 'ليس لديك صلاحية تعديل هذا الإذن. هذه العملية متاحة للمدير فقط.' });
    }
    if (method === 'DELETE') {
        const permission = permitType === 'STOCK_PERMIT_OUT'
            ? 'inventory.release.delete'
            : 'inventory.receipt.delete';
        if (((_e = user.permissions) === null || _e === void 0 ? void 0 : _e.includes(permission)) || ((_f = user.permissions) === null || _f === void 0 ? void 0 : _f.includes('all'))) {
            return next();
        }
        return res.status(403).json({ error: 'ليس لديك صلاحية حذف هذا الإذن. هذه العملية متاحة للمدير فقط.' });
    }
    return res.status(403).json({ error: 'هذه العملية متاحة للمدير فقط' });
};
// Routes
router.get('/', stockPermitController_1.getStockPermits);
router.get('/:id', stockPermitController_1.getStockPermitById);
// Create - requires specific permission based on permit type
router.post('/', (req, res, next) => {
    var _a, _b, _c;
    const authReq = req;
    const user = authReq.user;
    const permitType = (_a = req.body) === null || _a === void 0 ? void 0 : _a.type;
    if (!user) {
        return res.status(401).json({ error: 'غير مصرح' });
    }
    // Admins can do anything
    if (user.role === 'ADMIN' || user.role === 'admin') {
        return next();
    }
    // Check permission based on permit type
    const permission = permitType === 'STOCK_PERMIT_OUT'
        ? 'inventory.release.create'
        : 'inventory.receipt.create';
    if (((_b = user.permissions) === null || _b === void 0 ? void 0 : _b.includes(permission)) || ((_c = user.permissions) === null || _c === void 0 ? void 0 : _c.includes('all'))) {
        return next();
    }
    return res.status(403).json({ error: 'ليس لديك صلاحية إنشاء هذا النوع من الإذونات' });
}, stockPermitController_1.createStockPermit);
// Update - admin only or with specific edit permission
router.put('/:id', requireAdminForEditDelete, stockPermitController_1.updateStockPermit);
// Delete - admin only or with specific delete permission
router.delete('/:id', requireAdminForEditDelete, stockPermitController_1.deleteStockPermit);
exports.default = router;
