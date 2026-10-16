const mongoose = require('mongoose');
const { PLAN_MODULES } = require('../config/plans');

const ShopSchema = new mongoose.Schema({
    shopName: { type: String, required: true },
    ownerName: { type: String, required: true },
    phone: { type: String, required: true },
    shopCode: { type: String, required: true, unique: true },
    subscriptionExpiry: { type: Date, required: true },
    // Existing records default to enterprise during the tier rollout.
    plan: { type: String, enum: Object.keys(PLAN_MODULES), default: 'enterprise' },
    isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Shop', ShopSchema);
