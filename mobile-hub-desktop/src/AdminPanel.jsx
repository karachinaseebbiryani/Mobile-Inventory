import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AdminPanel = () => {
  const [settings, setSettings] = useState({
    shopName: '', logoUrl: '', taxRate: 0, reviewQrUrl: '', currencySymbol: '£',
    receiptSettings: { showName: true, showImei: true, showPrice: true, showVat: true, showPaymentMethod: true, showWarrantyFooter: true },
    useUniversalTerms: false, universalTerms: '', mobileTerms: '', laptopTerms: '', buyTerms: ''
  });

  useEffect(() => { axios.get('http://localhost:5000/api/admin').then(res => setSettings(res.data)); }, []);

  const handleChange = (e) => setSettings({ ...settings, [e.target.name]: e.target.value });
  const handleToggle = (e) => setSettings({ ...settings, receiptSettings: { ...settings.receiptSettings, [e.target.name]: e.target.checked } });
  const handleUniversalToggle = (e) => setSettings({ ...settings, useUniversalTerms: e.target.checked });

  const handleSave = async (e) => {
    e.preventDefault();
    try { await axios.put('http://localhost:5000/api/admin', settings); alert("Settings Saved!"); } 
    catch (err) { alert("Error saving settings."); }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100 overflow-y-auto">
      <h3 className="text-xl font-semibold text-gray-700 mb-6">Admin Control Panel</h3>
      <form onSubmit={handleSave} className="space-y-6">
                <div className="border p-4 rounded-lg">
          <h4 className="font-bold mb-3">General Info</h4>
          <div className="grid grid-cols-2 gap-4">
            <input type="text" name="shopName" value={settings.shopName} onChange={handleChange} placeholder="Shop Name" className="border p-2 rounded w-full" />
            <input type="number" name="taxRate" value={settings.taxRate} onChange={handleChange} placeholder="Tax %" className="border p-2 rounded w-full" />
            <input type="text" name="logoUrl" value={settings.logoUrl} onChange={handleChange} placeholder="Logo URL" className="border p-2 rounded w-full col-span-2" />
            <input type="text" name="reviewQrUrl" value={settings.reviewQrUrl} onChange={handleChange} placeholder="Review QR URL" className="border p-2 rounded w-full" />
            {/* NEW: Sticker Printer Name */}
            <input type="text" name="stickerPrinterName" value={settings.stickerPrinterName} onChange={handleChange} placeholder="Dymo Printer Name (e.g., DYMO LabelWriter 450)" className="border p-2 rounded w-full" />
          </div>
        </div>
        <div className="border p-4 rounded-lg">
          <h4 className="font-bold mb-3">Receipt Printing Options</h4>
          <div className="grid grid-cols-2 gap-3">
            {[{ key: 'showName', label: 'Show Item Name' },{ key: 'showImei', label: 'Show IMEI / S/N' },{ key: 'showPrice', label: 'Show Price' },{ key: 'showVat', label: 'Show VAT / NO VAT' },{ key: 'showPaymentMethod', label: 'Show Payment Method' },{ key: 'showWarrantyFooter', label: 'Show Warranty Footer' }].map(opt => (
              <label key={opt.key} className="flex items-center space-x-2 text-sm text-gray-600">
                <input type="checkbox" name={opt.key} checked={settings.receiptSettings[opt.key]} onChange={handleToggle} className="w-4 h-4" />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="border p-4 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold">Terms & Conditions</h4>
            <label className="flex items-center space-x-2 text-sm text-pink-600 font-medium">
              <input type="checkbox" name="useUniversalTerms" checked={settings.useUniversalTerms} onChange={handleUniversalToggle} className="w-4 h-4" />
              <span>Use Universal T&C (Overrides all below)</span>
            </label>
          </div>
          <div className={`space-y-3 ${settings.useUniversalTerms ? 'opacity-50 pointer-events-none' : ''}`}>
            <div><label className="text-sm font-medium text-gray-600">Mobile Selling T&C</label><textarea name="mobileTerms" value={settings.mobileTerms} onChange={handleChange} rows="3" className="w-full border p-2 rounded mt-1 text-sm"></textarea></div>
            <div><label className="text-sm font-medium text-gray-600">Laptop/MacBook T&C</label><textarea name="laptopTerms" value={settings.laptopTerms} onChange={handleChange} rows="3" className="w-full border p-2 rounded mt-1 text-sm"></textarea></div>
            <div><label className="text-sm font-medium text-gray-600">Buy/Trade-In Receipt T&C</label><textarea name="buyTerms" value={settings.buyTerms} onChange={handleChange} rows="3" className="w-full border p-2 rounded mt-1 text-sm"></textarea></div>
          </div>
          <div className={`mt-3 ${!settings.useUniversalTerms ? 'opacity-50 pointer-events-none' : ''}`}>
            <label className="text-sm font-medium text-gray-600">Universal T&C (Prints on everything)</label><textarea name="universalTerms" value={settings.universalTerms} onChange={handleChange} rows="3" className="w-full border p-2 rounded mt-1 text-sm"></textarea>
          </div>
        </div>
        <button type="submit" className="w-full bg-pink-500 hover:bg-pink-600 text-white py-3 rounded-lg font-semibold">Save All Settings</button>
      </form>
    </div>
  );
};

export default AdminPanel;