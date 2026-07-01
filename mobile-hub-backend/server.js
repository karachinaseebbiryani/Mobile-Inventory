const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mobile_hub')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// Routes
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/repairs', require('./routes/repairs'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/cash', require('./routes/cash'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/shops', require('./routes/shops'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));