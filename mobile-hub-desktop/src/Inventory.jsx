import React, { useState, useEffect } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [meta, setMeta] = useState({ brands: [], types: [], models: [] });
  const [settings, setSettings] = useState({ stickerPrinterName: '', shopName: '', departments: [] });
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', brand: '', type: 'Mobile', sku: '', network: 'Unlocked', internalMemory: '', condition: 'A', department: 'Accessories', costPrice: 0, retailPrice: 0, sellingPrice: 0, stockQuantity: 1, color: '', supplier: '', imei: '' });
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [stockData, setStockData] = useState({ product: null, qty: 0, newCostPrice: 0 });

  useEffect(() => {
    axios.get('http://localhost:5000/api/products/meta/distinct').then(res => setMeta(res.data));
    axios.get('http://localhost:5000/api/admin').then(res => setSettings(res.data));
  }, []);

  useEffect(() => { fetchProducts(); }, [searchTerm, filterType]);

  const fetchProducts = async () => {
    setLoading(true);
    const res = await axios.get(`http://localhost:5000/api/products?search=${searchTerm}&type=${filterType}`);
    setProducts(res.data); setLoading(false);
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/products', { ...formData, costPrice: parseFloat(formData.costPrice) || 0, retailPrice: parseFloat(formData.retailPrice) || 0, sellingPrice: parseFloat(formData.sellingPrice) || 0, stockQuantity: parseInt(formData.stockQuantity) || 0 });
      const metaRes = await axios.get('http://localhost:5000/api/products/meta/distinct');
      setMeta(metaRes.data); fetchProducts(); setShowModal(false);
      setFormData({ name: '', brand: '', type: 'Mobile', sku: '', network: 'Unlocked', internalMemory: '', condition: 'A', department: 'Accessories', costPrice: 0, retailPrice: 0, sellingPrice: 0, stockQuantity: 1, color: '', supplier: '', imei: '' });
    } catch (err) { alert("Error adding product. SKU must be unique."); }
  };

  const openAddStockModal = (product) => { setStockData({ product, qty: 0, newCostPrice: product.costPrice }); setShowAddStockModal(true); };

  const handleAddStockSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:5000/api/products/${stockData.product._id}/add-stock`, { quantity: parseInt(stockData.qty), newCostPrice: stockData.newCostPrice });
      const qrData = stockData.product.imei || stockData.product.sku;
      const qrImageUrl = await QRCode.toDataURL(qrData, { width: 100 });
      let labelsHTML = `<html><head><style>@media print { .label { page-break-after: always; } }</style></head><body>`;
      for (let i = 0; i < parseInt(stockData.qty); i++) {
        labelsHTML += `<div class="label" style="width: 250px; margin: 0; padding: 5px; text-align: center; font-family: Arial, sans-serif;"><div style="font-size: 14px; font-weight: bold; color: #FF69B4;">${settings.shopName}</div><div style="font-size: 12px; margin: 2px 0;">${stockData.product.name}</div><div style="font-size: 18px; font-weight: bold; margin-top: 5px;">£${stockData.product.sellingPrice.toFixed(2)}</div><div style="margin-top: 5px;"><img src="${qrImageUrl}" width="80" height="80" /></div></div>`;
      }
      labelsHTML += `</body></html>`;
      if (window.electronAPI && settings.stickerPrinterName) window.electronAPI.printReceipt(labelsHTML, settings.stickerPrinterName);
      else {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        printWindow.document.write(labelsHTML); printWindow.document.close(); printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 300);
      }
      fetchProducts(); setShowAddStockModal(false);
    } catch (err) { alert("Error adding stock."); }
  };

  const handlePrintLabel = async (product) => {
    try {
      const qrData = product.imei || product.sku;
      const qrImageUrl = await QRCode.toDataURL(qrData, { width: 100 });
      let labelHTML = `<html><head><style>body { font-family: Arial, sans-serif; width: 250px; margin: 0; padding: 5px; text-align: center; }</style></head><body><div style="font-size: 14px; font-weight: bold; color: #FF69B4;">${settings.shopName}</div><div style="font-size: 12px; margin: 2px 0;">${product.name}</div><div style="font-size: 18px; font-weight: bold; margin-top: 5px;">£${product.sellingPrice.toFixed(2)}</div><div style="margin-top: 5px;"><img src="${qrImageUrl}" width="80" height="80" /></div></body></html>`;
      if (window.electronAPI) window.electronAPI.printReceipt(labelHTML, settings.stickerPrinterName);
    } catch (err) { alert("Error generating label."); }
  };

  const lowStockCount = products.filter(p => p.stockQuantity < 5 && p.type !== 'Phone' && p.type !== 'Laptop' && p.type !== 'Tablet').length;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 gap-4">
        <div className="flex gap-3 flex-1 items-center">
          <input type="text" placeholder="🔍 Search name, brand, SKU, or IMEI..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-field flex-1" />
          {lowStockCount > 0 && <span className="bg-red-100 text-red-600 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap border border-red-200">⚠️ {lowStockCount} Low Stock</span>}
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-field w-40">
          <option value="All">All Types</option>
          {meta.types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => setShowModal(true)} className="btn-primary whitespace-nowrap w-auto px-4">+ Add Product</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? <p className="text-gray-400 text-center py-8">Loading...</p> : (
          <table className="w-full text-left border-collapse">
            <thead><tr className="border-b border-gray-200 bg-gray-50 sticky top-0"><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Name / Brand</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Type</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">SKU / IMEI</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Cost Price</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Sale Price</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Stock</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Actions</th></tr></thead>
            <tbody>
              {products.map((prod) => {
                const isLowStock = prod.stockQuantity < 5 && prod.type !== 'Phone' && prod.type !== 'Laptop' && prod.type !== 'Tablet';
                return (
                  <tr key={prod._id} className={`border-b border-gray-100 hover:bg-gray-50 ${isLowStock ? 'bg-red-50' : ''}`}>
                    <td className="py-3 px-4"><p className="font-medium text-gray-800">{prod.name}</p><p className="text-xs text-gray-500">{prod.brand} {prod.color && `- ${prod.color}`}</p></td>
                    <td className="py-3 px-4"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">{prod.type}</span></td>
                    <td className="py-3 px-4 text-gray-600 text-xs">{prod.sku}{prod.imei && <div className="text-gray-400">IMEI: {prod.imei}</div>}</td>
                    <td className="py-3 px-4 text-gray-800 font-medium text-sm">£{prod.costPrice.toFixed(2)}</td>
                    <td className="py-3 px-4 text-gray-800 font-medium text-sm">£{prod.sellingPrice.toFixed(2)}</td>
                    <td className="py-3 px-4"><span className={`font-bold text-sm ${isLowStock ? 'text-red-600' : 'text-gray-800'}`}>{prod.stockQuantity} {isLowStock && '(Low)'}</span></td>
                    <td className="py-3 px-4 flex gap-2">
                      <button onClick={() => openAddStockModal(prod)} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-medium">+ Add Stock</button>
                      <button onClick={() => handlePrintLabel(prod)} className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-xs font-medium">🖨️ Label</button>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && <tr><td colSpan="7" className="py-8 text-center text-gray-400">No products found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold text-gray-700">Add New Product</h3><button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button></div>
            <form onSubmit={handleAddProduct} className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Make / Manufacturer</label><input type="text" name="brand" value={formData.brand} onChange={handleChange} list="brands_list" placeholder="Select or type new" className="input-field" /><datalist id="brands_list">{meta.brands.map(b => <option key={b} value={b} />)}</datalist></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label><input type="text" name="type" value={formData.type} onChange={handleChange} list="types_list" placeholder="Select or type new" className="input-field" /><datalist id="types_list">{meta.types.map(t => <option key={t} value={t} />)}</datalist></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Model Name</label><input type="text" name="name" value={formData.name} onChange={handleChange} list="models_list" placeholder="Select or type new" required className="input-field" /><datalist id="models_list">{meta.models.map(m => <option key={m} value={m} />)}</datalist></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">IMEI / S/N</label><input type="text" name="imei" value={formData.imei} onChange={handleChange} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Network</label><input type="text" name="network" value={formData.network} onChange={handleChange} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Internal Memory</label><input type="text" name="internalMemory" value={formData.internalMemory} onChange={handleChange} placeholder="e.g., 128GB" className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Condition / Grade</label><input type="text" name="condition" value={formData.condition} onChange={handleChange} placeholder="e.g., A, B, C" className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Buying Price (£)</label><input type="number" step="0.01" name="costPrice" value={formData.costPrice} onChange={handleChange} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Retail Price (£)</label><input type="number" step="0.01" name="retailPrice" value={formData.retailPrice} onChange={handleChange} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Sale Price (£)</label><input type="number" step="0.01" name="sellingPrice" value={formData.sellingPrice} onChange={handleChange} required className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Stock Qty</label><input type="number" name="stockQuantity" value={formData.stockQuantity} onChange={handleChange} required className="input-field" /></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Department</label><select name="department" value={formData.department} onChange={handleChange} className="input-field">{settings.departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Supplier / Source</label><input type="text" name="supplier" value={formData.supplier} onChange={handleChange} placeholder="e.g., ABC Wholesale or Customer Trade-in" className="input-field" /></div>
              <div className="col-span-2 flex gap-3 mt-4"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button><button type="submit" className="btn-primary flex-1">Save & Close</button></div>
            </form>
          </div>
        </div>
      )}

      {showAddStockModal && stockData.product && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold text-gray-700">Add Stock: {stockData.product.name}</h3><button onClick={() => setShowAddStockModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button></div>
            <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm">
              <div className="flex justify-between mb-2"><span className="text-gray-500">Current Stock:</span><span className="font-bold">{stockData.product.stockQuantity}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Current Average Cost:</span><span className="font-bold">£{stockData.product.costPrice.toFixed(2)}</span></div>
            </div>
            {stockData.product.priceHistory && stockData.product.priceHistory.length > 0 && (
              <div className="mb-4 border border-gray-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Price History</h4>
                {stockData.product.priceHistory.slice().reverse().map((hist, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-600 py-1 border-b border-gray-100"><span>{new Date(hist.date).toLocaleDateString()}</span><span className="font-medium">£{hist.costPrice.toFixed(2)}</span></div>
                ))}
              </div>
            )}
            <form onSubmit={handleAddStockSubmit} className="space-y-4">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Quantity to Add</label><input type="number" min="1" value={stockData.qty} onChange={(e) => setStockData({ ...stockData, qty: e.target.value })} required className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">New Purchase Cost (£) for this batch</label><input type="number" step="0.01" value={stockData.newCostPrice} onChange={(e) => setStockData({ ...stockData, newCostPrice: e.target.value })} required className="input-field" /></div>
              {stockData.qty > 0 && stockData.newCostPrice > 0 && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm">
                  <div className="flex justify-between text-blue-700"><span className="font-medium">New Average Cost Price:</span><span className="font-bold">£{(() => { const oldTotal = stockData.product.costPrice * stockData.product.stockQuantity; const newTotal = parseFloat(stockData.newCostPrice) * parseInt(stockData.qty); const totalQty = stockData.product.stockQuantity + parseInt(stockData.qty); return totalQty > 0 ? (Math.round(((oldTotal + newTotal) / totalQty) * 100) / 100).toFixed(2) : '0.00'; })()}</span></div>
                </div>
              )}
              <div className="flex gap-3 mt-4"><button type="button" onClick={() => setShowAddStockModal(false)} className="btn-secondary flex-1">Cancel</button><button type="submit" className="btn-primary flex-1 bg-green-500 hover:bg-green-600">Save & Print {stockData.qty || 0} Stickers</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
