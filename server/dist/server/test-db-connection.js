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
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function testConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Testing DB Connection...');
        console.log('Host:', process.env.DB_HOST);
        console.log('User:', process.env.DB_USER);
        try {
            const connection = yield promise_1.default.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                insecureAuth: true,
                allowPublicKeyRetrieval: true
            });
            console.log('Connected successfully!');
            yield connection.end();
        }
        catch (error) {
            console.error('Connection failed:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Error sqlMessage:', error.sqlMessage);
        }
    });
}
testConnection();
