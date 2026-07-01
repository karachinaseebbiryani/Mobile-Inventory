const express = require('express');
const router = express.Router();
const Repair = require('../models/Repair');

router.get('/', async (req, res) => {
    try { const repairs = await Repair.find().sort({ createdAt: -1 }); res.json(repairs); } 
    catch (err) { res.status(500).send('Server Error'); }
});

router.post('/', async (req, res) => {
    try { const newRepair = new Repair(req.body); const repair = await newRepair.save(); res.json(repair); } 
    catch (err) { res.status(500).send('Server Error'); }
});

// Collect repair and update cost/status
router.put('/:id/collect', async (req, res) => {
    try {
        const repair = await Repair.findById(req.params.id);
        if (!repair) return res.status(404).json({ msg: 'Repair not found' });
        repair.status = 'Delivered';
        repair.repairCost = req.body.repairCost;
        repair.deliveredAt = new Date();
        await repair.save();
        res.json(repair);
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;