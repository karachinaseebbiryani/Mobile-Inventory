const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const multer = require('multer');
const xlsx = require('xlsx');
const upload = multer({ dest: 'uploads/' });

// Get all products (with Search & Filter)
router.get('/', async (req, res) => {
    try {
        const { search, type } = req.query;
        let query = {};
        if (type && type !== 'All') query.type = type;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } },
                { imei: { $regex: search, $options: 'i' } }
            ];
        }
        const products = await Product.find(query).sort({ name: 1 });
        res.json(products);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Get distinct brands and types for Auto-Suggest
router.get('/meta/distinct', async (req, res) => {
    try {
        const brands = await Product.distinct('brand');
        const types = await Product.distinct('type');
        res.json({ brands, types });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Search product by SKU (for Barcode Scanner)
router.get('/sku/:sku', async (req, res) => {
    try {
        const product = await Product.findOne({ sku: req.params.sku.toUpperCase() });
        if (!product) return res.status(404).json({ msg: 'Product not found' });
        res.json(product);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Add a new product
router.post('/', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        const product = await newProduct.save();
        res.json(product);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Bulk Import from Excel
router.post('/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        const productsToInsert = data.map(row => ({
            name: row.name || row.Name, sku: row.sku || row.SKU || row.Sku,
            category: row.category || row.Category || 'General',
            costPrice: row.costPrice || row.CostPrice || 0,
            sellingPrice: row.sellingPrice || row.SellingPrice || 0,
            stockQuantity: row.stockQuantity || row.StockQuantity || 0,
            color: row.color || row.Color || '', supplier: row.supplier || row.Supplier || 'Direct',
            imei: row.imei || row.IMEI || ''
        })).filter(p => p.name && p.sku);
        await Product.insertMany(productsToInsert);
        res.json({ msg: `Successfully imported ${productsToInsert.length} products!` });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

module.exports = router;