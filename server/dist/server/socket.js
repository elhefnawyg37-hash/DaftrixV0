"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeWebSocket = initializeWebSocket;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Track active users and what they're viewing/editing
const activeUsers = new Map();
const editLocks = new Map();
function initializeWebSocket(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: [
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'http://myst:3000',
                // Allow all origins (can be restricted based on your needs)
                '*'
            ],
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });
    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }
        try {
            const secret = process.env.JWT_SECRET || 'daftrix-erp-super-secret-jwt-key-2025-change-in-production';
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            socket.user = decoded;
            next();
        }
        catch (err) {
            next(new Error('Authentication error'));
        }
    });
    io.on('connection', (socket) => {
        if (!socket.user) {
            console.error('❌ Socket connected without user data. Disconnecting.');
            socket.disconnect();
            return;
        }
        const user = socket.user;
        console.log(`✅ User connected: ${user.name} (${socket.id})`);
        // Track active user
        activeUsers.set(socket.id, {
            socketId: socket.id,
            userId: user.id,
            userName: user.name,
        });
        // Broadcast updated user list
        io.emit('users:online', Array.from(activeUsers.values()));
        // ===== USER PRESENCE =====
        socket.on('user:viewing', (data) => {
            const userInfo = activeUsers.get(socket.id);
            if (userInfo) {
                userInfo.currentView = data.view;
                activeUsers.set(socket.id, userInfo);
                io.emit('users:online', Array.from(activeUsers.values()));
            }
        });
        // ===== EDIT LOCKS =====
        socket.on('lock:request', (data, callback) => {
            const lockKey = `${data.type}:${data.id}`;
            const existingLock = editLocks.get(lockKey);
            if (existingLock && existingLock.userId !== user.id) {
                // Already locked by someone else
                callback({
                    success: false,
                    lockedBy: existingLock.userName
                });
            }
            else {
                // Grant lock
                editLocks.set(lockKey, {
                    userId: user.id,
                    userName: user.name,
                    timestamp: Date.now()
                });
                const userInfo = activeUsers.get(socket.id);
                if (userInfo) {
                    userInfo.editingResource = { type: data.type, id: data.id };
                    activeUsers.set(socket.id, userInfo);
                }
                // Notify others
                socket.broadcast.emit('lock:acquired', {
                    type: data.type,
                    id: data.id,
                    userId: user.id,
                    userName: user.name
                });
                callback({ success: true });
            }
        });
        socket.on('lock:release', (data) => {
            const lockKey = `${data.type}:${data.id}`;
            editLocks.delete(lockKey);
            const userInfo = activeUsers.get(socket.id);
            if (userInfo) {
                userInfo.editingResource = undefined;
                activeUsers.set(socket.id, userInfo);
            }
            socket.broadcast.emit('lock:released', {
                type: data.type,
                id: data.id
            });
        });
        // ===== REAL-TIME DATA UPDATES =====
        socket.on('invoice:created', (invoice) => {
            // Broadcast to other clients only (not the sender)
            socket.broadcast.emit('invoice:new', {
                invoice,
                createdBy: user.name
            });
        });
        socket.on('invoice:updated', (invoice) => {
            // Broadcast to other clients only (not the sender)
            socket.broadcast.emit('invoice:changed', {
                invoice,
                updatedBy: user.name
            });
        });
        socket.on('invoice:deleted', (invoiceId) => {
            // Broadcast to other clients only (not the sender)
            socket.broadcast.emit('invoice:removed', {
                id: invoiceId,
                deletedBy: user.name
            });
        });
        socket.on('product:updated', (product) => {
            socket.broadcast.emit('product:changed', {
                product,
                updatedBy: user.name
            });
        });
        socket.on('stock:changed', (data) => {
            socket.broadcast.emit('stock:updated', {
                productId: data.productId,
                newStock: data.newStock,
                changedBy: user.name
            });
        });
        socket.on('partner:updated', (partner) => {
            socket.broadcast.emit('partner:changed', {
                partner,
                updatedBy: user.name
            });
        });
        // ===== GENERIC ENTITY UPDATES =====
        socket.on('entity:changed', (data) => {
            socket.broadcast.emit('entity:changed', {
                entityType: data.entityType,
                entity: data.entity,
                updatedBy: user.name
            });
        });
        socket.on('entity:deleted', (data) => {
            socket.broadcast.emit('entity:deleted', {
                entityType: data.entityType,
                entityId: data.entityId,
                deletedBy: user.name
            });
        });
        // ===== REAL-TIME CHAT =====
        socket.on('chat:send', (message) => {
            // Broadcast the message to all users including the sender for consistency
            io.emit('chat:message', Object.assign(Object.assign({}, message), { userId: user.id, userName: user.name, timestamp: new Date().toISOString() }));
        });
        // ===== PRIVATE CHAT =====
        socket.on('chat:private', (data) => {
            // Find the target user's socket
            const targetUser = Array.from(activeUsers.values())
                .find(u => u.userId === data.targetUserId);
            const privateMessage = {
                id: data.id,
                userId: user.id,
                userName: user.name,
                message: data.message,
                timestamp: new Date().toISOString(),
                type: 'private',
                targetUserId: data.targetUserId
            };
            // Send to target user
            if (targetUser) {
                io.to(targetUser.socketId).emit('chat:private', privateMessage);
            }
            // Also send back to sender for confirmation
            socket.emit('chat:private', privateMessage);
        });
        // Typing indicator for private chat
        socket.on('chat:typing', (data) => {
            const targetUser = Array.from(activeUsers.values())
                .find(u => u.userId === data.targetUserId);
            if (targetUser) {
                io.to(targetUser.socketId).emit('chat:typing', {
                    userId: user.id,
                    userName: user.name,
                    isTyping: data.isTyping
                });
            }
        });
        // When a user joins, notify others
        io.emit('chat:system', {
            message: `${user.name} انضم للمحادثة`,
            type: 'join'
        });
        // ===== NOTIFICATIONS =====
        socket.on('notification:send', (data) => {
            const notification = {
                message: data.message,
                type: data.type,
                from: user.name,
                timestamp: new Date().toISOString()
            };
            if (data.targetUserId) {
                // Send to specific user
                const targetUser = Array.from(activeUsers.values())
                    .find(u => u.userId === data.targetUserId);
                if (targetUser) {
                    io.to(targetUser.socketId).emit('notification:receive', notification);
                }
            }
            else {
                // Broadcast to all
                socket.broadcast.emit('notification:receive', notification);
            }
        });
        // ===== DISCONNECT =====
        socket.on('disconnect', () => {
            console.log(`❌ User disconnected: ${user.name}`);
            // Release all locks held by this user
            for (const [lockKey, lock] of editLocks.entries()) {
                if (lock.userId === user.id) {
                    editLocks.delete(lockKey);
                    const [type, id] = lockKey.split(':');
                    socket.broadcast.emit('lock:released', { type, id });
                }
            }
            // Remove from active users
            activeUsers.delete(socket.id);
            // Notify others about user leaving chat
            io.emit('chat:system', {
                message: `${user.name} غادر المحادثة`,
                type: 'leave'
            });
            // Notify others
            io.emit('users:online', Array.from(activeUsers.values()));
        });
    });
    // Cleanup old locks every 5 minutes
    setInterval(() => {
        const now = Date.now();
        const timeout = 30 * 60 * 1000; // 30 minutes
        for (const [lockKey, lock] of editLocks.entries()) {
            if (now - lock.timestamp > timeout) {
                editLocks.delete(lockKey);
                console.log(`⚠️ Auto-released stale lock: ${lockKey}`);
            }
        }
    }, 5 * 60 * 1000);
    return io;
}
