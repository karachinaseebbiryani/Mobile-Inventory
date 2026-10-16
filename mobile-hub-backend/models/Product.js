const mongoose = require('mongoose');

const PriceHistorySchema = new mongoose.Schema({
    costPrice: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    note: { type: String, default: '' }
});

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    brand: { type: String, default: 'Generic' },
    type: { type: String, default: 'Accessory' },
    sku: { type: String, required: true },
    network: { type: String, default: 'Unlocked' },
    internalMemory: { type: String, default: '' },
    condition: { type: String, default: 'A' },
    department: { type: String, default: 'General' },
    costPrice: { type: Number, default: 0 },
    retailPrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, required: true },
    stockQuantity: { type: Number, default: 1 },
    color: { type: String, default: '' },
    supplier: { type: String, default: 'Direct' },
    imei: { type: String, default: '' },
    isSold: { type: Boolean, default: false },
    soldDate: { type: Date, default: null },
    priceHistory: [PriceHistorySchema]
});

module.exports = mongoose.model('Product', ProductSchema);