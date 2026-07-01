const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
    shopName: { type: String, required: true },
    ownerName: { type: String, required: true },
    phone: { type: String, required: true },
    shopCode: { type: String, required: true, unique: true },
    subscriptionExpiry: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Shop', ShopSchema);