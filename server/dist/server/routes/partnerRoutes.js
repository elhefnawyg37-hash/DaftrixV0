"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const partnerController_1 = require("../controllers/partnerController");
const router = (0, express_1.Router)();
router.get('/', partnerController_1.getPartners);
router.get('/:id', partnerController_1.getPartnerById); // Get single partner with real-time balance
router.get('/:id/balance', partnerController_1.getPartnerById); // Alias for getting balance (returns same data)
router.post('/', partnerController_1.createPartner);
router.put('/:id', partnerController_1.updatePartner);
router.delete('/:id', partnerController_1.deletePartner);
exports.default = router;
