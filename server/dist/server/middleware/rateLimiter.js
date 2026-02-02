"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.heavyQueryLimiter = exports.uploadLimiter = exports.reportLimiter = exports.createLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// General API rate limiter
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // Limit each IP to 5000 requests per windowMs
    message: {
        error: 'تم تجاوز عدد الطلبات المسموح بها. يرجى المحاولة لاحقاً.',
        message_en: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
// Stricter limiter for authentication endpoints
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: {
        error: 'تم تجاوز عدد محاولات تسجيل الدخول. يرجى المحاولة لاحقاً.',
        message_en: 'Too many login attempts, please try again after 15 minutes.',
        retryAfter: '15 minutes'
    },
    skipSuccessfulRequests: true, // Don't count successful requests
});
// Create/Update operations limiter (more restrictive)
exports.createLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // Limit each IP to 20 create/update requests per minute
    message: {
        error: 'تم تجاوز عدد عمليات  الإنشاء/التحديث. يرجى الانتظار قليلاً.',
        message_en: 'Too many create/update operations, please slow down.',
        retryAfter: '1 minute'
    },
});
// Report generation limiter (resource-intensive operations)
exports.reportLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 report generations per minute
    message: {
        error: 'تم تجاوز عدد طلبات التقارير. يرجى الانتظار قليلاً.',
        message_en: 'Too many report requests, please wait a moment.',
        retryAfter: '1 minute'
    },
});
// File upload limiter
exports.uploadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 uploads per minute
    message: {
        error: 'تم تجاوز عدد عمليات الرفع. يرجى الانتظار قليلاً.',
        message_en: 'Too many upload requests, please wait.',
        retryAfter: '1 minute'
    },
});
// Database operations limiter (heavy queries)
exports.heavyQueryLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 15, // Limit to 15 heavy queries per minute
    message: {
        error: 'تم تجاوز عدد الاستعلامات الكبيرة. يرجى الانتظار قليلاً.',
        message_en: 'Too many database queries, please slow down.',
        retryAfter: '1 minute'
    },
});
