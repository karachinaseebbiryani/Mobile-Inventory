import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ path: string[] }> };

const accessCookie = 'mh_access';
const objectId = '[a-f\\d]{24}';
const allowed = (method: string, path: string): boolean => {
  if (method === 'GET' && ['public/plans', 'auth/me', 'shop/profile', 'shop/features', 'shop/subscription', 'shop/database/status', 'admin/applications', 'admin/plans', 'products', 'sales'].includes(path)) return true;
  if (method === 'GET' && /^public\/shops\/[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(path)) return true;
  if (method === 'GET' && ['products/filters', 'products/suggestions'].includes(path)) return true;
  if (method === 'POST' && ['auth/register', 'auth/verify-email', 'auth/resend-verification', 'auth/login', 'auth/logout', 'admin/plans', 'products', 'sales'].includes(path)) return true;
  if (method === 'PATCH' && path === 'shop/profile') return true;
  if (method === 'GET' && new RegExp(`^(products/${objectId})$`).test(path)) return true;
  if (method === 'PATCH' && new RegExp(`^(products/${objectId}|admin/plans/${objectId})$`).test(path)) return true;
  if (method === 'DELETE' && new RegExp(`^products/${objectId}$`).test(path)) return true;
  if (method === 'POST' && new RegExp(`^admin/applications/${objectId}/(approve|reject)$`).test(path)) return true;
  return false;
};

const getBackendUrl = (): URL => {
  const configured = process.env.BACKEND_API_URL;
  if (!configured) throw new Error('BACKEND_API_URL is not configured.');
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('BACKEND_API_URL must be an HTTP(S) origin without a path or embedded credentials.');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('BACKEND_API_URL must use HTTPS in production.');
  }
  return url;
};

async function handle(request: NextRequest, context: RouteContext) {
  const { path: segments } = await context.params;
  const path = segments.join('/');
  const method = request.method;
  if (!allowed(method, path)) {
    return NextResponse.json({ error: { code: 'ROUTE_NOT_ALLOWED', message: 'This API route is not available.' } }, { status: 404 });
  }
  if (['POST', 'PATCH', 'DELETE'].includes(method)) {
    const origin = request.headers.get('origin');
    const requestHost = request.headers.get('host');
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const requestOrigin = requestHost
      ? `${forwardedProtocol || request.nextUrl.protocol.replace(':', '')}://${requestHost}`
      : request.nextUrl.origin;
    if (origin && origin !== requestOrigin) {
      return NextResponse.json({ error: { code: 'INVALID_ORIGIN', message: 'Cross-origin request rejected.' } }, { status: 403 });
    }
  }
  if (path === 'auth/logout' && method === 'POST') {
    const response = NextResponse.json({ message: 'Signed out.' });
    response.cookies.set(accessCookie, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  }

  let target: URL;
  try {
    target = getBackendUrl();
  } catch (error) {
    console.error('Web API configuration error:', error instanceof Error ? error.message : 'Unknown configuration error.');
    return NextResponse.json({ error: { code: 'API_NOT_CONFIGURED', message: 'The web API is not configured.' } }, { status: 503 });
  }
  target.pathname = `${target.pathname.replace(/\/$/, '')}/api/v1/${path}`;
  target.search = request.nextUrl.search;
  const headers = new Headers({ accept: 'application/json' });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const tenantId = request.headers.get('x-tenant-id');
  if (tenantId) headers.set('x-tenant-id', tenantId);
  const token = request.cookies.get(accessCookie)?.value;
  if (token && path !== 'auth/login') headers.set('authorization', `Bearer ${token}`);

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : await request.text(),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    });
    const body = await upstream.text();
    const responseHeaders = new Headers({ 'content-type': upstream.headers.get('content-type') || 'application/json' });
    const response = new NextResponse(body, { status: upstream.status, headers: responseHeaders });
    if (path === 'auth/login' && method === 'POST' && upstream.ok) {
      try {
        const payload = JSON.parse(body) as { accessToken?: unknown; expiresIn?: unknown };
        if (typeof payload.accessToken !== 'string') {
          return NextResponse.json({ error: { code: 'INVALID_API_RESPONSE', message: 'Sign-in could not be completed.' } }, { status: 502 });
        }
        const safePayload = { ...payload };
        delete safePayload.accessToken;
        response.headers.set('content-type', 'application/json');
        const safeResponse = new NextResponse(JSON.stringify(safePayload), { status: upstream.status, headers: response.headers });
        safeResponse.cookies.set(accessCookie, payload.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: cookieLifetime(payload.expiresIn),
          priority: 'high'
        });
        return safeResponse;
      } catch (error) {
        console.error('Backend sign-in response was invalid:', error instanceof Error ? error.message : 'Unknown response error.');
        return NextResponse.json({ error: { code: 'INVALID_API_RESPONSE', message: 'Sign-in could not be completed.' } }, { status: 502 });
      }
    }
    return response;
  } catch (error) {
    console.error('Backend API request failed:', error instanceof Error ? error.message : 'Unknown network error.');
    return NextResponse.json({ error: { code: 'API_UNAVAILABLE', message: 'The shop service is temporarily unavailable. Please try again.' } }, { status: 502 });
  }
}

function cookieLifetime(value: unknown): number {
  if (typeof value !== 'string') return 900;
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 900;
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return Math.min(amount * multiplier, 30 * 86400);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
