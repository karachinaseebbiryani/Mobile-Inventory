const mongoose = require('mongoose');

const CashTransactionSchema = new mongoose.Schema({
    type: { type: String, enum: ['float', 'paid-in', 'paid-out', 'bank-in', 'refund'], required: true },
    source: { type: String, enum: ['till', 'envelope', 'bank'], default: 'till' },
    amount: { type: Number, required: true },
    note: { type: String },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CashTransaction', CashTransactionSchema);