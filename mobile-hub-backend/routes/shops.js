const express = require('express');
const router = express.Router();
const Shop = require('../models/Shop');
const { normalizePlan, getPlanEntitlements } = require('../config/plans');

// Validate Shop Code (Login)
router.post('/validate', async (req, res) => {
    try {
        const { shopCode } = req.body;
        const shop = await Shop.findOne({ shopCode });
        if (!shop) return res.status(404).json({ msg: 'Invalid Shop Code. Please contact provider.' });
        if (!shop.isActive) return res.status(403).json({ msg: 'Account suspended. Please contact provider.' });
        if (new Date(shop.subscriptionExpiry) < new Date()) return res.status(403).json({ msg: 'Subscription Expired. Please renew to continue.' });
        const entitlements = getPlanEntitlements(shop.plan);
        res.json({ msg: 'Login successful', shop: {
            id: shop._id,
            shopName: shop.shopName,
            expiry: shop.subscriptionExpiry,
            plan: entitlements.key,
            planLabel: entitlements.label,
            modules: entitlements.modules
        } });
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
        const { shopName, ownerName, phone, subscriptionExpiry, plan } = req.body;
        const normalizedPlan = normalizePlan(plan);
        if (!normalizedPlan) return res.status(400).json({ msg: 'Invalid plan. Choose Standard, Premium, or Enterprise.' });
        const shopCode = Math.floor(100000 + Math.random() * 900000).toString();
        const newShop = new Shop({ shopName, ownerName, phone, shopCode, subscriptionExpiry, plan: normalizedPlan });
        await newShop.save();
        res.json(newShop);
    } catch (err) { res.status(500).send('Server Error'); }
});

// Change a shop's tier without recreating its subscription.
router.patch('/:id/plan', async (req, res) => {
    try {
        const normalizedPlan = normalizePlan(req.body.plan);
        if (!normalizedPlan) return res.status(400).json({ msg: 'Invalid plan. Choose Standard, Premium, or Enterprise.' });
        const shop = await Shop.findByIdAndUpdate(req.params.id, { plan: normalizedPlan }, { new: true, runValidators: true });
        if (!shop) return res.status(404).json({ msg: 'Shop not found.' });
        res.json({ shop, entitlements: getPlanEntitlements(shop.plan) });
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;
