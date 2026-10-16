import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Buy = () => {
  const [settings, setSettings] = useState({ buyTerms: '', shopName: '', logoUrl: '', currencySymbol: '£' });
  const [formData, setFormData] = useState({ customerName: '', customerPhone: '', make: '', deviceModel: '', imei: '', internalMemory: '', condition: '', price: 0 });
  const [paymentSource, setPaymentSource] = useState('till');

  useEffect(() => { axios.get('http://localhost:5000/api/admin').then(res => setSettings(res.data)); }, []);

  const handleChange = (e) => {
    if (e.target.name === 'price') setFormData({ ...formData, price: parseFloat(e.target.value) || 0 });
    else setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openPrintPreview = (htmlContent) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(htmlContent); printWindow.document.close(); printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let customerRes = await axios.get(`http://localhost:5000/api/customers/phone/${formData.customerPhone}`);
      if (!customerRes.data) customerRes = await axios.post('http://localhost:5000/api/customers', { name: formData.customerName, phone: formData.customerPhone });

      await axios.post('http://localhost:5000/api/sales', {
        items: [{ name: `${formData.make} ${formData.deviceModel}`, imei: formData.imei, sellingPrice: formData.price, quantity: 1 }],
        totalAmount: formData.price, customerName: formData.customerName, customerPhone: formData.customerPhone, paymentMethod: 'cash', type: 'buy'
      });

      await axios.post('http://localhost:5000/api/cash', { type: 'paid-out', source: paymentSource, amount: formData.price, note: `Bought ${formData.make} ${formData.deviceModel}` });

      await axios.post('http://localhost:5000/api/products', {
        name: `${formData.make} ${formData.deviceModel}`, brand: formData.make, type: 'Phone', 
        sku: formData.imei || `BUY-${Date.now()}`, imei: formData.imei, internalMemory: formData.internalMemory, condition: formData.condition,
        costPrice: formData.price, sellingPrice: 0, stockQuantity: 1, supplier: `Trade-in: ${formData.customerName}`
      });

      let receiptHTML = `<html><head><style>body { font-family: 'Courier New', monospace; width: 280px; margin: 0; padding: 10px; }h1 { text-align: center; font-size: 18px; margin: 0; }h2 { text-align: center; font-size: 14px; margin: 5px 0; }.row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }.total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-top: 1px solid #000; padding: 5px 0; margin-top: 10px; }</style></head><body><h1>${settings.shopName}</h1><h2>BUY / TRADE-IN RECEIPT</h2><div class="row"><span>Date:</span><span>${new Date().toLocaleString()}</span></div><hr style="border-top: 1px dashed #ccc; margin: 10px 0;"><div class="row"><span>Customer:</span><span>${formData.customerName}</span></div><div class="row"><span>Device:</span><span><b>${formData.make} ${formData.deviceModel}</b></span></div><div class="row"><span>IMEI:</span><span>${formData.imei || 'N/A'}</span></div><div class="total"><span>WE PAID CUSTOMER</span><span>${settings.currencySymbol}${formData.price.toFixed(2)}</span></div></body></html>`;
      
      openPrintPreview(receiptHTML);
      setFormData({ customerName: '', customerPhone: '', make: '', deviceModel: '', imei: '', internalMemory: '', condition: '', price: 0 });
    } catch (err) { console.error("Error processing buy"); }
  };

  return (
    <div className="flex h-full gap-6">
      <div className="w-1/3 card overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Buy Device From Customer</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Customer Name</label><input type="text" name="customerName" value={formData.customerName} onChange={handleChange} required className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label><input type="text" name="customerPhone" value={formData.customerPhone} onChange={handleChange} required className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Make</label><input type="text" name="make" value={formData.make} onChange={handleChange} placeholder="e.g., APPLE" required className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Model</label><input type="text" name="deviceModel" value={formData.deviceModel} onChange={handleChange} placeholder="e.g., IPHONE 13" required className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">IMEI / S/N</label><input type="text" name="imei" value={formData.imei} onChange={handleChange} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Memory</label><input type="text" name="internalMemory" value={formData.internalMemory} onChange={handleChange} className="input-field" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Condition / Grade</label><input type="text" name="condition" value={formData.condition} onChange={handleChange} placeholder="e.g., A, B, Cracked Screen" required className="input-field" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Price We Pay (£)</label><input type="number" step="0.01" name="price" value={formData.price} onChange={handleChange} required className="input-field" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Pay customer From</label>
            <select value={paymentSource} onChange={(e) => setPaymentSource(e.target.value)} className="input-field">
              <option value="till">Till Cash (Daily Sale/Float)</option><option value="envelope">Envelope Cash</option>
            </select>
          </div>
          <button type="submit" className="btn-primary bg-blue-500 hover:bg-blue-600">Complete Buy & Print</button>
        </form>
      </div>
      <div className="flex-1 card flex items-center justify-center">
        <div className="text-center text-gray-400">
          <span className="text-5xl">💸</span>
          <p className="mt-3 text-lg">Enter device details on the left to buy from a customer.</p>
          <p className="text-xs mt-2">This will automatically deduct the cash from your till, add the device to your inventory, and save the customer's details.</p>
        </div>
      </div>
    </div>
  );
};

export default Buy;