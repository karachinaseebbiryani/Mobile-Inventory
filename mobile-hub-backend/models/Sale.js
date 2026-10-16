const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
    items: { type: Array, required: true },
    totalAmount: { type: Number, required: true },
    customerName: { type: String, default: 'Walk-in Customer' },
    customerPhone: { type: String, default: '' },
    paymentMethod: { type: String, enum: ['cash', 'card', 'bank-transfer'], default: 'cash' },
    discount: { type: Number, default: 0 },
    type: { type: String, enum: ['sale', 'buy'], default: 'sale' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sale', SaleSchema);