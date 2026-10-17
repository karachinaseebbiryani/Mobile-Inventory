import Link from 'next/link';
import { money, type Plan } from '@/lib/api';

export const dynamic = 'force-dynamic';

async function getPlans(): Promise<{ plans: Plan[]; unavailable: boolean }> {
  try {
    const configured = process.env.BACKEND_API_URL;
    if (!configured) return { plans: [], unavailable: true };
    const response = await fetch(`${configured.replace(/\/$/, '')}/api/v1/public/plans`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return { plans: [], unavailable: true };
    const result = await response.json() as { data: Plan[] };
    return { plans: result.data, unavailable: false };
  } catch {
    return { plans: [], unavailable: true };
  }
}

export default async function HomePage() {
  const { plans, unavailable } = await getPlans();
  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark">M</span>
          <span>mobile<span className="brand-accent">hub</span></span>
        </Link>
        <nav className="topnav">
          <a href="#features">Features</a>
          <a href="#plans">Plans</a>
          <Link href="/login" className="nav-login">Sign in</Link>
          <Link href="/signup" className="button button-small">Open your shop <span>↗</span></Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> BUILT FOR INDEPENDENT MOBILE SHOPS</div>
          <h1>Your shop,<br /><span>in your pocket.</span></h1>
          <p className="hero-lede">Inventory, shop operations and the details that keep your business moving — all in one refreshingly simple place.</p>
          <div className="hero-actions">
            <Link href="/signup" className="button">Get started <span>↗</span></Link>
            <Link href="/login" className="text-link">Already have an account? <span>Sign in →</span></Link>
          </div>
          <div className="hero-proof"><div className="avatar-stack"><i>J</i><i>A</i><i>M</i><i>+</i></div><span>Made for the people behind the counter.</span></div>
        </div>
        <div className="hero-visual" aria-label="Mobile Hub inventory dashboard preview">
          <div className="glow-orb" />
          <div className="preview-window">
            <div className="preview-label">PRODUCT PREVIEW · SAMPLE DATA</div><div className="preview-head"><span className="preview-logo">M</span><div><b>Monday, October 14</b><small>Good morning, Alex 👋</small></div><span className="preview-menu">•••</span></div>
            <div className="preview-total"><small>Today&apos;s overview</small><div className="preview-metrics"><div><b>£2,840</b><span>Sales today <em>↗ 12.8%</em></span></div><div><b>128</b><span>Items in stock</span></div></div></div>
            <div className="preview-card-title"><b>Low stock alerts</b><span>View inventory →</span></div>
            <div className="preview-item"><span className="phone-icon">▯</span><div><b>iPhone 13 · 128GB</b><small>Midnight · Unlocked</small></div><span className="stock-warning">2 left</span></div>
            <div className="preview-item"><span className="phone-icon purple">▯</span><div><b>Galaxy S23 · 256GB</b><small>Phantom Black · New</small></div><span className="stock-warning">1 left</span></div>
            <div className="preview-bottom"><span>◉ &nbsp; Overview</span><span>▦ &nbsp; Inventory</span><span>◎ &nbsp; Sales</span><span>••• &nbsp; More</span></div>
          </div>
          <div className="floating-note"><span>↗</span><div><b>Looking good!</b><small>Your shop is all caught up.</small></div></div>
        </div>
        <div className="hero-stamp"><span>✳</span> LESS ADMIN.<br />MORE YOU.</div>
      </section>

      <section className="trust-strip">
        <span>ONE SIMPLE HOME FOR YOUR SHOP</span><b>Stock</b><i /> <b>Sales</b><i /> <b>Your team</b><i /> <b>Your way of working</b>
      </section>

      <section className="features-section" id="features">
        <div className="section-intro"><div className="eyebrow">THE EVERYDAY, MADE EASIER</div><h2>All the moving parts.<br /><span>One less thing to worry about.</span></h2><p>Spend less time chasing information and more time doing what you do best.</p></div>
        <div className="feature-grid">
          <article className="feature-card feature-green"><div className="feature-icon">▦</div><h3>Keep your catalogue clear</h3><p>Keep product details tidy, searchable and easy to update. The right information, right where you need it.</p><div className="mini-stock"><span>◉&nbsp; Product catalogue</span><b>Easy to find <i>↗</i></b></div></article>
          <article className="feature-card feature-lilac"><div className="feature-icon">⌁</div><h3>Your shop, your team</h3><p>A workspace shaped around your shop. The right people get access to the right shop — and nowhere else.</p><div className="team-dots"><i>AL</i><i>MK</i><i>JR</i><span>your crew</span></div></article>
          <article className="feature-card feature-peach"><div className="feature-icon">✳</div><h3>Room to grow</h3><p>Start with the essentials. Your shop&apos;s plan sets which features are available, so your tools can grow with you.</p><div className="grow-line"><span>YOUR SHOP</span><i /><span>WHAT&apos;S NEXT</span><b>↗</b></div></article>
        </div>
      </section>

      <section className="plans-section" id="plans">
        <div className="plans-heading"><div><div className="eyebrow">NO SURPRISES</div><h2>A plan that fits <span>your shop.</span></h2></div><p>Every shop is reviewed before it goes live.<br />You&apos;ll know exactly what&apos;s included.</p></div>
        {plans.length ? <div className="plan-grid">{plans.map(plan => <article className="plan-card" key={plan._id}><div className="plan-name">{plan.name}<span>SHOP PLAN</span></div><p>{plan.description || 'The essentials for your mobile shop.'}</p><div className="plan-price">{money(plan.monthlyPriceMinor, plan.currency)}<small> / month</small></div><div className="plan-year">{money(plan.yearlyPriceMinor, plan.currency)} billed yearly</div><ul><li>Shop-specific workspace</li><li>Inventory catalogue</li><li>Private shop data</li><li>{plan.trialDays ? `${plan.trialDays}-day trial if approved` : 'Personal onboarding review'}</li></ul><Link href={`/signup?plan=${encodeURIComponent(plan._id)}`} className="button button-outline">Apply for this plan <span>↗</span></Link></article>)}</div>
          : <div className="plans-empty"><span>✳</span><div><b>{unavailable ? 'Plans are temporarily unavailable.' : 'Plans are being set up.'}</b><p>You can still apply to open your shop — our team will follow up with next steps.</p></div><Link href="/signup" className="text-link">Apply to open a shop →</Link></div>}
      </section>

      <section className="closing-cta"><div><div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div><h2>Ready when <span>you are.</span></h2><p>Tell us a little about your shop. We&apos;ll help you take it from there.</p></div><Link href="/signup" className="button button-light">Open your shop <span>↗</span></Link><div className="cta-spark">✳</div></section>
      <footer className="footer"><Link className="brand-lockup" href="/"><span className="brand-mark">M</span><span>mobile<span className="brand-accent">hub</span></span></Link><span>Tools for the shops that keep us connected.</span><span>© {new Date().getFullYear()} Mobile Hub</span></footer>
    </main>
  );
}
