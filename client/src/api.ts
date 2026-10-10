export type Role = 'farmer' | 'buyer' | 'admin';
export interface User { id: number; role: Role; name: string | null }

export interface Plot {
  id: number;
  title: string;
  state: string;
  district: string;
  village: string | null;
  surveyNumber: string | null;
  areaAcres: number;
  soilType: string | null;
  waterSource: string | null;
  crops: string[];
  expectedHarvest: string | null;
  expectedQuantityQtl: number | null;
  boundary: [number, number][];
  center: [number, number];
  verified: boolean;
  ownerName: string | null;
}

export interface Enquiry {
  id: number;
  message: string;
  createdAt: string;
  plotId: number;
  plotTitle: string;
  buyerName: string | null;
  buyerPhone: string;
}

const KEY = 'farmland-session';

export function getSession(): { token: string; user: User } | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}
export function setSession(s: { token: string; user: User } | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const session = getSession();
  const res = await fetch(path, {
    method: init.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
