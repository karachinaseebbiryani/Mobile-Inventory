const mongoose = require('mongoose');

const RepairSchema = new mongoose.Schema({
    ticketId: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    make: { type: String, default: '' },
    deviceModel: { type: String, required: true },
    imei: { type: String, default: '' },
    internalMemory: { type: String, default: 'STANDARD' },
    issue: { type: String, required: true },
    repairCost: { type: Number, default: 0 },
    status: { type: String, default: 'Received' },
    deliveredAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Repair', RepairSchema);