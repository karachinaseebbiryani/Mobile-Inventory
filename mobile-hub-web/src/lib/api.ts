export type ApiError = Error & {
  status?: number;
  code?: string;
  details?: Array<{ path: Array<string | number>; message: string }>;
};

function validationDetails(value: unknown): ApiError['details'] {
  if (!Array.isArray(value)) return undefined;
  const details = value.flatMap(issue => {
    if (!issue || typeof issue !== 'object') return [];
    const candidate = issue as { path?: unknown; message?: unknown };
    if (!Array.isArray(candidate.path) || typeof candidate.message !== 'string') return [];
    const path: Array<string | number> = [];
    for (const part of candidate.path) {
      if (typeof part !== 'string' && typeof part !== 'number') return [];
      path.push(part);
    }
    return [{ path, message: candidate.message }];
  });
  return details.length ? details : undefined;
}

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
    error?: { message?: string; code?: string; details?: unknown };
    message?: string;
  };
  if (!response.ok) {
    const details = validationDetails(payload.error?.details);
    const detailMessage = details?.slice(0, 5).map(issue => {
      const field = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${field}${issue.message}`;
    }).join(' ');
    const baseMessage = payload.error?.message || payload.message || `Request failed (${response.status}).`;
    const error = new Error(detailMessage ? `${baseMessage} ${detailMessage}` : baseMessage) as ApiError;
    error.status = response.status;
    error.code = payload.error?.code;
    error.details = details;
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
  productCode: string;
  sku: string;
  name: string;
  description: string;
  brand: string;
  itemType: string;
  model: string;
  category: string;
  color: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  barcode: string | null;
  costPriceMinor: number;
  sellingPriceMinor: number;
  minimumPriceMinor: number;
  quantityOnHand: number;
  showOnPos: boolean;
  firstPurchaseDate: string | null;
  expiryDate: string | null;
  currency: string;
  reorderLevel: number;
  status: 'active' | 'archived';
}

export interface Sale {
  _id: string;
  items: Array<{
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }>;
  currency: string;
  subtotalMinor: number;
  totalMinor: number;
  paymentMethod: 'cash' | 'card' | 'other';
  customerName: string;
  createdAt: string;
}
