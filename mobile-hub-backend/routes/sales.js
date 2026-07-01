const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');

router.get('/', async (req, res) => {
    try { const sales = await Sale.find().sort({ createdAt: -1 }); res.json(sales); } 
    catch (err) { res.status(500).send('Server Error'); }
});

router.post('/', async (req, res) => {
    try { const newSale = new Sale(req.body); await newSale.save(); res.json({ msg: 'Sale saved successfully!' }); } 
    catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;