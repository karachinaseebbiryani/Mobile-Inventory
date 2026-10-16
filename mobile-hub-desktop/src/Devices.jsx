import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Devices = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    axios.get('http://localhost:5000/api/products').then(res => { setProducts(res.data); setLoading(false); });
  }, []);

  const allDevices = products.filter(p => p.type === 'Phone' || p.type === 'Laptop' || p.type === 'Tablet');
  const filteredDevices = allDevices.filter(p => {
    const purchaseDate = new Date(p.createdAt); let dateMatch = true;
    if (startDate && endDate) { const sDate = new Date(startDate); const eDate = new Date(endDate); eDate.setHours(23, 59, 59); dateMatch = purchaseDate >= sDate && purchaseDate <= eDate; }
    if (filterStatus === 'sold') return p.isSold && dateMatch;
    if (filterStatus === 'stock') return !p.isSold && dateMatch;
    return dateMatch;
  });
  const sortedDevices = filteredDevices.sort((a, b) => { if (a.isSold && !b.isSold) return 1; if (!a.isSold && b.isSold) return -1; return new Date(b.createdAt) - new Date(a.createdAt); });
  const inStockCount = filteredDevices.filter(p => !p.isSold).length;
  const soldCount = filteredDevices.filter(p => p.isSold).length;
  const stockValue = filteredDevices.filter(p => !p.isSold).reduce((sum, p) => sum + p.costPrice, 0);

  const exportToCSV = () => {
    let csv = "Device Name,IMEI,Purchase Date,Sold Date,Status,Cost Price,Selling Price\n";
    sortedDevices.forEach(p => { csv += `${p.name},${p.imei || 'N/A'},${new Date(p.createdAt).toLocaleDateString()},${p.soldDate ? new Date(p.soldDate).toLocaleDateString() : 'N/A'},${p.isSold ? 'SOLD' : 'IN STOCK'},£${p.costPrice.toFixed(2)},£${p.sellingPrice.toFixed(2)}\n`; });
    const blob = new Blob([csv], { type: 'text/csv' }); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Mobile_Hub_Devices_Report.csv`; a.click();
  };

  return (
    <div className="card h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-700">Device Inventory (Phones & Laptops)</h3>
        <button onClick={exportToCSV} className="btn-secondary bg-green-500 hover:bg-green-600 text-white">📥 Export Excel</button>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="col-span-2 flex gap-2 items-end">
          <div className="flex-1"><label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" /></div>
          <div className="flex-1"><label className="block text-xs font-medium text-gray-500 mb-1">End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" /></div>
        </div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">Status Filter</label><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field"><option value="all">All Devices</option><option value="stock">In Stock Only</option><option value="sold">Sold Only</option></select></div>
        <div className="flex justify-end items-end gap-4">
          <div className="text-center bg-blue-50 p-2 rounded-lg w-24 border border-blue-100"><p className="text-xs text-blue-400">In Stock</p><p className="text-xl font-bold text-blue-600">{inStockCount}</p></div>
          <div className="text-center bg-green-50 p-2 rounded-lg w-24 border border-green-100"><p className="text-xs text-green-400">Sold</p><p className="text-xl font-bold text-green-600">{soldCount}</p></div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead><tr className="border-b border-gray-200 bg-gray-50 sticky top-0"><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Device</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">IMEI / S/N</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Purchase Date</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Sold Date</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Cost</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Status</th></tr></thead>
          <tbody>
            {sortedDevices.map((p) => (
              <tr key={p._id} className={`border-b border-gray-100 ${p.isSold ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                <td className="py-3 px-4"><p className="font-medium text-gray-800 text-sm">{p.name}</p><p className="text-xs text-gray-400">{p.brand} | {p.internalMemory} | {p.condition}</p></td>
                <td className="py-3 px-4 text-gray-600 text-xs">{p.imei || 'N/A'}</td>
                <td className="py-3 px-4 text-gray-600 text-sm">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="py-3 px-4 text-gray-600 text-sm">{p.soldDate ? new Date(p.soldDate).toLocaleDateString() : '-'}</td>
                <td className="py-3 px-4 text-gray-800 font-medium text-sm">£{p.costPrice.toFixed(2)}</td>
                <td className="py-3 px-4">{p.isSold ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">SOLD</span> : <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">IN STOCK</span>}</td>
              </tr>
            ))}
            {sortedDevices.length === 0 && <tr><td colSpan="6" className="py-8 text-center text-gray-400">No devices found for the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 text-right"><p className="text-sm text-gray-500">Total Stock Value (Cost): <span className="font-bold text-gray-800">£{stockValue.toFixed(2)}</span></p></div>
    </div>
  );
};

export default Devices;