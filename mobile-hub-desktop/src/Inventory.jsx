import React, { useState, useEffect } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [meta, setMeta] = useState({ brands: [], types: [] });
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', brand: '', type: 'Mobile', sku: '', network: 'Unlocked', internalMemory: '', condition: 'A', costPrice: 0, retailPrice: 0, sellingPrice: 0, stockQuantity: 1, color: '', supplier: '', imei: ''
  });

  useEffect(() => {
    axios.get('http://localhost:5000/api/products/meta/distinct').then(res => setMeta(res.data));
  }, []);

  useEffect(() => { fetchProducts(); }, [searchTerm, filterType]);

  const fetchProducts = async () => {
    setLoading(true);
    const res = await axios.get(`http://localhost:5000/api/products?search=${searchTerm}&type=${filterType}`);
    setProducts(res.data);
    setLoading(false);
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/products', { 
        ...formData, 
        costPrice: parseFloat(formData.costPrice) || 0, 
        retailPrice: parseFloat(formData.retailPrice) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0, 
        stockQuantity: parseInt(formData.stockQuantity) || 0 
      });
      const metaRes = await axios.get('http://localhost:5000/api/products/meta/distinct');
      setMeta(metaRes.data); fetchProducts();
      setShowModal(false);
      setFormData({ name: '', brand: '', type: 'Mobile', sku: '', network: 'Unlocked', internalMemory: '', condition: 'A', costPrice: 0, retailPrice: 0, sellingPrice: 0, stockQuantity: 1, color: '', supplier: '', imei: '' });
    } catch (err) { alert("Error adding product. SKU must be unique."); }
  };

  const handlePrintLabel = async (product) => {
    try {
      const qrData = product.imei || product.sku;
      const qrImageUrl = await QRCode.toDataURL(qrData, { width: 100 });
      let labelHTML = `<html><head><style>body { font-family: Arial, sans-serif; width: 250px; margin: 0; padding: 5px; text-align: center; }.header { font-size: 14px; font-weight: bold; color: #FF69B4; }.model { font-size: 12px; margin: 2px 0; }.color { font-size: 10px; color: #555; }.price { font-size: 18px; font-weight: bold; margin-top: 5px; }.qr { margin-top: 5px; }</style></head><body><div class="header">Mobile Hub</div><div class="model">${product.name}</div><div class="color">${product.color || ''}</div><div class="price">£${product.sellingPrice.toFixed(2)}</div><div class="qr"><img src="${qrImageUrl}" width="80" height="80" /></div><div style="font-size: 8px; margin-top: 2px;">${qrData}</div></body></html>`;
      if (window.electronAPI) window.electronAPI.printReceipt(labelHTML);
    } catch (err) { alert("Error generating label."); }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 gap-4">
        <div className="flex gap-3 flex-1">
          <input type="text" placeholder="🔍 Search name, brand, SKU, or IMEI..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-pink-400" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-pink-400">
            <option value="All">All Types</option>
            {meta.types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap">+ Add Product</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? <p className="text-gray-400 text-center py-8">Loading...</p> : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 sticky top-0">
                <th className="py-3 px-4 text-gray-500 font-semibold">Name / Brand</th>
                <th className="py-3 px-4 text-gray-500 font-semibold">Type</th>
                <th className="py-3 px-4 text-gray-500 font-semibold">SKU / IMEI</th>
                <th className="py-3 px-4 text-gray-500 font-semibold">Supplier</th>
                <th className="py-3 px-4 text-gray-500 font-semibold">Price</th>
                <th className="py-3 px-4 text-gray-500 font-semibold">Stock</th>
                <th className="py-3 px-4 text-gray-500 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((prod) => (
                <tr key={prod._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-800">{prod.name}</p>
                    <p className="text-xs text-gray-500">{prod.brand} {prod.color && `- ${prod.color}`}</p>
                  </td>
                  <td className="py-3 px-4"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">{prod.type}</span></td>
                  <td className="py-3 px-4 text-gray-600 text-xs">
                    {prod.sku}
                    {prod.imei && <div className="text-gray-400">IMEI: {prod.imei}</div>}
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-xs">{prod.supplier}</td>
                  <td className="py-3 px-4 text-gray-800 font-medium">£{prod.sellingPrice.toFixed(2)}</td>
                  <td className="py-3 px-4"><span className={`font-bold ${prod.stockQuantity < 5 ? 'text-red-500' : 'text-green-600'}`}>{prod.stockQuantity}</span></td>
                  <td className="py-3 px-4"><button onClick={() => handlePrintLabel(prod)} className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-xs font-medium">🖨️ Label</button></td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan="7" className="py-8 text-center text-gray-400">No products found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Add New Product</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            
            <form onSubmit={handleAddProduct} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Make / Manufacturer</label>
                <input type="text" name="brand" value={formData.brand} onChange={handleChange} list="brands_list" placeholder="e.g., MACBOOK" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-pink-400" />
                <datalist id="brands_list">{meta.brands.map(b => <option key={b} value={b} />)}</datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <input type="text" name="type" value={formData.type} onChange={handleChange} list="types_list" placeholder="e.g., Mobile, Laptop" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-pink-400" />
                <datalist id="types_list">{meta.types.map(t => <option key={t} value={t} />)}</datalist>
              </div>
              
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Model Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., AIR A1466" required className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">IMEI / S/N</label>
                <input type="text" name="imei" value={formData.imei} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Network</label>
                <input type="text" name="network" value={formData.network} onChange={handleChange} placeholder="e.g., Unlocked, O2" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Internal Memory</label>
                <input type="text" name="internalMemory" value={formData.internalMemory} onChange={handleChange} placeholder="e.g., 128GB" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Condition / Grade</label>
                <input type="text" name="condition" value={formData.condition} onChange={handleChange} placeholder="e.g., A, B, C" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Buying Price (£)</label>
                <input type="number" step="0.01" name="costPrice" value={formData.costPrice} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Retail Price (£)</label>
                <input type="number" step="0.01" name="retailPrice" value={formData.retailPrice} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sale Price (£)</label>
                <input type="number" step="0.01" name="sellingPrice" value={formData.sellingPrice} onChange={handleChange} required className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stock Qty</label>
                <input type="number" name="stockQuantity" value={formData.stockQuantity} onChange={handleChange} required className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>

              <div className="col-span-2 flex gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded-lg font-semibold">Cancel</button>
                <button type="submit" className="flex-1 bg-pink-500 hover:bg-pink-600 text-white py-2 rounded-lg font-semibold">Save & Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;