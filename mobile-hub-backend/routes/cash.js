const express = require('express');
const router = express.Router();
const CashTransaction = require('../models/CashTransaction');

router.get('/', async (req, res) => {
    try { const transactions = await CashTransaction.find().sort({ date: -1 }); res.json(transactions); } 
    catch (err) { res.status(500).send('Server Error'); }
});

router.post('/', async (req, res) => {
    try { const newTrans = new CashTransaction(req.body); const trans = await newTrans.save(); res.json(trans); } 
    catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;