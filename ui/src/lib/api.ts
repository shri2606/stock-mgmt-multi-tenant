import type {
  CategoryRequest,
  CategoryResponse,
  PageResponse,
  ProductRequest,
  ProductResponse,
  StockMvtRequest,
  StockMvtResponse,
} from './types';

export const TENANT_STORAGE_KEY = 'tenantId';

/**
 * How the client tells the backend which tenant it is.
 *
 * This is the whole tenancy seam on the front end. Today it reads a tenant the
 * user typed, so the header is self-asserted and nothing verifies it. If that is
 * ever replaced by a signed token, this is the only file that has to change.
 */
let tenantProvider: () => string | null = () => localStorage.getItem(TENANT_STORAGE_KEY);

export function setTenantProvider(provider: () => string | null): void {
  tenantProvider = provider;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * The API has no exception handler, so a constraint violation arrives as a 500
 * whose `message` is the raw Hibernate/JDBC text, batch SQL and all. These map
 * the database's own constraint names onto something a person can act on.
 */
const CONSTRAINT_MESSAGES: ReadonlyArray<[RegExp, string]> = [
  [
    /fk_category_id/i,
    'This category still has products. Delete or move those products first.',
  ],
  [
    /fk_product_id/i,
    'This product still has stock movements. Delete those movements first.',
  ],
  [
    /category_name_unique_constraint/i,
    'That category name is already taken. Names are unique across every tenant, not just yours.',
  ],
  [
    /products_reference_unique_constraint/i,
    'That product reference is already taken. References are unique across every tenant, not just yours.',
  ],
  [/stock_mvts_type_mvt_check/i, 'The movement type must be IN or OUT.'],
];

function humanise(raw: string, status: number): string {
  for (const [pattern, message] of CONSTRAINT_MESSAGES) {
    if (pattern.test(raw)) return message;
  }
  if (status === 400 && /tenant/i.test(raw)) {
    return 'No tenant set. Choose one in the top bar.';
  }
  // Service-level errors are already short and readable ("Category not found").
  if (raw.length <= 160 && !raw.includes('\n')) return raw;
  return `The request failed (HTTP ${status}). See the server log for details.`;
}

async function readError(res: Response): Promise<string> {
  const body = await res.text();
  if (!body) return `${res.status} ${res.statusText}`;

  let raw = body;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const message = parsed['message'] ?? parsed['error'] ?? parsed['detail'];
    if (typeof message === 'string' && message.length > 0) raw = message;
  } catch {
    // not JSON, keep the raw body
  }
  return humanise(raw, res.status);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json');

  const tenant = tenantProvider();
  if (tenant) headers.set('X-Tenant-ID', tenant);

  const res = await fetch(`/api/v1${path}`, { ...init, headers });
  if (!res.ok) throw new ApiError(res.status, await readError(res));

  if (res.status === 204) return undefined as T;
  const body = await res.text();
  return (body ? (JSON.parse(body) as T) : (undefined as T));
}

function page(path: string, pageNumber: number, size: number): string {
  return `${path}?page=${pageNumber}&size=${size}`;
}

const json = (body: unknown): RequestInit['body'] => JSON.stringify(body);

export const api = {
  categories: {
    list: (pageNumber: number, size: number) =>
      request<PageResponse<CategoryResponse>>(page('/categories', pageNumber, size)),
    get: (id: string) => request<CategoryResponse>(`/categories/${id}`),
    create: (body: CategoryRequest) =>
      request<void>('/categories', { method: 'POST', body: json(body) }),
    update: (id: string, body: CategoryRequest) =>
      request<void>(`/categories/${id}`, { method: 'PUT', body: json(body) }),
    remove: (id: string) => request<void>(`/categories/${id}`, { method: 'DELETE' }),
  },
  products: {
    list: (pageNumber: number, size: number) =>
      request<PageResponse<ProductResponse>>(page('/products', pageNumber, size)),
    get: (id: string) => request<ProductResponse>(`/products/${id}`),
    create: (body: ProductRequest) =>
      request<void>('/products', { method: 'POST', body: json(body) }),
    update: (id: string, body: ProductRequest) =>
      request<void>(`/products/${id}`, { method: 'PUT', body: json(body) }),
    remove: (id: string) => request<void>(`/products/${id}`, { method: 'DELETE' }),
  },
  stocks: {
    list: (pageNumber: number, size: number) =>
      request<PageResponse<StockMvtResponse>>(page('/stocks', pageNumber, size)),
    get: (id: string) => request<StockMvtResponse>(`/stocks/${id}`),
    create: (body: StockMvtRequest) =>
      request<void>('/stocks', { method: 'POST', body: json(body) }),
    update: (id: string, body: StockMvtRequest) =>
      request<void>(`/stocks/${id}`, { method: 'PUT', body: json(body) }),
    remove: (id: string) => request<void>(`/stocks/${id}`, { method: 'DELETE' }),
  },
};
