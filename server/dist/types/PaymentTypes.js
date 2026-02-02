"use strict";
// PaymentTypes.ts - Comprehensive Payment Data Structures
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChequeStatusV2 = exports.PaymentMethodV2 = void 0;
var PaymentMethodV2;
(function (PaymentMethodV2) {
    PaymentMethodV2["CASH"] = "CASH";
    PaymentMethodV2["BANK"] = "BANK";
    PaymentMethodV2["CHEQUE"] = "CHEQUE";
    PaymentMethodV2["CREDIT"] = "CREDIT";
    PaymentMethodV2["INSTALLMENT"] = "INSTALLMENT";
    PaymentMethodV2["MIXED"] = "MIXED"; // مختلط (كاش + بنك + ...)
})(PaymentMethodV2 || (exports.PaymentMethodV2 = PaymentMethodV2 = {}));
var ChequeStatusV2;
(function (ChequeStatusV2) {
    ChequeStatusV2["PENDING"] = "PENDING";
    ChequeStatusV2["CLEARED"] = "CLEARED";
    ChequeStatusV2["BOUNCED"] = "BOUNCED";
    ChequeStatusV2["RECEIVED"] = "RECEIVED"; // تم الاستلام
})(ChequeStatusV2 || (exports.ChequeStatusV2 = ChequeStatusV2 = {}));
