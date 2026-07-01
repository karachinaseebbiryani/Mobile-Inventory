const express = require('express');
const router = express.Router();
const Shop = require('../models/Shop');

// Validate Shop Code (Login)
router.post('/validate', async (req, res) => {
    try {
        const { shopCode } = req.body;
        const shop = await Shop.findOne({ shopCode });
        if (!shop) return res.status(404).json({ msg: 'Invalid Shop Code. Please contact provider.' });
        if (!shop.isActive) return res.status(403).json({ msg: 'Account suspended. Please contact provider.' });
        if (new Date(shop.subscriptionExpiry) < new Date()) return res.status(403).json({ msg: 'Subscription Expired. Please renew to continue.' });
        res.json({ msg: 'Login successful', shop: { id: shop._id, shopName: shop.shopName, expiry: shop.subscriptionExpiry } });
    } catch (err) { res.status(500).send('Server Error'); }
});

// Get all shops (Super Admin)
router.get('/', async (req, res) => {
    try { const shops = await Shop.find().sort({ createdAt: -1 }); res.json(shops); } 
    catch (err) { res.status(500).send('Server Error'); }
});

// Create a new shop
router.post('/', async (req, res) => {
    try {
        const { shopName, ownerName, phone, subscriptionExpiry } = req.body;
        const shopCode = Math.floor(100000 + Math.random() * 900000).toString();
        const newShop = new Shop({ shopName, ownerName, phone, shopCode, subscriptionExpiry });
        await newShop.save();
        res.json(newShop);
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;