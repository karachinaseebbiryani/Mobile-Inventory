const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    shopName: { type: String, default: 'Mobile Hub' },
    logoUrl: { type: String, default: '' },
    taxRate: { type: Number, default: 0 },
    reviewQrUrl: { type: String, default: '' },
    currencySymbol: { type: String, default: '£' },
    stickerPrinterName: { type: String, default: '' },
    dashboardPin: { type: String, default: '1234' },
    departments: { type: [String], default: ['Accessories', 'Vapes', 'Prints', 'Top Up', 'Perfume', 'Toys'] },
    receiptSettings: {
        showName: { type: Boolean, default: true },
        showImei: { type: Boolean, default: true },
        showPrice: { type: Boolean, default: true },
        showVat: { type: Boolean, default: true },
        showPaymentMethod: { type: Boolean, default: true },
        showWarrantyFooter: { type: Boolean, default: true }
    },
    useUniversalTerms: { type: Boolean, default: false },
    universalTerms: { type: String, default: 'NO REFUND / NO RETURN\nPHYSICAL DAMAGE NOT COVERED' },
    mobileTerms: { type: String, default: 'NO REFUND / NO RETURN\n14 DAYS WARRANTY ON PARTS\n30 DAYS WARRANTY ON PHONES' },
    laptopTerms: { type: String, default: 'NO REFUND / NO RETURN\n30 DAYS WARRANTY ON LAPTOPS\nBATTERY NOT COVERED' },
    buyTerms: { type: String, default: 'DEVICE SOLD AS SEEN\nNO WARRANTY ON TRADE-IN DEVICES' }
});

module.exports = mongoose.model('Settings', SettingsSchema);