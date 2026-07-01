const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

router.get('/', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) { settings = new Settings(); await settings.save(); }
        res.json(settings);
    } catch (err) { res.status(500).send('Server Error'); }
});

router.put('/', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) { settings = new Settings(req.body); await settings.save(); } 
        else { settings = await Settings.findOneAndUpdate({}, req.body, { new: true }); }
        res.json(settings);
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;