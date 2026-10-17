'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function VerifyEmail() {
  const [state, setState] = useState<'checking' | 'verified' | 'failed'>('checking');
  const [message, setMessage] = useState('Confirming your email address…');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    Promise.resolve().then(() => {
      if (!token) throw new Error('This verification link is missing its token. Request a new verification email from the sign-in page.');
      return api<{ message: string }>('auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
    })
      .then(result => {
        setState('verified');
        setMessage(result.message);
      })
      .catch(error => {
        setState('failed');
        setMessage(error instanceof Error ? error.message : 'This verification link is invalid or expired.');
      });
  }, []);

  return <main className="verify-shell"><Link className="brand-lockup" href="/"><span className="brand-mark">M</span><span>mobile<span className="brand-accent">hub</span></span></Link><section className="verify-card"><div className={`verify-symbol ${state}`}>{state === 'checking' ? '…' : state === 'verified' ? '✓' : '!'}</div><div className="eyebrow">{state === 'checking' ? 'JUST A MOMENT' : state === 'verified' ? 'EMAIL CONFIRMED' : 'LINK NOT WORKING'}</div><h1>{state === 'verified' ? 'You’re verified.' : state === 'failed' ? 'Let’s try that again.' : 'Confirming your email.'}</h1><p>{message}</p>{state !== 'checking' && <Link href="/login" className="button">Continue to sign in <span>↗</span></Link>}</section></main>;
}
