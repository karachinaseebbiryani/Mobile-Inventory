'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { api, productPrice, type StorefrontProduct, type StorefrontProfile } from '@/lib/api';

interface StorefrontData {
  shop: StorefrontProfile;
  products: StorefrontProduct[];
  categories: string[];
  pagination: { page: number; limit: number; total: number };
}

const isHttpUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const safeColor = (value: string | undefined, fallback: string): string =>
  value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;

export function Storefront({ slug }: { slug: string }) {
  const [data, setData] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ page: String(page), limit: '30' });
    if (search) query.set('search', search);
    if (category) query.set('category', category);
    void Promise.resolve().then(() => {
      if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(slug)) {
        throw new Error('This shop could not be found.');
      }
      if (!cancelled) {
        setLoading(true);
        setError('');
      }
      return api<StorefrontData>(`public/shops/${slug}?${query.toString()}`);
    }).then(result => {
      if (!cancelled && result) setData(result);
    }).catch(loadError => {
      if (!cancelled) {
        setError(loadError instanceof Error ? loadError.message : 'This shop could not be loaded.');
        setData(null);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug, page, search, category]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  if (loading && !data) {
    return <main className="storefront-shell"><div className="storefront-loading">Loading shop…</div></main>;
  }
  if (error && !data) {
    return <main className="storefront-shell"><div className="storefront-message"><span>SHOP UNAVAILABLE</span><h1>We can’t find this shop.</h1><p>{error}</p><Link href="/" className="button">Back to Mobile Hub</Link></div></main>;
  }
  if (!data) return null;

  const { shop, products, categories, pagination } = data;
  const name = shop.branding.displayName || shop.name;
  const primary = safeColor(shop.branding.primaryColor, '#155c47');
  const secondary = safeColor(shop.branding.secondaryColor, '#182521');
  const cssVars = { '--store-primary': primary, '--store-secondary': secondary } as CSSProperties;
  const phone = shop.branding.contactPhone || '';
  const phoneDigits = phone.replace(/\D/g, '');
  const socials = shop.branding.storefrontContent?.socialLinks || {};
  const maxPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <main className="storefront-shell" style={cssVars}>
      <header className="storefront-header">
        <Link href="/" className="storefront-platform">MOBILE HUB <span>STOREFRONT</span></Link>
        <span className="storefront-secure">A shop catalogue</span>
      </header>
      <section className="storefront-hero">
        <div className="storefront-brand">
          {isHttpUrl(shop.branding.logoUrl) ? (
            // The URL is merchant-configured; keep the storefront usable for remote shop logos.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.branding.logoUrl} alt={`${name} logo`} />
          ) : (
            <span className="storefront-monogram">{name.trim().charAt(0).toUpperCase() || 'S'}</span>
          )}
          <div>
            <span className="storefront-eyebrow">WELCOME TO</span>
            <h1>{name}</h1>
            {shop.branding.address && <p>{shop.branding.address}</p>}
          </div>
        </div>
        {shop.branding.storefrontContent?.description && (
          <p className="storefront-description">{shop.branding.storefrontContent.description}</p>
        )}
        {shop.branding.storefrontContent?.announcement && (
          <div className="storefront-announcement">{shop.branding.storefrontContent.announcement}</div>
        )}
        <div className="storefront-actions">
          {phoneDigits && <a href={`tel:${phone}`} className="button">Call the shop</a>}
          {phoneDigits && <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="storefront-contact-link">Message on WhatsApp ↗</a>}
          {shop.branding.contactEmail && <a href={`mailto:${shop.branding.contactEmail}`} className="storefront-contact-link">Email the shop ↗</a>}
        </div>
      </section>

      <section className="storefront-catalogue">
        <div className="storefront-section-heading">
          <div><span className="storefront-eyebrow">THE SHOP CATALOGUE</span><h2>Find your next favourite.</h2></div>
          <span className="storefront-product-count">{pagination.total} {pagination.total === 1 ? 'product' : 'products'}</span>
        </div>
        <form className="storefront-search" onSubmit={submitSearch}>
          <input aria-label="Search products" placeholder="Search phones, brands and models…" value={searchInput} onChange={event => setSearchInput(event.target.value)} />
          <button type="submit">Search</button>
        </form>
        {categories.length > 0 && (
          <div className="storefront-categories" aria-label="Product categories">
            <button type="button" className={!category ? 'selected' : ''} onClick={() => { setCategory(''); setPage(1); }}>All products</button>
            {categories.map(item => <button type="button" className={category === item ? 'selected' : ''} key={item} onClick={() => { setCategory(item); setPage(1); }}>{item}</button>)}
          </div>
        )}
        {error && <p className="storefront-inline-error" role="alert">{error}</p>}
        {loading ? <div className="storefront-loading">Updating catalogue…</div> : products.length ? (
          <div className="storefront-product-grid">
            {products.map(product => (
              <article className="storefront-product-card" key={product._id}>
                <div className="storefront-product-art" aria-hidden="true">
                  <span>{(product.brand || product.name).trim().charAt(0).toUpperCase()}</span>
                  <small>{product.category}</small>
                </div>
                <div className="storefront-product-info">
                  <span className="storefront-product-brand">{product.brand || product.category}</span>
                  <h3>{product.name}</h3>
                  {(product.model || product.description) && <p>{product.model || product.description}</p>}
                  <div className="storefront-product-bottom">
                    <strong>{productPrice(product.sellingPriceMinor, product.currency)}</strong>
                    {phoneDigits ? <a href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hello, I’m interested in ${product.name}.`)}`} target="_blank" rel="noreferrer">Ask about this ↗</a> : <span>Contact shop for details</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="storefront-empty"><span>⌕</span><h3>No products to show just yet.</h3><p>Try another search or category, or check back with the shop soon.</p></div>
        )}
        {maxPages > 1 && (
          <nav className="storefront-pagination" aria-label="Catalogue pages">
            <button disabled={page <= 1 || loading} onClick={() => setPage(current => current - 1)}>← Previous</button>
            <span>Page {page} of {maxPages}</span>
            <button disabled={page >= maxPages || loading} onClick={() => setPage(current => current + 1)}>Next →</button>
          </nav>
        )}
      </section>

      {(Object.values(shop.branding.openingHours || {}).some(Boolean) || shop.branding.address || Object.values(socials).some(Boolean)) && (
        <section className="storefront-details">
          {shop.branding.address && <div><span className="storefront-eyebrow">VISIT</span><p>{shop.branding.address}</p></div>}
          {Object.values(shop.branding.openingHours || {}).some(Boolean) && (
            <div><span className="storefront-eyebrow">SHOP HOURS · {shop.businessSettings?.timeZone || 'LOCAL TIME'}</span><ul>{Object.entries(shop.branding.openingHours || {}).map(([day, hours]) => hours && typeof hours === 'object' && <li key={day}><span>{day.toUpperCase()}</span><span>{hours.closed ? 'Closed' : `${hours.open}–${hours.close}`}</span></li>)}</ul></div>
          )}
          {Object.entries(socials).filter(([, url]) => isHttpUrl(url)).length > 0 && (
            <div><span className="storefront-eyebrow">FOLLOW ALONG</span><div className="storefront-socials">{Object.entries(socials).filter(([, url]) => isHttpUrl(url)).map(([network, url]) => <a key={network} href={url} target="_blank" rel="noreferrer">{network} ↗</a>)}</div></div>
          )}
        </section>
      )}
      <footer className="storefront-footer"><span>{name}</span><span>Storefront powered by <Link href="/">Mobile Hub</Link></span></footer>
    </main>
  );
}
