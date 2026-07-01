const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now }
});

const VendorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    contact: { type: String },
    bills: [BillSchema]
});

module.exports = mongoose.model('Vendor', VendorSchema);