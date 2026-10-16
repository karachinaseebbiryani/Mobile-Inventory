import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Accounts = () => {
  const [cashTrans, setCashTrans] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [sales, setSales] = useState([]);
  const [cashForm, setCashForm] = useState({ type: 'paid-out', source: 'till', amount: 0, note: '' });
  const [vendorName, setVendorName] = useState('');
  const [billForm, setBillForm] = useState({ vendorId: '', description: '', amount: 0 });

  const fetchData = async () => {
    const cashRes = await axios.get('http://localhost:5000/api/cash'); setCashTrans(cashRes.data);
    const vendRes = await axios.get('http://localhost:5000/api/vendors'); setVendors(vendRes.data);
    const salesRes = await axios.get('http://localhost:5000/api/sales'); setSales(salesRes.data);
  };
  useEffect(() => { fetchData(); }, []);

  const currentMonth = new Date().getMonth(); const currentYear = new Date().getFullYear();
  const tillBalance = cashTrans.filter(t => t.source === 'till').reduce((acc, t) => { if (t.type === 'float' || t.type === 'paid-in') return acc + t.amount; if (t.type === 'paid-out' || t.type === 'bank-in' || t.type === 'refund') return acc - t.amount; return acc; }, 0);
  const envelopeBalance = cashTrans.filter(t => t.source === 'envelope').reduce((acc, t) => { if (t.type === 'paid-in') return acc + t.amount; if (t.type === 'paid-out' || t.type === 'refund') return acc - t.amount; return acc; }, 0);
  const monthlyTillPaidOut = cashTrans.filter(t => t.type === 'paid-out' && t.source === 'till' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear).reduce((sum, t) => sum + t.amount, 0);
  const monthlyEnvelopePaidOut = cashTrans.filter(t => t.type === 'paid-out' && t.source === 'envelope' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear).reduce((sum, t) => sum + t.amount, 0);
  const monthlyVendorBills = vendors.reduce((sum, v) => sum + v.bills.filter(b => new Date(b.date).getMonth() === currentMonth && new Date(b.date).getFullYear() === currentYear).reduce((bSum, b) => bSum + b.amount, 0), 0);
  const totalMonthlyExpenses = monthlyTillPaidOut + monthlyEnvelopePaidOut + monthlyVendorBills;
  const STANDARD_FLOAT = 300;
  const totalCashSales = sales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalAmount, 0);
  const totalBankedIn = cashTrans.filter(t => t.type === 'bank-in' && t.source === 'till').reduce((sum, t) => sum + t.amount, 0);
  const actualTillCash = tillBalance + totalCashSales - totalBankedIn;
  let amountToBank = 0, shortfall = 0;
  if (actualTillCash > STANDARD_FLOAT) amountToBank = actualTillCash - STANDARD_FLOAT; else shortfall = STANDARD_FLOAT - actualTillCash;

  const handleCashSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/cash', { ...cashForm, amount: parseFloat(cashForm.amount) });
      if (cashForm.type === 'paid-out') {
        const html = `<html><head><style>body { font-family: 'Courier New', monospace; width: 280px; margin: 0; padding: 10px; }h1 { text-align: center; font-size: 18px; margin: 0; }h2 { text-align: center; font-size: 14px; margin: 5px 0 10px; }.row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; }.total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 10px; }</style></head><body><h1>Mobile Hub</h1><h2>CASH PAID OUT SLIP</h2><p style="text-align:center; font-size:11px;">${new Date().toLocaleString()}</p><hr style="border-top: 1px dashed #ccc;"><div class="row"><span>Paid Out From:</span><span><b>${cashForm.source.toUpperCase()}</b></span></div><div class="row"><span>Reason:</span><span>${cashForm.note || 'N/A'}</span></div><div class="total"><span>AMOUNT PAID OUT</span><span>£${parseFloat(cashForm.amount).toFixed(2)}</span></div></body></html>`;
        const printWindow = window.open('', '_blank', 'width=400,height=600'); printWindow.document.write(html); printWindow.document.close(); printWindow.focus(); setTimeout(() => { printWindow.print(); }, 300);
      }
      setCashForm({ type: 'paid-out', source: 'till', amount: 0, note: '' }); fetchData();
    } catch (err) { alert("Error saving transaction."); }
  };
  const handleVendorSubmit = async (e) => { e.preventDefault(); await axios.post('http://localhost:5000/api/vendors', { name: vendorName }); setVendorName(''); fetchData(); };
  const handleBillSubmit = async (e) => { e.preventDefault(); await axios.post(`http://localhost:5000/api/vendors/${billForm.vendorId}/bills`, { description: billForm.description, amount: parseFloat(billForm.amount) }); setBillForm({ vendorId: '', description: '', amount: 0 }); fetchData(); };

  const exportMonthlyReport = () => {
    let csv = "Mobile Hub - Monthly Closing Report\n"; csv += `Month: ${currentMonth + 1}/${currentYear}\n\n`; csv += "EXPENSE SUMMARY\n"; csv += `Total Till Paid Out,£${monthlyTillPaidOut.toFixed(2)}\n`; csv += `Total Envelope Paid Out,£${monthlyEnvelopePaidOut.toFixed(2)}\n`; csv += `Total Vendor Bills,£${monthlyVendorBills.toFixed(2)}\n`; csv += `TOTAL EXPENSES,£${totalMonthlyExpenses.toFixed(2)}\n\n`; csv += "TILL & ENVELOPE BALANCES\n"; csv += `Current Till Balance,£${tillBalance.toFixed(2)}\n`; csv += `Current Envelope Balance,£${envelopeBalance.toFixed(2)}\n\n`; csv += "VENDOR BILLS DETAIL\nVendor Name,Bill Description,Amount,Date\n";
    vendors.forEach(v => v.bills.forEach(b => { if (new Date(b.date).getMonth() === currentMonth && new Date(b.date).getFullYear() === currentYear) csv += `${v.name},${b.description},£${b.amount.toFixed(2)},${new Date(b.date).toLocaleDateString()}\n`; }));
    csv += "\nMISC PAID OUTS (Till & Envelope)\nDate,Source,Note,Amount\n";
    cashTrans.forEach(t => { if (t.type === 'paid-out' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear) csv += `${new Date(t.date).toLocaleDateString()},${t.source},${t.note},£${t.amount.toFixed(2)}\n`; });
    const blob = new Blob([csv], { type: 'text/csv' }); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Mobile_Hub_Monthly_Closing.csv`; a.click();
  };

  return (
    <div className="flex h-full gap-6 overflow-y-auto">
      <div className="w-1/3 card flex flex-col">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Cash Drawer</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-pink-50 p-3 rounded-lg text-center"><p className="text-xs text-gray-500">Actual Till Cash</p><p className="text-xl font-bold text-pink-500">£{actualTillCash.toFixed(2)}</p></div>
          <div className="bg-blue-50 p-3 rounded-lg text-center"><p className="text-xs text-gray-500">Envelope</p><p className="text-xl font-bold text-blue-500">£{envelopeBalance.toFixed(2)}</p></div>
        </div>
        <div className="bg-gray-900 text-white p-4 rounded-lg mb-6">
          <h4 className="text-sm font-bold mb-3 flex items-center justify-between"><span>🏦 Daily Till Balancing</span><span className="text-xs text-gray-400">Target: £{STANDARD_FLOAT.toFixed(2)}</span></h4>
          {shortfall > 0 ? (
            <div className="bg-red-900 bg-opacity-40 p-3 rounded-lg text-center"><p className="text-xs text-red-300">TILL IS SHORT!</p><p className="text-lg font-bold text-red-400">Shortfall: £{shortfall.toFixed(2)}</p><p className="text-xs text-gray-400 mt-1">Do NOT bank. Leave all cash in till.</p></div>
          ) : (
            <div className="bg-green-900 bg-opacity-40 p-3 rounded-lg text-center"><p className="text-xs text-green-300">Till is healthy! Bank this amount:</p><p className="text-2xl font-bold text-green-400">£{amountToBank.toFixed(2)}</p><button onClick={async () => { await axios.post('http://localhost:5000/api/cash', { type: 'bank-in', source: 'till', amount: amountToBank, note: 'Daily Banking' }); fetchData(); alert(`Banked £${amountToBank.toFixed(2)}`); }} className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-semibold text-sm">Confirm Bank In</button></div>
          )}
        </div>
        <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
          <h4 className="text-sm font-bold text-gray-700 mb-2">Monthly Closing</h4>
          <div className="text-xs space-y-1 text-gray-600">
            <div className="flex justify-between"><span>Till Paid Out:</span> <span className="font-medium text-red-500">£{monthlyTillPaidOut.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Envelope Paid Out:</span> <span className="font-medium text-red-500">£{monthlyEnvelopePaidOut.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Vendor Bills:</span> <span className="font-medium text-red-500">£{monthlyVendorBills.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-gray-300 mt-1 pt-1 font-bold text-gray-800"><span>Total Expenses:</span> <span>£{totalMonthlyExpenses.toFixed(2)}</span></div>
          </div>
          <button onClick={exportMonthlyReport} className="w-full mt-3 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-semibold text-sm">📥 Download Monthly Report</button>
        </div>
        <form onSubmit={handleCashSubmit} className="space-y-3 mb-6">
          <select value={cashForm.type} onChange={(e) => setCashForm({ ...cashForm, type: e.target.value })} className="input-field"><option value="float">Start Daily Float</option><option value="paid-in">Paid In (Add Cash)</option><option value="paid-out">Paid Out (Expense/Bill)</option><option value="bank-in">Bank In (Take Profit)</option><option value="refund">Refund (Minus Sale)</option></select>
          <select value={cashForm.source} onChange={(e) => setCashForm({ ...cashForm, source: e.target.value })} className="input-field"><option value="till">From Till</option><option value="envelope">From Envelope</option><option value="bank">From Bank</option></select>
          <input type="number" value={cashForm.amount} onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })} placeholder="Amount (£)" required className="input-field" />
          <input type="text" value={cashForm.note} onChange={(e) => setCashForm({ ...cashForm, note: e.target.value })} placeholder="Note (e.g., Biffa Waste, Water)" required className="input-field" />
          <button type="submit" className="btn-primary">Submit Transaction</button>
        </form>
      </div>
      <div className="flex-1 card">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Vendors & Monthly Bills</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <form onSubmit={handleVendorSubmit} className="flex gap-2"><input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="New Vendor Name" required className="input-field flex-1" /><button type="submit" className="btn-secondary">Add</button></form>
          <form onSubmit={handleBillSubmit} className="flex gap-2"><select value={billForm.vendorId} onChange={(e) => setBillForm({ ...billForm, vendorId: e.target.value })} required className="input-field"><option value="">Select Vendor</option>{vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}</select><input type="text" value={billForm.description} onChange={(e) => setBillForm({ ...billForm, description: e.target.value })} placeholder="Bill Desc." required className="input-field w-32" /><input type="number" value={billForm.amount} onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })} placeholder="£" required className="input-field w-20" /><button type="submit" className="btn-primary">Add Bill</button></form>
        </div>
        <div className="space-y-4 overflow-y-auto" style={{maxHeight: '500px'}}>
          {vendors.map(v => {
            const totalBills = v.bills.reduce((sum, b) => sum + b.amount, 0);
            return (
              <div key={v._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2"><h4 className="font-semibold text-gray-800">{v.name}</h4><span className="text-sm font-bold text-gray-600">Total: £{totalBills.toFixed(2)}</span></div>
                {v.bills.length === 0 ? <p className="text-xs text-gray-400">No bills recorded.</p> : (
                  <table className="w-full text-sm"><tbody>{v.bills.map(b => (<tr key={b._id} className="border-t border-gray-100"><td className="py-2 text-gray-600">{b.description}</td><td className="py-2 text-right text-gray-800">£{b.amount.toFixed(2)}</td><td className="py-2 text-right text-xs text-gray-400">{new Date(b.date).toLocaleDateString()}</td></tr>))}</tbody></table>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Accounts;