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
exports.deleteFixedAsset = exports.updateFixedAsset = exports.createFixedAsset = exports.getFixedAssets = void 0;
const db_1 = require("../db");
const uuid_1 = require("uuid");
const errorHandler_1 = require("../utils/errorHandler");
const getFixedAssets = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [assets] = yield db_1.pool.query('SELECT * FROM fixed_assets');
        res.json(assets);
    }
    catch (error) {
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
});
exports.getFixedAssets = getFixedAssets;
const createFixedAsset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const asset = req.body;
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        const id = asset.id || (0, uuid_1.v4)();
        yield connection.query(`INSERT INTO fixed_assets (id, name, purchaseDate, purchaseCost, salvageValue, lifeYears, assetAccountId, accumulatedDepreciationAccountId, expenseAccountId, status, lastDepreciationDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id, asset.name, asset.purchaseDate, asset.purchaseCost, asset.salvageValue, asset.lifeYears,
            asset.assetAccountId, asset.accumulatedDepreciationAccountId, asset.expenseAccountId,
            asset.status || 'ACTIVE', asset.lastDepreciationDate
        ]);
        yield connection.commit();
        res.status(201).json(Object.assign(Object.assign({}, asset), { id }));
    }
    catch (error) {
        yield connection.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        connection.release();
    }
});
exports.createFixedAsset = createFixedAsset;
const updateFixedAsset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const asset = req.body;
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        yield connection.query(`UPDATE fixed_assets SET 
            name=?, purchaseDate=?, purchaseCost=?, salvageValue=?, lifeYears=?, 
            assetAccountId=?, accumulatedDepreciationAccountId=?, expenseAccountId=?, 
            status=?, lastDepreciationDate=?
            WHERE id=?`, [
            asset.name, asset.purchaseDate, asset.purchaseCost, asset.salvageValue, asset.lifeYears,
            asset.assetAccountId, asset.accumulatedDepreciationAccountId, asset.expenseAccountId,
            asset.status, asset.lastDepreciationDate,
            id
        ]);
        yield connection.commit();
        res.json(asset);
    }
    catch (error) {
        yield connection.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        connection.release();
    }
});
exports.updateFixedAsset = updateFixedAsset;
const deleteFixedAsset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const connection = yield db_1.pool.getConnection();
    try {
        yield connection.beginTransaction();
        yield connection.query('DELETE FROM fixed_assets WHERE id = ?', [id]);
        yield connection.commit();
        res.json({ message: 'Asset deleted' });
    }
    catch (error) {
        yield connection.rollback();
        return (0, errorHandler_1.handleControllerError)(res, error, 'operation');
    }
    finally {
        connection.release();
    }
});
exports.deleteFixedAsset = deleteFixedAsset;
