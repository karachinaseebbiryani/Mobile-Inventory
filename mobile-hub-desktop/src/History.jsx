import React, { useState, useEffect } from 'react';
import axios from 'axios';

const History = () => {
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState('sale');

  useEffect(() => { axios.get('http://localhost:5000/api/sales').then(res => setRecords(res.data)); }, []);

  const openPrintPreview = (record) => {
    let html = `<html><head><style>body { font-family: 'Courier New', monospace; width: 280px; margin: 0; padding: 10px; }h1 { text-align: center; font-size: 18px; margin: 0; }h2 { text-align: center; font-size: 14px; margin: 5px 0; }.row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }.total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-top: 1px solid #000; padding: 5px 0; margin-top: 10px; }</style></head><body><h1>Mobile Hub</h1><h2>${record.type === 'buy' ? 'BUY RECEIPT (COPY)' : 'SALES RECEIPT (COPY)'}</h2><div class="row"><span>Date:</span><span>${new Date(record.createdAt).toLocaleString()}</span></div><div class="row"><span>Customer:</span><span>${record.customerName}</span></div><hr style="border-top: 1px dashed #ccc; margin: 10px 0;">`;
    record.items.forEach(item => { html += `<div class="row"><span>${item.name} x${item.quantity}</span><span>£${(item.sellingPrice * item.quantity).toFixed(2)}</span></div>`; });
    html += `<div class="total"><span>TOTAL</span><span>£${record.totalAmount.toFixed(2)}</span></div></body></html>`;
    const printWindow = window.open('', '_blank', 'width=400,height=600'); printWindow.document.write(html); printWindow.document.close(); printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  const filteredRecords = records.filter(r => r.type === filter);

  return (
    <div className="card h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-700">Transaction History</h3>
        <div className="flex gap-2">
          <button onClick={() => setFilter('sale')} className={`px-4 py-2 rounded-lg font-medium text-sm ${filter === 'sale' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Sales History</button>
          <button onClick={() => setFilter('buy')} className={`px-4 py-2 rounded-lg font-medium text-sm ${filter === 'buy' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Buy History</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead><tr className="border-b border-gray-200 bg-gray-50 sticky top-0"><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Date / Time</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Customer</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Items</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Amount</th><th className="py-3 px-4 text-gray-500 font-semibold text-sm">Action</th></tr></thead>
          <tbody>
            {filteredRecords.map((rec) => (
              <tr key={rec._id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-600">{new Date(rec.createdAt).toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-800">{rec.customerName}<br/><span className="text-xs text-gray-400">{rec.customerPhone}</span></td>
                <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">{rec.items.map(i => i.name).join(', ')}</td>
                <td className="py-3 px-4 font-bold text-pink-500">£{rec.totalAmount.toFixed(2)}</td>
                <td className="py-3 px-4"><button onClick={() => openPrintPreview(rec)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded text-xs font-medium">🖨️ Reprint</button></td>
              </tr>
            ))}
            {filteredRecords.length === 0 && <tr><td colSpan="5" className="py-8 text-center text-gray-400">No history found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default History;