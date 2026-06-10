type ListOptions = {
  bookId?: string;
  orderField?: string;
  includeDeleted?: boolean;
  filters?: Record<string, string | number | boolean | undefined | null>;
};

const MAC_API_URL = (import.meta as any).env?.VITE_MAC_API_URL || 'http://mac-mini.local:8787';
const MAC_API_TOKEN = (import.meta as any).env?.VITE_MAC_API_TOKEN || '';

const apiBase = String(MAC_API_URL).replace(/\/+$/, '');

function headers(): HeadersInit {
  const out: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (MAC_API_TOKEN) out.Authorization = `Bearer ${MAC_API_TOKEN}`;
  return out;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...headers(),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Mac API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function collectionPath(collectionName: string, options?: ListOptions) {
  const params = new URLSearchParams();
  params.set('bookId', options?.bookId || 'default');
  if (options?.orderField) params.set('orderField', options.orderField);
  if (options?.includeDeleted) params.set('includeDeleted', 'true');
  for (const [key, value] of Object.entries(options?.filters || {})) {
    if (value === undefined || value === null || value === '') continue;
    params.set(`filter.${key}`, String(value));
  }
  return `/api/collections/${encodeURIComponent(collectionName)}?${params.toString()}`;
}

export async function macListCollection<T = any>(collectionName: string, options?: ListOptions): Promise<T[]> {
  const payload = await request<{ items: T[] }>(collectionPath(collectionName, options));
  return payload.items || [];
}

export async function macGetDocument<T = any>(
  collectionName: string,
  id: string,
  options?: { bookId?: string; includeDeleted?: boolean },
): Promise<T | null> {
  const params = new URLSearchParams({ bookId: options?.bookId || 'default' });
  if (options?.includeDeleted) params.set('includeDeleted', 'true');
  try {
    const payload = await request<{ item: T }>(
      `/api/collections/${encodeURIComponent(collectionName)}/${encodeURIComponent(id)}?${params.toString()}`,
    );
    return payload.item;
  } catch (error: any) {
    if (String(error?.message || '').includes('Mac API 404')) return null;
    throw error;
  }
}

export async function macSaveDocument<T = any>(
  collectionName: string,
  data: T & { id?: string },
  options?: { bookId?: string; merge?: boolean },
): Promise<T & { id: string }> {
  const id = data?.id ? String(data.id) : '';
  const bookId = options?.bookId || 'default';
  const params = new URLSearchParams({ bookId });
  if (options?.merge) params.set('merge', 'true');
  const path = id
    ? `/api/collections/${encodeURIComponent(collectionName)}/${encodeURIComponent(id)}?${params.toString()}`
    : `/api/collections/${encodeURIComponent(collectionName)}?${params.toString()}`;
  const method = id ? 'PUT' : 'POST';
  const payload = await request<{ item: T & { id: string } }>(path, {
    method,
    body: JSON.stringify({ data }),
  });
  return payload.item;
}

export async function macDeleteDocument<T = any>(
  collectionName: string,
  id: string,
  options?: { bookId?: string },
): Promise<T> {
  const bookId = options?.bookId || 'default';
  const payload = await request<{ item: T }>(
    `/api/collections/${encodeURIComponent(collectionName)}/${encodeURIComponent(id)}?bookId=${encodeURIComponent(bookId)}`,
    { method: 'DELETE' },
  );
  return payload.item;
}
