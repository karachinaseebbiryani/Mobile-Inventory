import React, { useState, useEffect } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';

const Repairs = () => {
  const [repairs, setRepairs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ customerName: '', customerPhone: '', make: '', deviceModel: '', imei: '', internalMemory: 'STANDARD', issue: '', repairCost: 0 });
  const [settings, setSettings] = useState({ repairTerms: '', shopName: '', logoUrl: '', currencySymbol: '£', stickerPrinterName: '' });
  
  // Modal state
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [stickerQty, setStickerQty] = useState(1);

  useEffect(() => {
    axios.get('http://localhost:5000/api/repairs').then(res => setRepairs(res.data));
    axios.get('http://localhost:5000/api/admin').then(res => setSettings(res.data));
  }, []);

  const handleChange = (e) => {
    if (e.target.name === 'repairCost') {
      setFormData({ ...formData, repairCost: parseFloat(e.target.value) || 0 });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handlePhoneLookup = async (e) => {
    if (formData.customerPhone.length === 10) {
      try {
        const res = await axios.get(`http://localhost:5000/api/customers/phone/${formData.customerPhone}`);
        if (res.data) setFormData(prev => ({ ...prev, customerName: res.data.name }));
      } catch (err) {}
    }
  };

  const openPrintPreview = (htmlContent) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ticketId = 'MH-' + Date.now().toString().slice(-5);
    try {
      let customerRes = await axios.get(`http://localhost:5000/api/customers/phone/${formData.customerPhone}`);
      if (!customerRes.data) { 
        customerRes = await axios.post('http://localhost:5000/api/customers', { name: formData.customerName, phone: formData.customerPhone }); 
      }
      const res = await axios.post('http://localhost:5000/api/repairs', { ...formData, ticketId });
      setRepairs([res.data, ...repairs]);
      
      // Generate QR Code for the receipt
      const qrData = formData.imei || ticketId;
      const qrImageUrl = await QRCode.toDataURL(qrData, { width: 120 });
      
      let slipHTML = `<html><head><style>body { font-family: 'Courier New', monospace; width: 280px; margin: 0; padding: 10px; }h1 { text-align: center; font-size: 18px; margin: 0; color: #FF69B4; }h2 { text-align: center; font-size: 14px; margin: 2px 0 10px; }.row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }.ticket { text-align: center; font-size: 20px; font-weight: bold; margin: 10px 0; }.qr { text-align: center; margin: 10px 0; }.footer { text-align: center; font-size: 11px; margin-top: 15px; }</style></head><body><h1>${settings.shopName}</h1><h2>NEW REPAIR ORDER</h2><p style="text-align:center; font-size:11px;">${new Date().toLocaleString()}</p><hr style="border-top: 1px dashed #ccc;"><div class="row"><span>Customer:</span><span><b>${formData.customerName}</b></span></div><div class="row"><span>Phone:</span><span>${formData.customerPhone}</span></div><hr style="border-top: 1px dashed #ccc; margin: 10px 0;"><div class="row"><span>Make/Model:</span><span><b>${formData.make} ${formData.deviceModel}</b></span></div><div class="row"><span>IMEI:</span><span>${formData.imei || 'N/A'}</span></div><div class="row"><span>Memory:</span><span>${formData.internalMemory}</span></div><div class="row"><span>Issue:</span><span>${formData.issue}</span></div><div class="row" style="font-size:16px; font-weight:bold; margin-top:10px;"><span>Cost:</span><span>${settings.currencySymbol}${parseFloat(formData.repairCost).toFixed(2)}</span></div><div class="ticket">${ticketId}</div><div class="qr"><img src="${qrImageUrl}" width="100" height="100" /></div><div class="footer">Scan barcode at counter to collect device!</div></body></html>`;
      
      openPrintPreview(slipHTML);
      setFormData({ customerName: '', customerPhone: '', make: '', deviceModel: '', imei: '', internalMemory: 'STANDARD', issue: '', repairCost: 0 });
    } catch (err) { console.error("Error creating ticket"); }
  };

  const handleCollect = async (repair) => {
    try {
      await axios.put(`http://localhost:5000/api/repairs/${repair._id}/collect`, { repairCost: repair.repairCost });
      setRepairs(repairs.filter(r => r._id !== repair._id));
      setSelectedRepair(null);
      
      let slipHTML = `<html><head><style>body { font-family: 'Courier New', monospace; width: 280px; margin: 0; padding: 10px; }h1 { text-align: center; font-size: 18px; margin: 0; color: #000; }h2 { text-align: center; font-size: 14px; margin: 5px 0; }.row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }.total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 0; margin-top: 10px; }.footer { text-align: center; font-size: 11px; margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px; white-space: pre-line; }</style></head><body><h1>${settings.shopName}</h1><h2>REPAIR COLLECTION SLIP</h2><div class="row"><span>Date:</span><span>${new Date().toLocaleString()}</span></div><div class="row"><span>Ticket ID:</span><span>${repair.ticketId}</span></div><hr style="border-top: 1px dashed #ccc; margin: 10px 0;"><div class="row"><span>Customer:</span><span>${repair.customerName}</span></div><div class="row"><span>Device:</span><span>${repair.make} ${repair.deviceModel}</span></div><div class="row"><span>IMEI:</span><span>${repair.imei || 'N/A'}</span></div><div class="row"><span>Issue:</span><span>${repair.issue}</span></div><div class="total"><span>REPAIR COST PAID</span><span>${settings.currencySymbol}${repair.repairCost.toFixed(2)}</span></div><div class="footer"><strong>KEEP RECEIPT FOR WARRANTY</strong><br><br>${settings.repairTerms}</div></body></html>`;
      
      openPrintPreview(slipHTML);
    } catch (err) { console.error("Error collecting repair"); }
  };

  const handlePrintSticker = async (repair) => {
    try {
      const qrData = repair.imei || repair.ticketId;
      const qrImageUrl = await QRCode.toDataURL(qrData, { width: 100 });
      
      let labelHTML = `<html><head><style>body { font-family: Arial, sans-serif; width: 250px; margin: 0; padding: 5px; text-align: center; }.header { font-size: 14px; font-weight: bold; color: #FF69B4; }.model { font-size: 12px; margin: 2px 0; }.imei { font-size: 10px; color: #555; }.price { font-size: 18px; font-weight: bold; margin-top: 5px; }.qr { margin-top: 5px; }</style></head><body><div class="header">${settings.shopName}</div><div class="model">${repair.make} ${repair.deviceModel}</div><div class="imei">S/N: ${repair.imei || 'N/A'}</div><div class="qr"><img src="${qrImageUrl}" width="80" height="80" /></div></body></html>`;

      // Print the sticker based on quantity
      for (let i = 0; i < stickerQty; i++) {
        if (window.electronAPI && settings.stickerPrinterName) {
          window.electronAPI.printReceipt(labelHTML, settings.stickerPrinterName);
        } else {
          // Fallback to preview if no printer name is set in settings
          openPrintPreview(labelHTML);
        }
      }
    } catch (err) { console.error("Error generating sticker"); }
  };

  // Filter repairs based on search term (Ticket ID, IMEI, Name, Phone)
  const filteredRepairs = repairs.filter(rep => 
    rep.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (rep.imei && rep.imei.includes(searchTerm)) ||
    rep.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rep.customerPhone.includes(searchTerm)
  );

  return (
    <div className="flex h-full gap-6">
      <div className="w-1/3 bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Book New Repair (Device IN)</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Customer Name</label><input type="text" name="customerName" value={formData.customerName} onChange={handleChange} required className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-pink-400" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label><input type="text" name="customerPhone" value={formData.customerPhone} onChange={handleChange} onKeyUp={handlePhoneLookup} required className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-pink-400" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Make</label><input type="text" name="make" value={formData.make} onChange={handleChange} placeholder="e.g., IPHONE" className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-pink-400" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Model</label><input type="text" name="deviceModel" value={formData.deviceModel} onChange={handleChange} placeholder="e.g., 15 PLUS" required className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-pink-400" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">IMEI / S/N</label><input type="text" name="imei" value={formData.imei} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-pink-400" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Memory</label><input type="text" name="internalMemory" value={formData.internalMemory} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-pink-400" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Issue / Fault</label><textarea name="issue" value={formData.issue} onChange={handleChange} rows="2" required className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-pink-400"></textarea></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Repair Cost (£)</label><input type="number" step="0.01" name="repairCost" value={formData.repairCost} onChange={handleChange} required className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-pink-400" /></div>
          <button type="submit" className="w-full bg-pink-500 hover:bg-pink-600 text-white py-2 rounded-lg font-semibold">Save & Close</button>
        </form>
      </div>

      <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-y-auto">
        <div className="flex justify-between items-center mb-4 gap-4">
          <h3 className="text-lg font-semibold text-gray-700">Active Repair Queue</h3>
          <input 
            type="text" 
            placeholder="🔍 Scan barcode or search..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-pink-400"
          />
        </div>
        <table className="w-full text-left border-collapse">
          <thead><tr className="border-b border-gray-200"><th className="py-3 px-4 text-gray-500 font-semibold">Ticket / Device</th><th className="py-3 px-4 text-gray-500 font-semibold">Customer</th><th className="py-3 px-4 text-gray-500 font-semibold">Issue</th><th className="py-3 px-4 text-gray-500 font-semibold">Cost</th></tr></thead>
          <tbody>
            {filteredRepairs.map((rep) => (
              <tr key={rep._id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRepair(rep)}>
                <td className="py-3 px-4"><p className="font-medium text-gray-800">{rep.make} {rep.deviceModel}</p><p className="text-xs text-pink-500">{rep.ticketId}</p><p className="text-xs text-gray-400">IMEI: {rep.imei || 'N/A'}</p></td>
                <td className="py-3 px-4"><p className="font-medium text-gray-800">{rep.customerName}</p><p className="text-xs text-gray-500">{rep.customerPhone}</p></td>
                <td className="py-3 px-4 text-gray-600 text-sm max-w-xs truncate">{rep.issue}</td>
                <td className="py-3 px-4 font-medium text-gray-800">£{rep.repairCost.toFixed(2)}</td>
              </tr>
            ))}
            {filteredRepairs.length === 0 && <tr><td colSpan="4" className="py-8 text-center text-gray-400">No repairs found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Repair Details Modal */}
      {selectedRepair && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Repair Details</h3>
              <button onClick={() => setSelectedRepair(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            
            <div className="space-y-2 mb-6 text-sm">
              <p><span className="font-medium text-gray-500">Ticket ID:</span> <span className="text-pink-500 font-bold">{selectedRepair.ticketId}</span></p>
              <p><span className="font-medium text-gray-500">Customer:</span> <span className="text-gray-800">{selectedRepair.customerName}</span></p>
              <p><span className="font-medium text-gray-500">Phone:</span> <span className="text-gray-800">{selectedRepair.customerPhone}</span></p>
              <p><span className="font-medium text-gray-500">Device:</span> <span className="text-gray-800">{selectedRepair.make} {selectedRepair.deviceModel}</span></p>
              <p><span className="font-medium text-gray-500">IMEI/S/N:</span> <span className="text-gray-800">{selectedRepair.imei || 'N/A'}</span></p>
              <p><span className="font-medium text-gray-500">Issue:</span> <span className="text-gray-800">{selectedRepair.issue}</span></p>
              <p><span className="font-medium text-gray-500">Cost:</span> <span className="text-gray-800 font-bold">£{selectedRepair.repairCost.toFixed(2)}</span></p>
            </div>

            {/* Sticker Print Section */}
            <div className="border-t border-gray-200 pt-4 mb-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Print Dymo Sticker</h4>
              <div className="flex gap-2 items-center">
                <input 
                  type="number" 
                  min="1" 
                  value={stickerQty} 
                  onChange={(e) => setStickerQty(parseInt(e.target.value) || 1)} 
                  className="w-16 border border-gray-200 rounded-lg p-2 text-center" 
                />
                <button 
                  onClick={() => handlePrintSticker(selectedRepair)} 
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg font-semibold text-sm"
                >
                  🖨️ Print Sticker(s)
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setSelectedRepair(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded-lg font-semibold">Close</button>
              <button onClick={() => handleCollect(selectedRepair)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-semibold">Collect & Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Repairs;