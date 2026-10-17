export type ApiError = Error & { status?: number; code?: string };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`/api/backend/${path.replace(/^\/+/, '')}`, {
    ...init,
    credentials: 'same-origin',
    headers,
    cache: 'no-store'
  });
  const payload = await response.json().catch(() => ({})) as {
    error?: { message?: string; code?: string };
    message?: string;
  };
  if (!response.ok) {
    const error = new Error(payload.error?.message || payload.message || `Request failed (${response.status}).`) as ApiError;
    error.status = response.status;
    error.code = payload.error?.code;
    throw error;
  }
  return payload as T;
}

export function money(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(minor / 100);
}

export function productPrice(minor: number, currency: string): string {
  return money(minor, currency);
}

export interface Plan {
  _id: string;
  id?: string;
  name: string;
  code: string;
  description?: string;
  monthlyPriceMinor: number;
  yearlyPriceMinor: number;
  currency: string;
  trialDays?: number;
  active?: boolean;
  limits?: { products?: number; staff?: number; branches?: number };
  features?: Record<string, boolean>;
}

export interface Shop {
  id: string;
  name: string;
  slug: string;
  status: string;
  role: string;
  membershipStatus: string;
}

export interface StorefrontHours {
  open: string;
  close: string;
  closed: boolean;
}

export interface StorefrontProfile {
  _id?: string;
  name: string;
  slug: string;
  branding: {
    displayName?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    openingHours?: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', StorefrontHours>>;
    storefrontContent?: {
      enabled?: boolean;
      description?: string;
      announcement?: string;
      socialLinks?: { facebook?: string; instagram?: string; tiktok?: string };
    };
  };
  businessSettings?: { currency?: string; timeZone?: string };
}

export interface StorefrontProduct {
  _id: string;
  sku: string;
  name: string;
  description: string;
  brand: string;
  model: string;
  category: string;
  sellingPriceMinor: number;
  currency: string;
}

export interface Product {
  _id: string;
  sku: string;
  name: string;
  description: string;
  brand: string;
  model: string;
  category: string;
  barcode: string | null;
  costPriceMinor: number;
  sellingPriceMinor: number;
  currency: string;
  reorderLevel: number;
  status: 'active' | 'archived';
}
