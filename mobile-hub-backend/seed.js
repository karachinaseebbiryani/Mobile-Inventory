const mongoose = require('mongoose');
const Product = require('./models/Product');

// Connect to your MongoDB database (removed outdated options)
mongoose.connect('mongodb://localhost:27017/mobile_hub')
  .then(async () => {
    console.log('Connected to DB. Adding products...');

    // Clear existing products first
    await Product.deleteMany();

    // Add the dummy products
    await Product.insertMany([
        { name: 'iPhone 13 Screen', sku: 'IP13-SCR', category: 'Parts', costPrice: 45, sellingPrice: 120, stockQuantity: 10 },
        { name: 'Samsung S22 Case', sku: 'SS22-CASE', category: 'Accessories', costPrice: 5, sellingPrice: 15, stockQuantity: 50 },
        { name: 'iPhone Charger', sku: 'IP-CHRG', category: 'Accessories', costPrice: 8, sellingPrice: 20, stockQuantity: 3 } // Low stock example
    ]);

    console.log('✅ Products added successfully!');
    mongoose.disconnect();
  })
  .catch(err => console.log(err));