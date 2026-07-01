import React, { useState, useEffect } from 'react';
import axios from 'axios';

const EndOfDay = () => {
  const [sales, setSales] = useState([]);
  const [cashTrans, setCashTrans] = useState([]);
  const [denoms, setDenoms] = useState({ 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0, coins: 0 });

  useEffect(() => {
    const fetchData = async () => {
      const salesRes = await axios.get('http://localhost:5000/api/sales');
      const cashRes = await axios.get('http://localhost:5000/api/cash');
      setSales(salesRes.data);
      setCashTrans(cashRes.data);
    };
    fetchData();
  }, []);

  const isToday = (dateStr) => {
    const date = new Date(dateStr); const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const todaySales = sales.filter(s => isToday(s.createdAt));
  const todayCashSales = todaySales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalAmount, 0);
  const todayCardSales = todaySales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.totalAmount, 0);
  const todayBankSales = todaySales.filter(s => s.paymentMethod === 'bank-transfer').reduce((sum, s) => sum + s.totalAmount, 0);
  const grossSales = todayCashSales + todayCardSales + todayBankSales;

  const todayCashTrans = cashTrans.filter(t => isToday(t.date));
  const todayRefunds = todayCashTrans.filter(t => t.type === 'refund').reduce((sum, t) => sum + t.amount, 0);
  const todayExpenses = todayCashTrans.filter(t => t.type === 'paid-out').reduce((sum, t) => sum + t.amount, 0);
  const netSales = grossSales - todayRefunds;

  const physicalCash = (denoms[50] * 50) + (denoms[20] * 20) + (denoms[10] * 10) + (denoms[5] * 5) + (denoms[2] * 2) + (denoms[1] * 1) + parseFloat(denoms.coins || 0);

  const generateReport = () => {
    let reportHTML = `<html><head><style>body { font-family: 'Courier New', monospace; width: 280px; margin: 0; padding: 10px; }h1 { text-align: center; font-size: 18px; margin: 0; color: #FF69B4; }h2 { text-align: center; font-size: 14px; margin: 5px 0 10px; }.row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }.total { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 10px; }.footer { text-align: center; font-size: 11px; margin-top: 15px; }</style></head><body><h1>Mobile Hub</h1><h2>DAILY SALE SHEET</h2><p style="text-align:center; font-size:11px;">Date: ${new Date().toLocaleDateString()}</p><hr style="border-top: 1px dashed #ccc;"><div class="row"><span>Cash Counted:</span><span>£${physicalCash.toFixed(2)}</span></div><div class="row"><span>Card Sales:</span><span>£${todayCardSales.toFixed(2)}</span></div><div class="row"><span>Bank Transfers:</span><span>£${todayBankSales.toFixed(2)}</span></div><div class="total"><span>GROSS SALES</span><span>£${grossSales.toFixed(2)}</span></div><div class="row" style="margin-top:10px; color: red;"><span>Refunds:</span><span>-£${todayRefunds.toFixed(2)}</span></div><div class="total"><span>NET SALES</span><span>£${netSales.toFixed(2)}</span></div><div class="row" style="margin-top:10px;"><span>Paid Outs (Expenses):</span><span>£${todayExpenses.toFixed(2)}</span></div><div class="footer">Sent to Management Group</div></body></html>`;
    if (window.electronAPI) window.electronAPI.printReceipt(reportHTML);
  };

  return (
    <div className="flex h-full gap-6">
      <div className="w-1/3 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Count Physical Cash</h3>
        <div className="space-y-3">
          {[{ label: '£50 Notes', val: 50 },{ label: '£20 Notes', val: 20 },{ label: '£10 Notes', val: 10 },{ label: '£5 Notes', val: 5 },{ label: '£2 Coins', val: 2 },{ label: '£1 Coins', val: 1 }].map(note => (
            <div key={note.val} className="flex items-center justify-between">
              <label className="text-sm text-gray-600">{note.label}</label>
              <div className="flex items-center gap-2"><span className="text-xs text-gray-400">x</span><input type="number" min="0" onChange={(e) => setDenoms({ ...denoms, [note.val]: parseInt(e.target.value) || 0 })} className="w-16 border border-gray-200 rounded-lg p-1 text-center" /><span className="text-xs text-gray-500 w-16 text-right">£{(denoms[note.val] * note.val).toFixed(2)}</span></div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-gray-100 pt-3"><label className="text-sm text-gray-600">Silver / Other Coins</label><div className="flex items-center gap-2"><span className="text-xs text-gray-400">£</span><input type="number" min="0" step="0.01" onChange={(e) => setDenoms({ ...denoms, coins: parseFloat(e.target.value) || 0 })} className="w-16 border border-gray-200 rounded-lg p-1 text-center" /></div></div>
          <div className="bg-pink-50 p-4 rounded-lg mt-4 text-center"><p className="text-sm text-gray-500">Total Physical Cash</p><p className="text-3xl font-bold text-pink-500">£{physicalCash.toFixed(2)}</p></div>
        </div>
      </div>
      <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Daily Sale Sheet (Z-Report)</h3>
        <div className="flex-1 space-y-4">
          <div className="border border-gray-200 rounded-lg p-4"><h4 className="text-sm font-bold text-gray-700 mb-3">Sales Breakdown</h4><div className="flex justify-between text-sm mb-2"><span>Cash Sales:</span><span className="font-medium">£{todayCashSales.toFixed(2)}</span></div><div className="flex justify-between text-sm mb-2"><span>Card Sales:</span><span className="font-medium">£{todayCardSales.toFixed(2)}</span></div><div className="flex justify-between text-sm mb-2"><span>Bank Transfers:</span><span className="font-medium">£{todayBankSales.toFixed(2)}</span></div><div className="flex justify-between text-sm font-bold text-gray-800 border-t border-gray-100 mt-2 pt-2"><span>Gross Sales:</span><span>£{grossSales.toFixed(2)}</span></div></div>
          <div className="border border-gray-200 rounded-lg p-4"><h4 className="text-sm font-bold text-gray-700 mb-3">Deductions & Expenses</h4><div className="flex justify-between text-sm mb-2 text-red-500"><span>Refunds (Minus from Sale):</span><span className="font-medium">-£${todayRefunds.toFixed(2)}</span></div><div className="flex justify-between text-sm mb-2 text-orange-500"><span>Paid Outs (Expenses):</span><span className="font-medium">£${todayExpenses.toFixed(2)}</span></div></div>
          <div className="bg-gray-900 text-white p-4 rounded-lg"><div className="flex justify-between items-center"><span className="text-sm">NET SALE (Gross - Refunds)</span><span className="text-2xl font-bold text-green-400">£${netSales.toFixed(2)}</span></div></div>
        </div>
        <button onClick={generateReport} className="w-full bg-pink-500 hover:bg-pink-600 text-white py-3 rounded-lg font-semibold mt-4">🖨️ Print / Send Daily Sale Sheet</button>
      </div>
    </div>
  );
};

export default EndOfDay;