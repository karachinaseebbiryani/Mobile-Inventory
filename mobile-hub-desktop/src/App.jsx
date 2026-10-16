import React, { useState } from 'react';
import POS from './POS';
import Buy from './Buy';
import Repairs from './Repairs';
import Accounts from './Accounts';
import EndOfDay from './EndOfDay';
import Inventory from './Inventory';
import Devices from './Devices';
import AdminPanel from './AdminPanel';
import SuperAdmin from './SuperAdmin';
import Login from './Login';
import Dashboard from './Dashboard';
import History from './History';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeShop, setActiveShop] = useState(() => {
    const saved = localStorage.getItem('activeShop');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogout = () => {
    localStorage.removeItem('activeShop');
    setActiveShop(null);
  };

  if (!activeShop) return <Login onLogin={setActiveShop} />;

  const menuGroups = [
    {
      category: "Main",
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'pos', label: 'Point of Sale', icon: '🛒' },
        { id: 'buy', label: 'Buy / Trade-In', icon: '💵' },
      ]
    },
    {
      category: "Shop Management",
      items: [
        { id: 'repairs', label: 'Repair Bookings', icon: '🔧' },
        { id: 'inventory', label: 'Inventory', icon: '📦' },
        { id: 'devices', label: 'Devices', icon: '📱' },
        { id: 'history', label: 'History', icon: '📜' },
      ]
    },
    {
      category: "Accounts & Reports",
      items: [
        { id: 'endofday', label: 'End of Day Sheet', icon: '📅' },
        { id: 'accounts', label: 'Cash & Vendors', icon: '💰' },
      ]
    },
    {
      category: "System",
      items: [
        { id: 'settings', label: 'Settings', icon: '⚙️' },
        { id: 'superadmin', label: 'Super Admin', icon: '👑' },
      ]
    }
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-800">
      
      <div className="w-60 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-5 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-pink-500">Mobile Hub</h1>
          <p className="text-xs text-gray-400 mt-0.5">Shop Management System</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-2">
          {menuGroups.map((group, gIndex) => (
            <div key={gIndex}>
              <p className="sidebar-category">{group.category}</p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center px-4 py-2.5 mx-2 rounded-lg text-left text-sm transition-colors mb-0.5 ${
                    activeTab === item.id
                      ? 'bg-pink-50 text-pink-600 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  style={{ width: 'calc(100% - 1rem)' }}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="bg-green-50 text-green-700 p-2.5 rounded-lg text-xs font-medium text-center mb-2 border border-green-100">
            ✅ {activeShop.shopName}<br/>
            <span className="text-gray-400 font-normal">Exp: {new Date(activeShop.expiry).toLocaleDateString()}</span>
          </div>
          <button onClick={handleLogout} className="w-full bg-gray-50 hover:bg-gray-100 text-gray-500 py-2 rounded-lg text-xs font-medium border border-gray-200">
            Logout / Lock
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-700 capitalize">
            {activeTab === 'pos' ? 'Point of Sale' : activeTab === 'endofday' ? 'End of Day Sheet' : activeTab}
          </h2>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-400">Cashier: Admin</span>
            <div className="w-9 h-9 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'dashboard' && <Dashboard activeTab={activeTab} />}
          {activeTab === 'pos' && <POS />}
          {activeTab === 'buy' && <Buy />}
          {activeTab === 'repairs' && <Repairs />}
          {activeTab === 'inventory' && <Inventory />}
          {activeTab === 'devices' && <Devices />}
          {activeTab === 'history' && <History />}
          {activeTab === 'endofday' && <EndOfDay />}
          {activeTab === 'accounts' && <Accounts />}
          {activeTab === 'settings' && <AdminPanel />}
          {activeTab === 'superadmin' && <SuperAdmin />}
        </main>
      </div>
    </div>
  );
};

export default App;