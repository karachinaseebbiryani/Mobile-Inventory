import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const POS = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [customer, setCustomer] = useState(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const searchInputRef = useRef(null);
  const [settings, setSettings] = useState({ taxRate: 0, shopName: 'Mobile Hub', logoUrl: '', reviewQrUrl: '', currencySymbol: '£', receiptSettings: {}, mobileTerms: '', laptopTerms: '', buyTerms: '', universalTerms: '', useUniversalTerms: false });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('amount');
  const [receiptType, setReceiptType] = useState('mobile');

  useEffect(() => {
    axios.get('http://localhost:5000/api/products').then(res => { setProducts(res.data); setLoading(false); });
    axios.get('http://localhost:5000/api/admin').then(res => setSettings(res.data));
    searchInputRef.current?.focus();
  }, []);

  const addToCart = (product) => {
    const existingItem = cart.find(item => item._id === product._id);
    if (existingItem) setCart(cart.map(item => item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item));
    else setCart([...cart, { ...product, quantity: 1 }]);
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchTerm) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/products/sku/${searchTerm}`);
      if (res.data) { addToCart(res.data); setSearchTerm(''); }
    } catch (err) { setSearchTerm(''); }
  };

  const handleCustomerLookup = async (e) => {
    e.preventDefault();
    if (!customerPhone) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/customers/phone/${customerPhone}`);
      if (res.data) setCustomer(res.data); else setCustomer({ name: 'New Customer', phone: customerPhone });
    } catch (err) { setCustomer({ name: 'New Customer', phone: customerPhone }); }
  };

  const removeFromCart = (id) => setCart(cart.filter(item => item._id !== id));
  const totalAmount = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  const taxAmount = totalAmount * (settings.taxRate / 100);
  let discountAmount = discountType === 'percent' ? (totalAmount * (discount / 100)) : parseFloat(discount) || 0;
  if (discountAmount > totalAmount) discountAmount = totalAmount;
  const grandTotal = (totalAmount - discountAmount) + taxAmount;

  const openPrintPreview = (htmlContent) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(htmlContent); printWindow.document.close(); printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      let customerData = { name: 'Walk-in Customer', phone: '' };
      if (customer && customer.name === 'New Customer') {
        const custRes = await axios.post('http://localhost:5000/api/customers', { name: 'Retail Customer', phone: customerPhone });
        customerData = custRes.data;
      } else if (customer) { customerData = customer; }

      await axios.post('http://localhost:5000/api/sales', { items: cart, totalAmount: grandTotal, customerName: customerData.name, customerPhone: customerData.phone, paymentMethod, discount: discountAmount, type: 'sale' });

      // MARK DEVICES AS SOLD
      for (const item of cart) {
        if (item.type === 'Phone' || item.type === 'Laptop' || item.type === 'Tablet') {
          await axios.put(`http://localhost:5000/api/products/${item._id}/sell`);
        }
      }

      let receiptHTML = `<html><head><style>body { font-family: 'Courier New', monospace; width: 280px; margin: 0; padding: 10px; }.header { text-align: center; margin-bottom: 10px; }h1 { font-size: 18px; margin: 0; }.item { margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 8px; }.item-name { font-size: 13px; font-weight: bold; }.totals { margin-top: 10px; }.total-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }.grand-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-top: 1px solid #000; padding: 5px 0; margin-top: 5px; }</style></head><body><div class="header"><h1>${settings.shopName}</h1></div><p style="text-align:center; font-size:11px;">${new Date().toLocaleString()}</p><hr style="border-top: 1px dashed #ccc;">`;
      cart.forEach(item => {
        receiptHTML += `<div class="item"><div class="item-name">${item.name}</div>${item.imei ? `<div style="font-size:11px; color:#555;">S/N: ${item.imei}</div>` : ''}<div style="display:flex; justify-content:space-between; font-size:13px;"><span>Qty: ${item.quantity}</span><span>${settings.currencySymbol}${(item.sellingPrice * item.quantity).toFixed(2)}</span></div></div>`;
      });
      receiptHTML += `<div class="totals"><div class="total-row"><span>Subtotal:</span><span>${settings.currencySymbol}${totalAmount.toFixed(2)}</span></div>`;
      if (discountAmount > 0) receiptHTML += `<div class="total-row" style="color:red;"><span>Discount:</span><span>-${settings.currencySymbol}${discountAmount.toFixed(2)}</span></div>`;
      if (settings.taxRate > 0) receiptHTML += `<div class="total-row"><span>VAT (${settings.taxRate}%):</span><span>${settings.currencySymbol}${taxAmount.toFixed(2)}</span></div>`;
      receiptHTML += `<div class="grand-total"><span>TOTAL</span><span>${settings.currencySymbol}${grandTotal.toFixed(2)}</span></div><div style="text-align:center; font-weight:bold; margin:10px 0;">PAID VIA ${paymentMethod.toUpperCase()}</div></body></html>`;

      openPrintPreview(receiptHTML);
      setCart([]); setCustomer(null); setCustomerPhone(''); setDiscount(0);
      searchInputRef.current?.focus();
    } catch (err) { console.error("Error saving sale"); }
  };

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 card flex flex-col">
        <form onSubmit={handleSearchSubmit} className="mb-4">
          <input ref={searchInputRef} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Scan barcode or search SKU..." className="input-field text-lg" />
        </form>
        <div className="flex-1 overflow-y-auto">
          {loading ? <p className="text-gray-400 text-center py-8">Loading...</p> : (
            <div className="grid grid-cols-3 gap-4">
              {products.map((prod) => (
                <button key={prod._id} onClick={() => addToCart(prod)} className="border border-gray-200 rounded-lg p-4 hover:border-pink-400 hover:bg-pink-50 transition-colors text-left">
                  <div className="h-16 bg-gray-100 rounded-md mb-2 flex items-center justify-center text-2xl">📱</div>
                  <h4 className="font-medium text-gray-800 text-sm truncate">{prod.name}</h4>
                  <p className="text-pink-500 font-bold mt-1">{settings.currencySymbol}{prod.sellingPrice.toFixed(2)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-96 card flex flex-col">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-700">Sales Order</h3>
          <span className="text-xs text-gray-400">#{Date.now().toString().slice(-5)}</span>
        </div>
        <div className="mb-4 pb-4 border-b border-gray-100">
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Customer</h4>
          {customer ? (
            <div className="flex justify-between items-center bg-pink-50 p-2.5 rounded-lg">
              <div><p className="text-sm font-medium text-gray-800">{customer.name}</p><p className="text-xs text-gray-500">{customer.phone}</p></div>
              <button onClick={() => { setCustomer(null); setCustomerPhone(''); }} className="text-red-400 text-xs">Change</button>
            </div>
          ) : (
            <form onSubmit={handleCustomerLookup} className="flex gap-2">
              <input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone number..." className="input-field flex-1" />
              <button type="submit" className="btn-secondary">Check</button>
            </form>
          )}
        </div>
        <div className="flex-1 overflow-y-auto mb-4">
          {cart.length === 0 ? <p className="text-gray-400 text-center py-8 text-sm">No items added.</p> : (
            cart.map(item => (
              <div key={item._id} className="flex justify-between items-center border-b border-gray-100 py-2">
                <div className="flex-1">
                  <p className="font-medium text-gray-800 text-sm">{item.name}</p>
                  <p className="text-xs text-gray-400">S/N: {item.imei || 'N/A'} | Qty: {item.quantity}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800 text-sm">{settings.currencySymbol}{(item.sellingPrice * item.quantity).toFixed(2)}</span>
                  <button onClick={() => removeFromCart(item._id)} className="text-red-400 hover:text-red-600 text-lg">x</button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t-2 border-gray-200 pt-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <select value={receiptType} onChange={(e) => setReceiptType(e.target.value)} className="input-field">
              <option value="mobile">Mobile Sale T&C</option><option value="laptop">Laptop Sale T&C</option><option value="buy">Trade-In T&C</option>
            </select>
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className="input-field">
              <option value="amount">£ Off</option><option value="percent">% Off</option>
            </select>
          </div>
          <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Discount amount" className="input-field mb-3" />
          <div className="space-y-1 mb-4 bg-gray-50 p-3 rounded-lg">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-medium">{settings.currencySymbol}{totalAmount.toFixed(2)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-sm text-red-500"><span>Discount</span><span>-{settings.currencySymbol}{discountAmount.toFixed(2)}</span></div>}
            {settings.taxRate > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Tax ({settings.taxRate}%)</span><span>{settings.currencySymbol}{taxAmount.toFixed(2)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t border-gray-200 mt-1"><span>Total</span><span className="text-pink-500">{settings.currencySymbol}{grandTotal.toFixed(2)}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button onClick={() => setPaymentMethod('cash')} className={`py-2 rounded-lg font-semibold text-sm ${paymentMethod === 'cash' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Cash</button>
            <button onClick={() => setPaymentMethod('card')} className={`py-2 rounded-lg font-semibold text-sm ${paymentMethod === 'card' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Card</button>
            <button onClick={() => setPaymentMethod('bank-transfer')} className={`py-2 rounded-lg font-semibold text-sm ${paymentMethod === 'bank-transfer' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Bank</button>
          </div>
          <button onClick={handleCheckout} className="btn-primary" disabled={cart.length === 0}>Complete Sale & Print</button>
        </div>
      </div>
    </div>
  );
};

export default POS;