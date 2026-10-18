'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, money, type ApiError, type Plan, type Shop } from '@/lib/api';

type Mode = 'login' | 'signup';

export function AuthForm({ mode, sessionExpired = false }: { mode: Mode; sessionExpired?: boolean }) {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [planId, setPlanId] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (mode !== 'signup') return;
    api<{ data: Plan[] }>('public/plans')
      .then(result => {
        setPlans(result.data);
        const requestedPlan = new URLSearchParams(window.location.search).get('plan');
        if (requestedPlan && result.data.some(plan => plan._id === requestedPlan)) setPlanId(requestedPlan);
      })
      .catch(() => setPlans([]));
  }, [mode]);

  const normalizedSlug = useMemo(() => slug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-'), [slug]);

  function changeShopName(value: string) {
    setShopName(value);
    setSlug(value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setNeedsVerification(false);
    setResendMessage('');
    try {
      if (mode === 'login') {
        const result = await api<{ user: { name: string }; shops: Shop[] }>('auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        if (result.shops[0]) sessionStorage.setItem('activeShopId', result.shops[0].id);
        router.push('/dashboard');
        return;
      }
      const result = await api<{ message: string }>('auth/register', {
        method: 'POST',
        body: JSON.stringify({
          shopName,
          slug: normalizedSlug,
          ownerName,
          email,
          password,
          phone,
          ...(planId ? { requestedPlanId: planId } : {})
        })
      });
      setNotice(result.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.');
      setNeedsVerification((submitError as ApiError).code === 'EMAIL_NOT_VERIFIED');
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setBusy(true);
    setResendMessage('');
    try {
      const result = await api<{ message: string }>('auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      setResendMessage(result.message);
    } catch (resendError) {
      setResendMessage(resendError instanceof Error ? resendError.message : 'Could not request a verification email.');
    } finally {
      setBusy(false);
    }
  }

  const signup = mode === 'signup';
  return (
    <main className="auth-shell">
      <aside className="auth-aside">
        <Link className="brand-lockup auth-brand" href="/"><span className="brand-mark">M</span><span>mobile<span className="brand-accent">hub</span></span></Link>
        <div className="auth-aside-copy">
          <div className="eyebrow">A BETTER WAY TO RUN YOUR SHOP</div>
          <h1>More time for<br /><span>your people.</span></h1>
          <p>Keep your products in order, your shop details close, and the day moving.</p>
          <div className="auth-aside-note"><span>✳</span><div><b>One home for the day-to-day.</b><small>Made for independent mobile shops.</small></div></div>
        </div>
        <span className="auth-aside-footer">TOOLS FOR THE SHOPS THAT KEEP US CONNECTED.</span>
      </aside>
      <section className="auth-panel">
        <div className="auth-panel-top"><span>{signup ? 'NEW SHOP APPLICATION' : 'WELCOME BACK'}</span><Link href="/">← Back to home</Link></div>
        <div className="auth-form-wrap">
          <div className="auth-heading"><span className="eyebrow">{signup ? 'LET’S GET YOU SET UP' : 'YOUR SHOP IS WAITING'}</span><h2>{signup ? 'Open your shop.' : 'Good to see you.'}</h2><p>{signup ? 'Tell us a little about you and your shop. We’ll take it from there.' : 'Sign in to pick up right where you left off.'}</p></div>
          {sessionExpired && !signup && <div className="notice notice-info" role="status"><p>Your sign-in has expired. Sign in again to continue.</p></div>}
          {notice ? <div className="notice notice-success"><b>Application received</b><p>{notice}</p><p>Check your inbox for the verification email. Once verified, your application will be reviewed by the Mobile Hub team.</p><Link href="/login" className="text-link">Continue to sign in →</Link></div> : (
            <form className="auth-form" onSubmit={submit}>
              {signup && <><label>Shop name<input required minLength={2} maxLength={120} value={shopName} onChange={event => changeShopName(event.target.value)} placeholder="e.g. Northside Mobile" /></label><label>Shop slug<div className="slug-input"><input required minLength={3} maxLength={63} pattern="[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?" value={normalizedSlug} onChange={event => setSlug(event.target.value)} placeholder="northside-mobile" /></div><small>Becomes your shop workspace and public storefront link after approval.</small></label><div className="form-row"><label>Your name<input required minLength={2} maxLength={120} value={ownerName} onChange={event => setOwnerName(event.target.value)} placeholder="Alex Morgan" /></label><label>Phone <span className="optional">OPTIONAL</span><input maxLength={40} value={phone} onChange={event => setPhone(event.target.value)} placeholder="+44 7700 900000" /></label></div>{plans.length > 0 && <label>Plan you’re interested in <span className="optional">YOU CAN CHOOSE LATER</span><select value={planId} onChange={event => setPlanId(event.target.value)}><option value="">We’ll help you choose</option>{plans.map(plan => <option key={plan._id} value={plan._id}>{plan.name} — {money(plan.monthlyPriceMinor, plan.currency)} / month</option>)}</select></label>}</>}
              <label>Email address<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@yourshop.com" /></label>
              <label>Password<input required type="password" minLength={signup ? 12 : 1} maxLength={72} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder={signup ? 'At least 12 characters' : 'Your password'} /><small>{signup ? 'Use at least 12 characters.' : 'Password recovery is not available yet. Contact your administrator for help.'}</small></label>
              {error && <div className="notice notice-error" role="alert">{error}</div>}
              {needsVerification && <div className="verification-resend"><button type="button" className="text-link" onClick={resendVerification} disabled={busy}>Resend verification email →</button>{resendMessage && <small role="status">{resendMessage}</small>}</div>}
              <button className="button auth-submit" type="submit" disabled={busy}>{busy ? 'One moment…' : signup ? 'Send my application' : 'Sign in'} <span>↗</span></button>
              <div className="auth-switch">{signup ? <>Already have an account? <Link href="/login">Sign in</Link></> : <>New to Mobile Hub? <Link href="/signup">Apply to open a shop</Link></>}</div>
              {signup && <p className="auth-terms">By applying, you agree that your details may be used to review your shop application. Your shop is not active until a super administrator approves it.</p>}
            </form>
          )}
        </div>
        <div className="auth-panel-footer"><span>PRIVATE BY DESIGN</span><span>© {new Date().getFullYear()} MOBILE HUB</span></div>
      </section>
    </main>
  );
}
