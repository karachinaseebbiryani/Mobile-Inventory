const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');

router.get('/phone/:phone', async (req, res) => {
    try { const customer = await Customer.findOne({ phone: req.params.phone }); res.json(customer); } 
    catch (err) { res.status(500).send('Server Error'); }
});

router.post('/', async (req, res) => {
    try { const newCustomer = new Customer(req.body); await newCustomer.save(); res.json(newCustomer); } 
    catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;