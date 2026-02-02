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
const axios_1 = __importDefault(require("axios"));
const API_URL = 'http://localhost:5000/api';
function testSync() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Testing Sync...');
        const invoice = {
            id: 'INV-TEST-001',
            date: '2023-10-27',
            type: 'INVOICE',
            partnerId: 'PARTNER-001', // Will be updated
            partnerName: 'Test Partner',
            total: 1000,
            status: 'POSTED',
            paymentMethod: 'CASH',
            posted: true,
            lines: [
                { productId: 'PROD-001', productName: 'Test Product', quantity: 1, price: 1000, cost: 800, total: 1000 }
            ]
        };
        try {
            let partnerId = 'PARTNER-001';
            // 1. Create Partner
            try {
                const pRes = yield axios_1.default.post(`${API_URL}/partners`, {
                    id: 'PARTNER-001', // This might be ignored by backend
                    name: 'Test Partner',
                    type: 'CUSTOMER',
                    balance: 0
                });
                console.log('Partner created:', pRes.data);
                if (pRes.data && pRes.data.id) {
                    partnerId = pRes.data.id;
                }
            }
            catch (e) {
                console.log('Partner creation skipped/failed:', e.message);
                // Try to fetch if failed (maybe exists)
                try {
                    const partnersRes = yield axios_1.default.get(`${API_URL}/partners`);
                    if (partnersRes.data.length > 0) {
                        partnerId = partnersRes.data[0].id;
                        console.log('Using existing partner ID:', partnerId);
                    }
                }
                catch (err) { }
            }
            invoice.partnerId = partnerId;
            console.log('Syncing invoice with partnerId:', partnerId);
            // 2. Sync Invoice
            const res = yield axios_1.default.post(`${API_URL}/sync/transaction`, { invoice });
            if (res.status === 200) {
                console.log('Sync Success:', res.data);
            }
            else {
                console.error('Sync Failed:', res.statusText);
            }
        }
        catch (error) {
            console.error('Sync Error:', error.response ? error.response.data : error.message);
        }
    });
}
testSync();
