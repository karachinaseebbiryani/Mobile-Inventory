import React, { useState, useEffect } from 'react';
import axios from 'axios';
import POS from './POS';
import Repairs from './Repairs';
import Accounts from './Accounts';
import EndOfDay from './EndOfDay';
import Inventory from './Inventory';
import AdminPanel from './AdminPanel';
import SuperAdmin from './SuperAdmin';
import Login from './Login';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeShop, setActiveShop] = useState(() => {
    const saved = localStorage.getItem('activeShop');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const prodRes = await axios.get('http://localhost:5000/api/products');
        const repRes = await axios.get('http://localhost:5000/api/repairs');
        const salesRes = await axios.get('http://localhost:5000/api/sales');
        setProducts(prodRes.data);
        setRepairs(repRes.data);
        setSales(salesRes.data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    if (activeShop) fetchData();
  }, [activeShop]);

  const isToday = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const todaysSales = sales.filter(s => isToday(s.createdAt)).reduce((sum, s) => sum + s.totalAmount, 0);
  const activeRepairs = repairs.filter(r => r.status !== 'Delivered').length;
  const lowStock = products.filter(p => p.stockQuantity < 5).length;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'pos', label: 'Point of Sale', icon: '🛒' },
    { id: 'repairs', label: 'Repair Bookings', icon: '🔧' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'endofday', label: 'End of Day Sheet', icon: '📅' },
    { id: 'accounts', label: 'Accounts & Vendors', icon: '💰' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'superadmin', label: 'Super Admin', icon: '👑' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('activeShop');
    setActiveShop(null);
  };

  if (!activeShop) {
    return <Login onLogin={setActiveShop} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-800">
      
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-pink-500">Mobile Hub</h1>
          <p className="text-xs text-gray-500 mt-1">Shop Management System</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === item.id
                  ? 'bg-pink-400 text-white font-semibold shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="mr-3 text-xl">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="bg-green-100 text-green-700 p-3 rounded-lg text-xs font-medium text-center mb-2">
            ✅ Active: {activeShop.shopName}<br/>
            Expires: {new Date(activeShop.expiry).toLocaleDateString()}
          </div>
          <button onClick={handleLogout} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium">
            Logout / Lock
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold capitalize">
            {activeTab === 'pos' ? 'Point of Sale' : activeTab === 'endofday' ? 'End of Day Sheet' : activeTab}
          </h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">Cashier: Admin</span>
            <div className="w-10 h-10 bg-pink-400 rounded-full flex items-center justify-center text-white font-bold">
              A
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-gray-500 text-sm font-semibold mb-2">Today's Sales</h3>
                <p className="text-3xl font-bold text-pink-500">£{todaysSales.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-gray-500 text-sm font-semibold mb-2">Active Repairs</h3>
                <p className="text-3xl font-bold text-pink-500">{activeRepairs}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-gray-500 text-sm font-semibold mb-2">Low Stock Alerts</h3>
                <p className="text-3xl font-bold text-pink-500">{lowStock}</p>
              </div>
            </div>
          )}

          {activeTab === 'pos' && (<POS />)}
          {activeTab === 'repairs' && (<Repairs />)}
          {activeTab === 'inventory' && (<Inventory />)}
          {activeTab === 'endofday' && (<EndOfDay />)}
          {activeTab === 'accounts' && (<Accounts />)}
          {activeTab === 'settings' && (<AdminPanel />)}
          {activeTab === 'superadmin' && (<SuperAdmin />)}
        </main>
      </div>
    </div>
  );
};

export default App;