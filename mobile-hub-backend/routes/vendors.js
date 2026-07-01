const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');

router.get('/', async (req, res) => {
    try { const vendors = await Vendor.find(); res.json(vendors); } 
    catch (err) { res.status(500).send('Server Error'); }
});

router.post('/', async (req, res) => {
    try { const newVendor = new Vendor(req.body); const vendor = await newVendor.save(); res.json(vendor); } 
    catch (err) { res.status(500).send('Server Error'); }
});

router.post('/:id/bills', async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id);
        if (!vendor) return res.status(404).json({ msg: 'Vendor not found' });
        vendor.bills.push(req.body);
        await vendor.save();
        res.json(vendor);
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;