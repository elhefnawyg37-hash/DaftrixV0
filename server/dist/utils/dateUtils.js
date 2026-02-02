"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatEgyptianDate = exports.isDateInRange = exports.getEgyptianISOString = exports.getTodayDateString = exports.toLocalDateString = exports.getEgyptianDate = void 0;
/**
 * Egyptian timezone constant (UTC+2 / EET)
 */
const EGYPT_TIMEZONE = 'Africa/Cairo';
const EGYPT_UTC_OFFSET = 2; // UTC+2 hours
/**
 * Gets current date/time in Egyptian timezone
 */
const getEgyptianDate = (date) => {
    const d = date ? new Date(date) : new Date();
    // Convert to Egyptian time by using Intl API
    const egyptianTimeStr = d.toLocaleString('en-US', { timeZone: EGYPT_TIMEZONE });
    return new Date(egyptianTimeStr);
};
exports.getEgyptianDate = getEgyptianDate;
/**
 * Converts any date to Egyptian timezone and returns YYYY-MM-DD string
 */
const toLocalDateString = (dateStr) => {
    if (!dateStr)
        return '';
    const egyptDate = (0, exports.getEgyptianDate)(dateStr);
    const year = egyptDate.getFullYear();
    const month = String(egyptDate.getMonth() + 1).padStart(2, '0');
    const day = String(egyptDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
exports.toLocalDateString = toLocalDateString;
/**
 * Returns current Egyptian date as YYYY-MM-DD string
 */
const getTodayDateString = () => {
    return (0, exports.toLocalDateString)(new Date());
};
exports.getTodayDateString = getTodayDateString;
/**
 * Returns current Egyptian date and time as ISO string (for database storage)
 * This ensures dates are stored with Egyptian timezone context
 */
const getEgyptianISOString = () => {
    const now = new Date();
    // Get the date in Egyptian timezone
    const egyptDate = (0, exports.getEgyptianDate)(now);
    // Format as YYYY-MM-DD HH:mm:ss for database
    const year = egyptDate.getFullYear();
    const month = String(egyptDate.getMonth() + 1).padStart(2, '0');
    const day = String(egyptDate.getDate()).padStart(2, '0');
    const hours = String(egyptDate.getHours()).padStart(2, '0');
    const minutes = String(egyptDate.getMinutes()).padStart(2, '0');
    const seconds = String(egyptDate.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};
exports.getEgyptianISOString = getEgyptianISOString;
/**
 * Checks if a date falls within a range (YYYY-MM-DD strings, inclusive)
 * All dates are interpreted in Egyptian timezone
 */
const isDateInRange = (dateStr, startDate, endDate) => {
    const localDate = (0, exports.toLocalDateString)(dateStr);
    return localDate >= startDate && localDate <= endDate;
};
exports.isDateInRange = isDateInRange;
/**
 * Formats a date for display in Egyptian timezone
 */
const formatEgyptianDate = (date, includeTime = false) => {
    const egyptDate = (0, exports.getEgyptianDate)(date);
    if (includeTime) {
        return egyptDate.toLocaleString('ar-EG', { timeZone: EGYPT_TIMEZONE });
    }
    return egyptDate.toLocaleDateString('ar-EG', { timeZone: EGYPT_TIMEZONE });
};
exports.formatEgyptianDate = formatEgyptianDate;
