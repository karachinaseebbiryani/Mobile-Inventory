'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api, money, type Product, type Sale } from '@/lib/api';

interface Props {
  tenantId: string;
  onError: (message: string) => void;
}

export function PosRegister({ tenantId, onError }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'other'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [localError, setLocalError] = useState('');
  const checkoutInFlight = useRef(false);

  const loadProducts = useCallback(async (searchTerm = '') => {
    const params = new URLSearchParams({ limit: '100', posOnly: 'true' });
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    const result = await api<{ data: Product[] }>(`products?${params.toString()}`, {
      headers: { 'x-tenant-id': tenantId }
    });
    setProducts(result.data);
  }, [tenantId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => loadProducts()).catch(error => {
      if (active) onError(error instanceof Error ? error.message : 'Could not load POS products.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadProducts, onError]);

  const cartItems = useMemo(() => products
    .filter(product => cart[product._id])
    .map(product => ({ product, quantity: cart[product._id]! })), [cart, products]);
  const currency = cartItems[0]?.product.currency || products[0]?.currency || 'GBP';
  const totalMinor = cartItems.reduce((sum, item) => sum + item.product.sellingPriceMinor * item.quantity, 0);

  async function searchCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setLocalError('');
    try {
      await loadProducts(search);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not search products.');
    } finally {
      setLoading(false);
    }
  }

  function changeQuantity(product: Product, delta: number) {
    if (delta > 0 && cartItems.some(item => item.product.currency !== product.currency)) {
      setLocalError('Items in one sale must use the same currency.');
      return;
    }
    setLocalError('');
    setCart(previous => {
      const current = previous[product._id] || 0;
      const next = Math.min(product.quantityOnHand, current + delta);
      const updated = { ...previous };
      if (next <= 0) delete updated[product._id];
      else updated[product._id] = next;
      return updated;
    });
  }

  async function completeSale() {
    if (checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    setCheckout(true);
    setLocalError('');
    let sale: Sale;
    try {
      const result = await api<{ sale: Sale }>('sales', {
        method: 'POST',
        headers: { 'x-tenant-id': tenantId },
        body: JSON.stringify({
          items: cartItems.map(({ product, quantity }) => ({ productId: product._id, quantity })),
          paymentMethod,
          customerName: customerName.trim()
        })
      });
      sale = result.sale;
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not complete the sale.');
      checkoutInFlight.current = false;
      setCheckout(false);
      return;
    }
    setReceipt(sale);
    setCart({});
    setCustomerName('');
    try {
      await loadProducts(search);
    } catch (error) {
      setLocalError(`Sale completed, but stock could not be refreshed: ${error instanceof Error ? error.message : 'refresh failed.'}`);
    } finally {
      checkoutInFlight.current = false;
      setCheckout(false);
    }
  }

  return (
    <section className="pos-register">
      <div className="pos-heading">
        <div><div className="eyebrow">IN-STORE SALES</div><h2>Point of sale</h2><p>Checkout uses live shop pricing and deducts stock securely.</p></div>
        {receipt && <button className="button button-quiet" onClick={() => window.print()}>Print last receipt</button>}
      </div>
      {localError && <div className="notice notice-error" role="alert">{localError}</div>}
      {receipt && (
        <section className="pos-receipt" aria-label="Sale receipt">
          <div><div className="eyebrow">SALE COMPLETE</div><b>Receipt {receipt._id.slice(-8).toUpperCase()}</b><small>{new Date(receipt.createdAt).toLocaleString()}</small></div>
          <div>{receipt.items.map(item => <p key={item.productId}>{item.name} × {item.quantity}<span>{money(item.lineTotalMinor, receipt.currency)}</span></p>)}</div>
          <strong>Total <span>{money(receipt.totalMinor, receipt.currency)}</span></strong>
          <small>Paid by {receipt.paymentMethod}{receipt.customerName ? ` · ${receipt.customerName}` : ''}</small>
        </section>
      )}
      <div className="pos-layout">
        <section className="pos-catalogue">
          <form className="inventory-search" onSubmit={searchCatalog}><span>⌕</span><input aria-label="Find POS product" placeholder="Search by name, SKU or barcode…" value={search} onChange={event => setSearch(event.target.value)} /><button type="submit">Find</button></form>
          {loading ? <div className="table-empty">Loading products…</div> : products.length === 0 ? <div className="table-empty"><b>No products found.</b><p>Add products and stock in Inventory before checkout.</p></div> : (
            <div className="pos-product-grid">
              {products.map(product => <button className="pos-product" key={product._id} disabled={product.quantityOnHand < 1 || checkout} onClick={() => changeQuantity(product, 1)}>
                <span className="category-pill">{product.category}</span><b>{product.name}</b><small>{product.sku} · {product.quantityOnHand} in stock</small><strong>{money(product.sellingPriceMinor, product.currency)}</strong>
              </button>)}
            </div>
          )}
        </section>
        <aside className="pos-cart">
          <div className="eyebrow">CURRENT SALE</div><h3>Cart <span>{cartItems.reduce((sum, item) => sum + item.quantity, 0)}</span></h3>
          {cartItems.length === 0 ? <p className="pos-cart-empty">Select an in-stock product to begin.</p> : <div className="pos-cart-lines">{cartItems.map(({ product, quantity }) => <div className="pos-cart-line" key={product._id}>
            <div><b>{product.name}</b><small>{money(product.sellingPriceMinor, product.currency)} each</small></div>
            <div className="pos-quantity"><button aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product, -1)}>−</button><span>{quantity}</span><button aria-label={`Add one ${product.name}`} disabled={quantity >= product.quantityOnHand} onClick={() => changeQuantity(product, 1)}>+</button></div>
          </div>)}</div>}
          <label className="pos-field">Customer name <span className="optional">OPTIONAL</span><input maxLength={120} value={customerName} onChange={event => setCustomerName(event.target.value)} /></label>
          <label className="pos-field">Payment method<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as typeof paymentMethod)}><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select></label>
          <div className="pos-total"><span>Total</span><b>{money(totalMinor, currency)}</b></div>
          <button className="button pos-checkout" disabled={checkout || cartItems.length === 0} onClick={() => void completeSale()}>{checkout ? 'Completing sale…' : 'Complete sale'}</button>
        </aside>
      </div>
    </section>
  );
}
