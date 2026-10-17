'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, money, productPrice, type ApiError, type Plan, type Product, type Shop, type StorefrontProfile } from '@/lib/api';
import { StorefrontSettings } from '@/components/storefront-settings';

interface Session {
  user: { id: string; name: string; email: string; platformRole: string; emailVerified: boolean };
  shops: Shop[];
  applications: Array<{ id: string; status: string; reviewedAt?: string | null; rejectionReason?: string | null }>;
}

interface SubscriptionInfo {
  status: string;
  billingInterval: string;
  currentPeriodEnd?: string | null;
  planId?: { name: string; monthlyPriceMinor: number; yearlyPriceMinor: number; currency: string } | string;
}

interface ProductFormValues {
  sku: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  description: string;
  cost: string;
  selling: string;
  currency: string;
  reorder: string;
}

const blankProduct: ProductFormValues = {
  sku: '', name: '', brand: '', model: '', category: 'Phones', description: '',
  cost: '', selling: '', currency: 'GBP', reorder: '0'
};

export function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [profileName, setProfileName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [productPage, setProductPage] = useState(1);
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'storefront' | 'subscription' | 'admin'>('overview');
  const [storefrontProfile, setStorefrontProfile] = useState<StorefrontProfile | null>(null);
  const [ecommerceEnabled, setEcommerceEnabled] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormValues>(blankProduct);
  const [confirmArchive, setConfirmArchive] = useState<Product | null>(null);

  const isSuperAdmin = session?.user.platformRole === 'super_admin';
  const activeApplication = useMemo(() => session?.applications[0] ?? null, [session]);

  const fetchProducts = useCallback(async (tenantId: string, searchTerm = '', page = 1) => {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (searchTerm) params.set('search', searchTerm);
    const searchParam = `?${params.toString()}`;
    const result = await api<{ data: Product[]; pagination: { page: number; total: number } }>(`products${searchParam}`, {
      headers: { 'x-tenant-id': tenantId }
    });
    setProducts(result.data);
    setProductTotal(result.pagination.total);
    setProductPage(result.pagination.page);
  }, []);

  const loadShop = useCallback(async (selected: Shop) => {
    setLoading(true);
    setError('');
    setShop(selected);
    setStorefrontProfile(null);
    setEcommerceEnabled(false);
    sessionStorage.setItem('activeShopId', selected.id);
    try {
      const result = await api<{ subscription: SubscriptionInfo | null }>('shop/subscription', {
        headers: { 'x-tenant-id': selected.id }
      });
      setSubscription(result.subscription);
      setProfileName(selected.name);
      setProducts([]);
      setProductTotal(0);
      setInventoryEnabled(false);
      if (result.subscription && ['active', 'trialing'].includes(result.subscription.status)) {
        const [profile, featureResult] = await Promise.all([
          api<{ shop: StorefrontProfile }>('shop/profile', {
            headers: { 'x-tenant-id': selected.id }
          }),
          api<{ features: Record<string, boolean> }>('shop/features', {
            headers: { 'x-tenant-id': selected.id }
          })
        ]);
        setStorefrontProfile(profile.shop);
        setProfileName(profile.shop.branding?.displayName || profile.shop.name);
        setInventoryEnabled(featureResult.features.inventory === true);
        setEcommerceEnabled(featureResult.features.ecommerce === true);
        if (featureResult.features.inventory) await fetchProducts(selected.id);
      }
    } catch (loadError) {
      const apiError = loadError as ApiError;
      if (apiError.status === 401) {
        router.replace('/login');
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Could not load this shop.');
    } finally {
      setLoading(false);
    }
  }, [fetchProducts, router]);

  useEffect(() => {
    let alive = true;
    api<Session>('auth/me')
      .then(result => {
        if (!alive) return;
        setSession(result);
        if (result.shops.length) {
          const savedId = sessionStorage.getItem('activeShopId');
          const selected = result.shops.find(item => item.id === savedId) ?? result.shops[0];
          void loadShop(selected);
        } else if (result.user.platformRole === 'super_admin') {
          setLoading(false);
        } else {
          setLoading(false);
        }
      })
      .catch(loadError => {
        if (!alive) return;
        if ((loadError as ApiError).status === 401) router.replace('/login');
        else {
          setError(loadError instanceof Error ? loadError.message : 'Could not verify your session.');
          setLoading(false);
        }
      });
    return () => { alive = false; };
  }, [loadShop, router]);

  async function logout() {
    await api('auth/logout', { method: 'POST' });
    sessionStorage.removeItem('activeShopId');
    router.replace('/login');
  }

  async function searchProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(search.trim());
    if (!shop || !inventoryEnabled) return;
    setLoading(true);
    try {
      await fetchProducts(shop.id, search.trim(), 1);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  }

  async function changeProductPage(page: number) {
    if (!shop) return;
    setLoading(true);
    try {
      await fetchProducts(shop.id, query, page);
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Could not load this page of products.');
    } finally {
      setLoading(false);
    }
  }

  function startNewProduct() {
    setEditing(null);
    setForm({ ...blankProduct, currency: shopCurrency(subscription, storefrontProfile) });
    setError('');
  }

  function startEditProduct(product: Product) {
    setEditing(product);
    setForm({
      sku: product.sku, name: product.name, brand: product.brand || '', model: product.model || '',
      category: product.category, description: product.description || '',
      cost: (product.costPriceMinor / 100).toFixed(2),
      selling: (product.sellingPriceMinor / 100).toFixed(2),
      currency: product.currency, reorder: String(product.reorderLevel)
    });
    setError('');
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shop) return;
    const cost = Math.round(Number(form.cost) * 100);
    const selling = Math.round(Number(form.selling) * 100);
    if (!Number.isSafeInteger(cost) || !Number.isSafeInteger(selling) || cost < 0 || selling < 0) {
      setError('Enter valid non-negative prices with up to two decimal places.');
      return;
    }
    const reorderLevel = Number(form.reorder);
    if (!Number.isSafeInteger(reorderLevel) || reorderLevel < 0) {
      setError('The reorder alert must be a non-negative whole number.');
      return;
    }
    if (!editing && !/^[A-Z]{3}$/.test(form.currency)) {
      setError('Enter a valid three-letter currency code, such as GBP.');
      return;
    }
    setSaving(true);
    setError('');
    const body = {
      ...(editing ? {} : { sku: form.sku }),
      name: form.name,
      brand: form.brand,
      model: form.model,
      category: form.category,
      description: form.description,
      costPriceMinor: cost,
      sellingPriceMinor: selling,
      ...(editing ? {} : { currency: form.currency }),
      reorderLevel
    };
    try {
      if (editing) {
        await api(`products/${editing._id}`, { method: 'PATCH', headers: { 'x-tenant-id': shop.id }, body: JSON.stringify(body) });
      } else {
        await api('products', { method: 'POST', headers: { 'x-tenant-id': shop.id }, body: JSON.stringify(body) });
      }
      setEditing(null);
      setForm(blankProduct);
      await fetchProducts(shop.id, query, editing ? productPage : 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this product.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct() {
    if (!shop || !confirmArchive) return;
    setSaving(true);
    try {
      await api(`products/${confirmArchive._id}`, { method: 'DELETE', headers: { 'x-tenant-id': shop.id } });
      setConfirmArchive(null);
      const lastPageAfterArchive = Math.max(1, Math.ceil((productTotal - 1) / 25));
      await fetchProducts(shop.id, query, Math.min(productPage, lastPageAfterArchive));
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Could not archive this product.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !session) return <div className="dashboard-loading"><span className="loading-spinner" />Loading your shop…</div>;
  if (!session) return <div className="dashboard-loading"><span className="loading-spinner" />Checking your sign-in…</div>;
  const displayName = profileName || shop?.name || session.user.name;
  const firstName = session.user.name.split(' ')[0];

  const headerTitle = activeTab === 'admin'
    ? 'Shop applications'
    : activeTab === 'inventory'
      ? 'Inventory'
      : activeTab === 'subscription'
        ? 'Your plan'
        : activeTab === 'storefront'
          ? 'Storefront settings'
        : 'Your shop, at a glance.';

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand-lockup dashboard-brand" href="/">
          <span className="brand-mark">M</span>
          <span>mobile<span className="brand-accent">hub</span></span>
        </Link>
        {shop && session.shops.length > 1 && (
          <label className="shop-switcher">
            <small>YOUR SHOPS</small>
            <select
              value={shop.id}
              onChange={event => {
                const next = session.shops.find(item => item.id === event.target.value);
                if (next) void loadShop(next);
              }}
            >
              {session.shops.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        <div className="dashboard-nav-label">WORKSPACE</div>
        <nav className="dashboard-nav">
          {shop && (
            <>
              <button className={activeTab === 'overview' ? 'selected' : ''} onClick={() => setActiveTab('overview')}>
                <span>◫</span>Overview
              </button>
              <button className={activeTab === 'inventory' ? 'selected' : ''} onClick={() => setActiveTab('inventory')}>
                <span>▦</span>Inventory{inventoryEnabled && <i className="nav-count">{productTotal}</i>}
              </button>
              <button className={activeTab === 'storefront' ? 'selected' : ''} onClick={() => setActiveTab('storefront')}>
                <span>↗</span>Customer storefront
              </button>
              <button className={activeTab === 'subscription' ? 'selected' : ''} onClick={() => setActiveTab('subscription')}>
                <span>◷</span>Plan & subscription
              </button>
            </>
          )}
          {isSuperAdmin && (
            <button className={activeTab === 'admin' ? 'selected' : ''} onClick={() => setActiveTab('admin')}>
              <span>♧</span>Shop applications
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-profile">
            <span className="profile-avatar">{session.user.name.slice(0, 1).toUpperCase()}</span>
            <div><b>{session.user.name}</b><small>{session.user.email}</small></div>
            <button aria-label="Sign out" onClick={logout}>↗</button>
          </div>
          <div className="sidebar-foot">A LITTLE MORE ROOM TO GROW. <span>✳</span></div>
        </div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <span className="breadcrumb">YOUR WORKSPACE <i>/</i> {activeTab === 'admin' ? 'APPLICATIONS' : activeTab.toUpperCase()}</span>
            <h1>{headerTitle}</h1>
          </div>
          <div className="header-right">
            {shop && <span className={`shop-status status-${shop.status}`}>{shop.status === 'active' ? '●' : '○'} {shop.status.replace('_', ' ')}</span>}
            <button className="icon-button" aria-label="Sign out" onClick={logout}>↗</button>
          </div>
        </header>
        <div className="dashboard-content">
          {error && (
            <div className="dashboard-alert" role="alert">
              <span>!</span>{error}
              <button onClick={() => setError('')} aria-label="Dismiss">×</button>
            </div>
          )}
          {!shop && !isSuperAdmin && <ApplicationState application={activeApplication} />}
          {!shop && isSuperAdmin && activeTab !== 'admin' && (
            <div className="empty-workspace">
              <span>✳</span>
              <h2>Welcome to your control room.</h2>
              <p>Review shop applications and manage the next shops to join Mobile Hub.</p>
              <button className="button" onClick={() => setActiveTab('admin')}>View applications <span>↗</span></button>
            </div>
          )}
          {shop && activeTab === 'overview' && (
            <Overview
              name={displayName}
              firstName={firstName}
              shop={shop}
              subscription={subscription}
              productTotal={productTotal}
              inventoryEnabled={inventoryEnabled}
              products={products}
              onInventory={() => setActiveTab('inventory')}
            />
          )}
          {shop && activeTab === 'inventory' && (
            <section className="inventory-section">
              <div className="inventory-toolbar">
                <div><div className="eyebrow">YOUR CATALOGUE</div><p>Products in this shop stay private to this shop.</p></div>
                {inventoryEnabled && <button className="button" onClick={startNewProduct}>＋ Add product</button>}
              </div>
              {!subscription || !['active', 'trialing'].includes(subscription.status) ? (
                <div className="inline-empty">
                  <span>◷</span><b>Your shop needs an active plan to use inventory.</b>
                  <button className="text-link" onClick={() => setActiveTab('subscription')}>View plan status →</button>
                </div>
              ) : !inventoryEnabled ? (
                <div className="inline-empty">
                  <span>▦</span><b>Inventory isn’t included in your current plan.</b>
                  <button className="text-link" onClick={() => setActiveTab('subscription')}>View plan details →</button>
                </div>
              ) : (
                <>
                  <form className="inventory-search" onSubmit={searchProducts}>
                    <span>⌕</span>
                    <input aria-label="Search catalogue" placeholder="Search by product, SKU or model…" value={search} onChange={event => setSearch(event.target.value)} />
                    <button type="submit">Search</button>
                  </form>
                  <div className="product-table-wrap">
                    <table className="product-table">
                      <thead>
                        <tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>COST</th><th>SELLING PRICE</th><th /></tr>
                      </thead>
                      <tbody>
                        {products.map(product => (
                          <tr key={product._id}>
                            <td>
                              <div className="product-title">
                                <span className="product-thumb">▯</span>
                                <div><b>{product.name}</b><small>{[product.brand, product.model].filter(Boolean).join(' · ') || product.description || '—'}</small></div>
                              </div>
                            </td>
                            <td><code>{product.sku}</code></td>
                            <td><span className="category-pill">{product.category}</span></td>
                            <td>{productPrice(product.costPriceMinor, product.currency)}</td>
                            <td className="price-strong">{productPrice(product.sellingPriceMinor, product.currency)}</td>
                            <td>
                              <div className="row-actions">
                                <button onClick={() => startEditProduct(product)}>Edit</button>
                                <button onClick={() => setConfirmArchive(product)} aria-label={`Archive ${product.name}`}>···</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {products.length === 0 && (
                      <div className="table-empty">
                        <span>▦</span>
                        <b>{query ? 'No products match that search.' : 'Your catalogue is ready when you are.'}</b>
                        <p>{query ? 'Try another name, SKU or model.' : 'Add your first product to get started.'}</p>
                        {!query && <button className="button button-small" onClick={startNewProduct}>＋ Add your first product</button>}
                      </div>
                    )}
                  </div>
                  <div className="table-footer">
                    <span>
                      Showing {productTotal === 0 ? 0 : (productPage - 1) * 25 + 1}–{Math.min(productPage * 25, productTotal)}
                      {' '}of {productTotal} active {productTotal === 1 ? 'product' : 'products'}
                    </span>
                    <div className="pagination-controls">
                      <span>Prices are stored in minor units for accuracy.</span>
                      {productTotal > 25 && (
                        <>
                          <button disabled={productPage === 1 || loading} onClick={() => void changeProductPage(productPage - 1)}>← Previous</button>
                          <span>Page {productPage} of {Math.ceil(productTotal / 25)}</span>
                          <button disabled={productPage >= Math.ceil(productTotal / 25) || loading} onClick={() => void changeProductPage(productPage + 1)}>Next →</button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
          {shop && activeTab === 'subscription' && <SubscriptionPanel subscription={subscription} shop={shop} />}
          {shop && activeTab === 'storefront' && storefrontProfile && (
            <StorefrontSettings
              key={shop.id}
              tenantId={shop.id}
              shop={storefrontProfile}
              ecommerceEnabled={ecommerceEnabled}
              onSaved={setStorefrontProfile}
            />
          )}
          {shop && activeTab === 'storefront' && !storefrontProfile && (
            <div className="inline-empty"><span>◷</span><b>Your shop needs an active plan before storefront settings are available.</b><button className="text-link" onClick={() => setActiveTab('subscription')}>View plan status →</button></div>
          )}
          {activeTab === 'admin' && isSuperAdmin && <AdminApplications />}
        </div>
      </section>
      {(editing !== null || form !== blankProduct) && (
        <ProductDialog
          editing={editing}
          form={form}
          saving={saving}
          onChange={setForm}
          onClose={() => { setEditing(null); setForm(blankProduct); }}
          onSubmit={saveProduct}
        />
      )}
      {confirmArchive && (
        <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmArchive(null); }}>
          <section className="confirm-card" role="dialog" aria-modal="true" aria-labelledby="archive-title">
            <div className="modal-close-row">
              <span className="eyebrow">REMOVE FROM CATALOGUE</span>
              <button onClick={() => setConfirmArchive(null)} aria-label="Close">×</button>
            </div>
            <h2 id="archive-title">Archive {confirmArchive.name}?</h2>
            <p>This product will be hidden from the active catalogue. Its record is retained.</p>
            <div className="dialog-actions">
              <button className="button button-quiet" onClick={() => setConfirmArchive(null)}>Keep product</button>
              <button className="button button-danger" disabled={saving} onClick={archiveProduct}>{saving ? 'Archiving…' : 'Archive product'}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function shopCurrency(subscription: SubscriptionInfo | null, shop: StorefrontProfile | null): string {
  if (shop?.businessSettings?.currency) return shop.businessSettings.currency;
  const plan = subscription?.planId;
  return typeof plan === 'object' && plan ? plan.currency : 'GBP';
}

function ApplicationState({ application }: { application: Session['applications'][number] | null }) {
  if (!application) return <div className="empty-workspace"><span>✳</span><h2>Welcome to Mobile Hub.</h2><p>Your account is ready. Once you apply to open a shop, you can track its review here.</p><Link className="button" href="/signup">Apply to open a shop <span>↗</span></Link></div>;
  const statusText: Record<string, string> = { pending: 'Your shop application is being reviewed.', approved: 'Your shop is approved. Sign out and sign back in to refresh your workspace.', rejected: 'Your shop application was not approved.' };
  const status = application.status;
  return <div className="application-state"><div className={`application-icon app-${status}`}>{status === 'pending' ? '◷' : status === 'approved' ? '✓' : '!'}</div><div className="eyebrow">SHOP APPLICATION</div><h2>{status === 'pending' ? 'We’re reviewing your shop.' : status === 'approved' ? 'You’re approved.' : 'Application update'}</h2><p>{statusText[status] || `Application status: ${status}.`}</p>{status === 'pending' && <div className="application-steps"><span className="done">✓</span><div><b>Email verified</b><small>Your email address is confirmed.</small></div><i /><span className="current">2</span><div><b>Application review</b><small>We’ll review your shop details and selected plan.</small></div><i /><span>3</span><div><b>Your workspace</b><small>We’ll let you know when it’s ready.</small></div></div>}{status === 'rejected' && application.rejectionReason && <div className="notice notice-error">{application.rejectionReason}</div>}</div>;
}

function Overview({ name, firstName, shop, subscription, productTotal, inventoryEnabled, products, onInventory }: { name: string; firstName: string; shop: Shop; subscription: SubscriptionInfo | null; productTotal: number; inventoryEnabled: boolean; products: Product[]; onInventory: () => void }) {
  const plan = typeof subscription?.planId === 'object' ? subscription.planId : null;
  const lowStock = products.filter(item => item.reorderLevel > 0).length;
  return <><div className="welcome-banner"><div className="welcome-orbit">✳</div><div><div className="eyebrow">A FRESH START</div><h2>Good to have you here, {firstName}.</h2><p>Your {name} workspace is ready to make the day run a little smoother.</p></div><span className="welcome-date">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span></div><div className="overview-heading"><div><div className="eyebrow">SHOP OVERVIEW</div><h2>The essentials, at a glance.</h2></div><span className="overview-slug">Shop slug: {shop.slug}</span></div><div className="stat-grid"><article className="stat-card"><span className="stat-icon green">▦</span><small>ACTIVE PRODUCTS</small><b>{inventoryEnabled ? productTotal : '—'}</b><span>{inventoryEnabled ? 'In your shop catalogue' : 'Not included in current plan'}</span></article><article className="stat-card"><span className="stat-icon lilac">◷</span><small>YOUR PLAN</small><b className="stat-plan">{plan?.name || subscription?.status || 'Pending'}</b><span>{subscription?.status === 'trialing' ? 'Trial period' : subscription?.status === 'active' ? 'Shop subscription' : 'Waiting for approval'}</span></article><article className="stat-card"><span className="stat-icon peach">⌁</span><small>SHOP STATUS</small><b className="stat-plan">{shop.status.replace('_', ' ')}</b><span>Your workspace status</span></article><article className="stat-card"><span className="stat-icon blue">↗</span><small>LOW STOCK RULES</small><b>{inventoryEnabled ? lowStock : '—'}</b><span>{inventoryEnabled ? 'Products with reorder levels' : 'Inventory is not enabled'}</span></article></div><div className="overview-lower"><section className="overview-card"><div className="overview-card-head"><div><div className="eyebrow">RECENT CATALOGUE</div><h3>Your latest products</h3></div><button className="text-link" onClick={onInventory}>View inventory →</button></div>{inventoryEnabled && products.length ? products.slice(0, 4).map(product => <div className="recent-product" key={product._id}><span className="product-thumb">▯</span><div><b>{product.name}</b><small>{product.sku} · {product.category}</small></div><span className="recent-price">{productPrice(product.sellingPriceMinor, product.currency)}</span></div>) : <div className="recent-empty"><span>▦</span><p>{inventoryEnabled ? 'Add a product and it will show up here.' : 'Your plan will determine which shop tools are available.'}</p></div>}</section><section className="overview-card plan-summary"><div className="eyebrow">A LITTLE MORE ROOM TO GROW</div><h3>{plan?.name || 'Your shop is getting ready.'}</h3><p>{subscription?.status === 'active' || subscription?.status === 'trialing' ? 'Your shop tools are ready. Your plan helps shape what you can use.' : 'We’ll let you know when your application is reviewed and your workspace is ready.'}</p><div className="plan-summary-foot"><span className={`status-dot status-${subscription?.status || 'pending'}`} />{subscription?.status || 'application pending'}<button onClick={onInventory}>Explore tools →</button></div></section></div></>;
}

function SubscriptionPanel({ subscription, shop }: { subscription: SubscriptionInfo | null; shop: Shop }) {
  const plan = typeof subscription?.planId === 'object' ? subscription.planId : null;
  return <section className="subscription-section"><div className="eyebrow">SHOP PLAN & BILLING</div><h2>Plan details</h2><p className="section-subtitle">Review the plan assigned to {shop.name}. For now, subscription changes are managed by the Mobile Hub team.</p><div className="subscription-card"><div className="subscription-card-top"><span className="plan-feature-icon">✳</span><span className={`shop-status status-${subscription?.status || 'pending'}`}>{subscription?.status || 'pending'}</span></div><div className="eyebrow">CURRENT PLAN</div><h3>{plan?.name || 'Awaiting plan assignment'}</h3><p>{plan ? `${money(plan.monthlyPriceMinor, plan.currency)} per month · ${money(plan.yearlyPriceMinor, plan.currency)} per year` : 'A plan will be assigned when your shop application is approved.'}</p><div className="subscription-details"><div><small>SHOP</small><b>{shop.name}</b></div><div><small>STATUS</small><b>{subscription?.status || 'Pending review'}</b></div><div><small>BILLING INTERVAL</small><b>{subscription?.billingInterval || 'Not assigned'}</b></div><div><small>RENEWAL / PERIOD END</small><b>{subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'Not scheduled'}</b></div></div></div><div className="notice notice-info"><span>ⓘ</span><p>Online payment and self-service plan changes are not connected yet. Contact your super administrator for subscription updates.</p></div></section>;
}

function ProductDialog({ editing, form, saving, onChange, onClose, onSubmit }: { editing: Product | null; form: ProductFormValues; saving: boolean; onChange: (value: ProductFormValues) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title"><div className="modal-close-row"><div><div className="eyebrow">{editing ? 'UPDATE YOUR CATALOGUE' : 'ADD TO YOUR CATALOGUE'}</div><h2 id="product-dialog-title">{editing ? 'Edit product.' : 'Add a product.'}</h2></div><button onClick={onClose} aria-label="Close">×</button></div><form onSubmit={onSubmit}><div className="form-row">{!editing && <label>SKU<input required maxLength={64} value={form.sku} onChange={event => onChange({ ...form, sku: event.target.value })} placeholder="e.g. IPH-13-128" /></label>}<label>Product name<input required maxLength={160} value={form.name} onChange={event => onChange({ ...form, name: event.target.value })} placeholder="e.g. iPhone 13, 128GB" /></label></div><div className="form-row"><label>Brand<input maxLength={100} value={form.brand} onChange={event => onChange({ ...form, brand: event.target.value })} placeholder="Apple" /></label><label>Model<input maxLength={100} value={form.model} onChange={event => onChange({ ...form, model: event.target.value })} placeholder="A2633" /></label></div><div className="form-row"><label>Category<input required maxLength={100} value={form.category} onChange={event => onChange({ ...form, category: event.target.value })} placeholder="Phones" /></label><label>Reorder alert at<input required type="number" min="0" step="1" value={form.reorder} onChange={event => onChange({ ...form, reorder: event.target.value })} /></label></div><label>Description <span className="optional">OPTIONAL</span><textarea maxLength={2000} rows={2} value={form.description} onChange={event => onChange({ ...form, description: event.target.value })} placeholder="Condition, storage, colour or other details" /></label><div className="form-row"><label>Cost price<input required type="number" min="0" step="0.01" value={form.cost} onChange={event => onChange({ ...form, cost: event.target.value })} placeholder="0.00" /></label><label>Selling price<input required type="number" min="0" step="0.01" value={form.selling} onChange={event => onChange({ ...form, selling: event.target.value })} placeholder="0.00" /></label>{!editing && <label>Currency<input required minLength={3} maxLength={3} value={form.currency} onChange={event => onChange({ ...form, currency: event.target.value.toUpperCase() })} /></label>}</div><div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add product'} <span>↗</span></button></div></form></section></div>;
}

interface Application {
  _id: string;
  shopName: string;
  requestedSlug: string;
  ownerName: string;
  email: string;
  phone: string;
  requestedPlanId?: Plan | string | null;
  createdAt: string;
}

function AdminApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({});
  const [trialDays, setTrialDays] = useState('14');
  const [rejection, setRejection] = useState<{ id: string; reason: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [applicationResult, planResult] = await Promise.all([
        api<{ data: Application[] }>('admin/applications'),
        api<{ data: Plan[] }>('admin/plans')
      ]);
      setApplications(applicationResult.data);
      const availablePlans = planResult.data.filter(plan => plan.active !== false);
      setPlans(availablePlans);
      setSelectedPlans(current => {
        const next = { ...current };
        for (const item of applicationResult.data) {
          const requested = typeof item.requestedPlanId === 'object' && item.requestedPlanId ? item.requestedPlanId._id : '';
          if (!next[item._id] && availablePlans.some(plan => plan._id === requested)) next[item._id] = requested;
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load shop applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ data: Application[] }>('admin/applications'),
      api<{ data: Plan[] }>('admin/plans')
    ]).then(([applicationResult, planResult]) => {
      if (!active) return;
      const availablePlans = planResult.data.filter(plan => plan.active !== false);
      setApplications(applicationResult.data);
      setPlans(availablePlans);
      setSelectedPlans(current => {
        const next = { ...current };
        for (const item of applicationResult.data) {
          const requested = typeof item.requestedPlanId === 'object' && item.requestedPlanId ? item.requestedPlanId._id : '';
          if (!next[item._id] && availablePlans.some(plan => plan._id === requested)) next[item._id] = requested;
        }
        return next;
      });
    }).catch(loadError => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load shop applications.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function approve(item: Application) {
    const planId = selectedPlans[item._id];
    if (!planId) {
      setError('Choose a plan before approving this shop.');
      return;
    }
    setBusyId(item._id);
    setError('');
    try {
      await api(`admin/applications/${item._id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ planId, trialDays: Number(trialDays) })
      });
      await reload();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Could not approve this application.');
    } finally {
      setBusyId('');
    }
  }

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejection) return;
    setBusyId(rejection.id);
    setError('');
    try {
      await api(`admin/applications/${rejection.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejection.reason })
      });
      setRejection(null);
      await reload();
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Could not reject this application.');
    } finally {
      setBusyId('');
    }
  }

  return <section className="admin-section"><div className="admin-section-head"><div><div className="eyebrow">SUPER ADMIN · CONTROL ROOM</div><h2>Applications to review</h2><p>Approve verified shop owners and assign a plan, or let them know why an application can’t move forward.</p></div><button className="button button-quiet" onClick={() => void reload()}>↻ Refresh</button></div>{error && <div className="dashboard-alert" role="alert"><span>!</span>{error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}<div className="admin-settings"><label>TRIAL DAYS<input type="number" min="0" max="90" value={trialDays} onChange={event => setTrialDays(event.target.value)} /><small>0 leaves the subscription pending.</small></label></div>{loading ? <div className="table-empty"><span className="loading-spinner" />Loading applications…</div> : applications.length === 0 ? <div className="table-empty"><span>✓</span><b>You’re all caught up.</b><p>There are no pending shop applications.</p></div> : <div className="application-list">{applications.map(item => <article className="application-card" key={item._id}>  <div className="application-card-main"><span className="application-avatar">{item.shopName.slice(0, 1).toUpperCase()}</span><div><h3>{item.shopName}</h3><span className="application-url">Shop slug: {item.requestedSlug}</span><p>{item.ownerName} · {item.email}{item.phone ? ` · ${item.phone}` : ''}</p><small>Applied {new Date(item.createdAt).toLocaleDateString()}</small></div></div><div className="application-card-actions"><label>ASSIGN PLAN<select value={selectedPlans[item._id] || ''} onChange={event => setSelectedPlans(current => ({ ...current, [item._id]: event.target.value }))}><option value="">Choose a plan</option>{plans.map(plan => <option value={plan._id} key={plan._id}>{plan.name} · {money(plan.monthlyPriceMinor, plan.currency)}/mo</option>)}</select></label><button className="button button-small" disabled={busyId === item._id} onClick={() => void approve(item)}>{busyId === item._id ? 'Working…' : 'Approve shop ✓'}</button><button className="text-link reject-link" disabled={busyId === item._id} onClick={() => setRejection({ id: item._id, reason: '' })}>Reject</button></div>{rejection?.id === item._id && <form className="reject-form" onSubmit={reject}><label>Reason for rejection<textarea required minLength={3} maxLength={500} value={rejection.reason} onChange={event => setRejection({ ...rejection, reason: event.target.value })} /></label><button type="button" className="button button-quiet" onClick={() => setRejection(null)}>Cancel</button><button type="submit" className="button button-danger" disabled={busyId === item._id}>{busyId === item._id ? 'Working…' : 'Confirm rejection'}</button></form>}</article>)}</div>}</section>;
}
