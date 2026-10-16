import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Dashboard = ({ activeTab }) => {
  const [sales, setSales] = useState([]);
  const [cashTrans, setCashTrans] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPrivate, setIsPrivate] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [dashboardPin, setDashboardPin] = useState('1234');
  const [timer, setTimer] = useState(null);
  const [dateFilter, setDateFilter] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [salesRes, cashRes, repRes, prodRes, adminRes] = await Promise.all([
          axios.get('http://localhost:5000/api/sales'), axios.get('http://localhost:5000/api/cash'),
          axios.get('http://localhost:5000/api/repairs'), axios.get('http://localhost:5000/api/products'),
          axios.get('http://localhost:5000/api/admin')
        ]);
        setSales(salesRes.data); setCashTrans(cashRes.data); setRepairs(repRes.data); setProducts(prodRes.data);
        setDashboardPin(adminRes.data.dashboardPin || '1234'); setLoading(false);
      } catch (err) { console.error(err); setLoading(false); }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab !== 'dashboard' && !isPrivate) { setIsPrivate(true); setPinInput(''); }
  }, [activeTab, isPrivate]);

  useEffect(() => {
    if (!isPrivate) {
      setTimer(setTimeout(() => { setIsPrivate(true); setPinInput(''); }, 60000));
    } else { if (timer) clearTimeout(timer); }
    return () => { if (timer) clearTimeout(timer); };
  }, [isPrivate]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pinInput === dashboardPin) { setIsPrivate(false); setShowPrompt(false); setPinInput(''); }
    else { alert("Incorrect PIN!"); setPinInput(''); }
  };
  const togglePrivacy = () => isPrivate ? setShowPrompt(true) : setIsPrivate(true);

  const isInPeriod = (dateStr) => {
    const date = new Date(dateStr); const today = new Date();
    if (dateFilter === 'today') return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    if (dateFilter === 'month') return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    if (dateFilter === 'custom' && customStart && customEnd) {
      const start = new Date(customStart); start.setHours(0,0,0,0); const end = new Date(customEnd); end.setHours(23,59,59,999);
      return date >= start && date <= end;
    }
    return false;
  };

  const periodSales = sales.filter(s => isInPeriod(s.createdAt) && s.type !== 'buy').reduce((sum, s) => sum + s.totalAmount, 0);
  const periodExpenses = cashTrans.filter(t => isInPeriod(t.date) && (t.type === 'paid-out' || t.type === 'refund')).reduce((sum, t) => sum + t.amount, 0);
  const activeRepairs = repairs.filter(r => r.status !== 'Delivered').length;
  const lowStock = products.filter(p => p.stockQuantity < 5).length;

  let chartData = []; let maxChartVal = 1;
  if (dateFilter === 'today') {
    const hours = Array.from({ length: 13 }, (_, i) => i + 8);
    chartData = hours.map(hour => ({ label: hour === 12 ? '12P' : hour > 12 ? `${hour-12}P` : `${hour}A`, total: sales.filter(s => isInPeriod(s.createdAt) && new Date(s.createdAt).getHours() === hour).reduce((sum, s) => sum + s.totalAmount, 0) }));
  } else {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    chartData = Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => ({ label: `${day}`, total: sales.filter(s => isInPeriod(s.createdAt) && new Date(s.createdAt).getDate() === day).reduce((sum, s) => sum + s.totalAmount, 0) }));
  }
  maxChartVal = Math.max(...chartData.map(d => d.total), 1);

  if (loading) return <p className="text-gray-400 text-center py-8">Loading Dashboard...</p>;

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex gap-3 items-center">
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="input-field w-40">
            <option value="today">Today</option><option value="month">This Month</option><option value="custom">Custom Range</option>
          </select>
          {dateFilter === 'custom' && (
            <div className="flex gap-2 items-center">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input-field w-40" />
              <span className="text-gray-400">to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input-field w-40" />
            </div>
          )}
        </div>
        <button onClick={togglePrivacy} className="bg-white p-2 rounded-lg shadow-sm border border-gray-200 text-gray-500 hover:text-pink-500 text-sm font-medium">
          {isPrivate ? '👁️ Show Figures' : '🙈 Hide Figures'}
        </button>
      </div>

      {showPrompt && (
        <div className="absolute inset-0 bg-white bg-opacity-95 z-20 flex items-center justify-center rounded-xl">
          <form onSubmit={handleUnlock} className="text-center p-8 border border-gray-200 rounded-xl shadow-lg">
            <h3 className="text-lg font-bold text-gray-700 mb-4">🔒 Enter PIN to View Figures</h3>
            <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} autoFocus className="input-field text-center text-2xl tracking-widest w-40 mb-4" placeholder="****" />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowPrompt(false); setPinInput(''); }} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1">Unlock</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-xs font-semibold uppercase mb-2">Total Sales</h3>
          <p className={`text-3xl font-bold text-green-500 transition-all duration-300 ${isPrivate ? 'blur-sm select-none' : ''}`}>£{periodSales.toFixed(2)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-xs font-semibold uppercase mb-2">Total Expenses</h3>
          <p className={`text-3xl font-bold text-red-500 transition-all duration-300 ${isPrivate ? 'blur-sm select-none' : ''}`}>£{periodExpenses.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div><h3 className="text-gray-500 text-xs font-semibold uppercase mb-1">Active Repairs</h3><p className="text-2xl font-bold text-blue-500">{activeRepairs}</p></div>
          <span className="text-3xl">🔧</span>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div><h3 className="text-gray-500 text-xs font-semibold uppercase mb-1">Low Stock Alerts</h3><p className="text-2xl font-bold text-red-400">{lowStock}</p></div>
          <span className="text-3xl">📦</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">{dateFilter === 'today' ? "Today's Hourly Sales" : "Daily Sales Breakdown"}</h3>
        <div className={`flex items-end justify-between h-48 border-b border-gray-200 space-x-1 ${isPrivate ? 'blur-sm select-none' : ''}`}>
          {chartData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative group">
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 z-10 whitespace-nowrap">£{d.total.toFixed(2)}</div>
              <div className="w-full bg-pink-400 rounded-t-sm hover:bg-pink-500 transition-all duration-300" style={{ height: `${(d.total / maxChartVal) * 100}%`, minHeight: d.total > 0 ? '4px' : '0px' }}></div>
              <span className="text-xs text-gray-400 mt-2">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;