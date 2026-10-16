import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SuperAdmin = () => {
  const [shops, setShops] = useState([]);
  const [form, setForm] = useState({ shopName: '', ownerName: '', phone: '', subscriptionExpiry: '' });

  const fetchShops = async () => { const res = await axios.get('http://localhost:5000/api/shops'); setShops(res.data); };
  useEffect(() => { fetchShops(); }, []);
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleCreate = async (e) => { e.preventDefault(); await axios.post('http://localhost:5000/api/shops', form); setForm({ shopName: '', ownerName: '', phone: '', subscriptionExpiry: '' }); fetchShops(); };

  return (
    <div className="flex h-full gap-6">
      <div className="w-1/3 card h-fit">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Add New Shop (Sell Subscription)</h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <input type="text" name="shopName" value={form.shopName} onChange={handleChange} placeholder="Shop Name" required className="input-field" />
          <input type="text" name="ownerName" value={form.ownerName} onChange={handleChange} placeholder="Owner Name" required className="input-field" />
          <input type="text" name="phone" value={form.phone} onChange={handleChange} placeholder="Owner Phone" required className="input-field" />
          <label className="text-xs text-gray-500 block">Subscription Expiry Date:</label>
          <input type="date" name="subscriptionExpiry" value={form.subscriptionExpiry} onChange={handleChange} required className="input-field" />
          <button type="submit" className="btn-primary">Generate Shop Code</button>
        </form>
      </div>
      <div className="flex-1 card overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">All Subscribed Shops</h3>
        <table className="w-full text-left">
          <thead><tr className="border-b text-sm text-gray-500"><th className="py-2">Shop Name</th><th className="py-2">Shop Code</th><th className="py-2">Expiry Date</th><th className="py-2">Status</th></tr></thead>
          <tbody>
            {shops.map(shop => {
              const isExpired = new Date(shop.subscriptionExpiry) < new Date();
              return (
                <tr key={shop._id} className="border-b text-sm">
                  <td className="py-3"><p className="font-medium text-gray-800">{shop.shopName}</p><p className="text-xs text-gray-400">{shop.ownerName} - {shop.phone}</p></td>
                  <td className="py-3 font-mono font-bold text-pink-500">{shop.shopCode}</td>
                  <td className="py-3 text-gray-600">{new Date(shop.subscriptionExpiry).toLocaleDateString()}</td>
                  <td className="py-3">{isExpired ? <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">Expired</span> : <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">Active</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SuperAdmin;