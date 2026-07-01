const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Model (e.g., AIR A1466)
    brand: { type: String, default: 'Generic' }, // Make/Manufacturer (e.g., MACBOOK)
    type: { type: String, default: 'Mobile' }, 
    sku: { type: String, required: true },
    network: { type: String, default: 'Unlocked' }, // NEW: Network
    internalMemory: { type: String, default: '' }, // NEW: Internal Memory (e.g., 128GB)
    condition: { type: String, default: 'A' }, // NEW: Condition/Grade (e.g., A, B, C)
    costPrice: { type: Number, default: 0 }, // Buying Price
    retailPrice: { type: Number, default: 0 }, // NEW: Retail Price (MSRP)
    sellingPrice: { type: Number, required: true }, // Sale Price
    stockQuantity: { type: Number, default: 1 },
    color: { type: String, default: '' },
    supplier: { type: String, default: 'Direct' },
    imei: { type: String, default: '' }
});

module.exports = mongoose.model('Product', ProductSchema);