import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ onLogin }) => {
  const [shopCode, setShopCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await axios.post('http://localhost:5000/api/shops/validate', { shopCode });
      if (res.data.shop) {
        localStorage.setItem('activeShop', JSON.stringify(res.data.shop));
        onLogin(res.data.shop);
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 w-96">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-pink-500">Mobile Hub</h1>
          <p className="text-sm text-gray-500 mt-1">Shop Management System</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Enter Shop Code</label>
            <input type="text" value={shopCode} onChange={(e) => setShopCode(e.target.value)} required className="w-full border-2 border-gray-200 rounded-lg p-3 text-center text-2xl tracking-widest focus:outline-none focus:border-pink-400" placeholder="123456" />
          </div>
          {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-pink-500 hover:bg-pink-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50">{loading ? 'Validating...' : 'Unlock Software'}</button>
        </form>
        <p className="text-xs text-gray-400 text-center mt-4">Don't have a code? Contact your software provider.</p>
      </div>
    </div>
  );
};

export default Login;