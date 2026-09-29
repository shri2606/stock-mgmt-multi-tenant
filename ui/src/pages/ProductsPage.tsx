import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { ProductRequest, ProductResponse } from '../lib/types';
import { useTenant } from '../lib/tenant';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { Pager } from '../components/Pager';
import { EmptyState, ErrorState, MissingIdNotice } from '../components/Notices';

const SIZE = 10;
const LOOKUP_SIZE = 100;
const BLANK: ProductRequest = {
  name: '',
  reference: '',
  description: '',
  alertThreshold: 0,
  price: 0,
  categoryId: '',
};

export function ProductsPage() {
  const { tenant } = useTenant();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ProductResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ProductRequest>(BLANK);

  const query = useQuery({
    queryKey: ['products', tenant, page],
    queryFn: () => api.products.list(page, SIZE),
  });

  const categories = useQuery({
    queryKey: ['categories', tenant, 'lookup'],
    queryFn: () => api.categories.list(0, LOOKUP_SIZE),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products', tenant] });

  const save = useMutation({
    mutationFn: (body: ProductRequest) =>
      editing?.id ? api.products.update(editing.id, body) : api.products.create(body),
    onSuccess: async () => {
      notify('success', editing ? 'Product updated' : 'Product created');
      close();
      await invalidate();
    },
    onError: (error: ApiError) => notify('error', error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.products.remove(id),
    onSuccess: async () => {
      notify('success', 'Product deleted');
      await invalidate();
    },
    onError: (error: ApiError) => notify('error', error.message),
  });

  function openCreate() {
    setForm(BLANK);
    setEditing(null);
    setCreating(true);
  }

  function openEdit(product: ProductResponse) {
    setForm({
      name: product.name ?? '',
      reference: product.reference ?? '',
      description: product.description ?? '',
      alertThreshold: product.alertThreshold ?? 0,
      price: product.price ?? 0,
      categoryId: product.categoryId ?? '',
    });
    setEditing(product);
    setCreating(false);
  }

  function close() {
    setCreating(false);
    setEditing(null);
  }

  const open = creating || editing !== null;
  const rows = query.data?.content ?? [];
  const missingIds = rows.length > 0 && rows.every((row) => !row.id);
  const categoryOptions = categories.data?.content ?? [];

  return (
    <>
      <div className="page-head">
        <h1>Products</h1>
        <button className="btn primary" onClick={openCreate} disabled={categoryOptions.length === 0}>
          New product
        </button>
      </div>

      {categoryOptions.length === 0 && !categories.isPending && (
        <div className="notice">A product needs a category. Create one first.</div>
      )}
      {missingIds && <MissingIdNotice what="Products" />}

      {query.isError && <ErrorState message={(query.error as ApiError).message} />}
      {query.isPending && <EmptyState message="Loading…" />}

      {query.data && (
        <>
          {rows.length === 0 ? (
            <EmptyState message={`No products for tenant "${tenant}" yet.`} />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Reference</th>
                  <th>Category</th>
                  <th className="right">Price</th>
                  <th className="right">Alert at</th>
                  <th className="right">Available</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product, index) => (
                  <tr key={product.id ?? `${product.reference}-${index}`}>
                    <td>{product.name}</td>
                    <td className="mono">{product.reference}</td>
                    <td className="muted">{product.categoryName || '—'}</td>
                    <td className="right">{product.price ?? '—'}</td>
                    <td className="right">{product.alertThreshold ?? '—'}</td>
                    <td className="right">{product.availableQuantity ?? 0}</td>
                    <td className="right nowrap">
                      <button
                        className="btn ghost"
                        disabled={!product.id}
                        title={product.id ? undefined : 'The API does not return a product id'}
                        onClick={() => openEdit(product)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn danger"
                        disabled={!product.id || remove.isPending}
                        title={product.id ? undefined : 'The API does not return a product id'}
                        onClick={() => {
                          if (product.id && window.confirm(`Delete "${product.name}"?`)) {
                            remove.mutate(product.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Pager
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalElements={query.data.totalElements}
            hasPrevious={query.data.hasPrevious}
            hasNext={query.data.hasNext}
            onChange={setPage}
          />
        </>
      )}

      {open && (
        <Modal title={editing ? 'Edit product' : 'New product'} onClose={close}>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(form);
            }}
          >
            <div className="grid-2">
              <label>
                Name
                <input
                  value={form.name}
                  required
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label>
                Reference
                <input
                  value={form.reference}
                  required
                  onChange={(event) => setForm({ ...form, reference: event.target.value })}
                />
              </label>
            </div>
            <label>
              Category
              <select
                value={form.categoryId}
                required
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              >
                <option value="">Select a category…</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid-2">
              <label>
                Price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price ?? 0}
                  onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
                />
              </label>
              <label>
                Alert threshold
                <input
                  type="number"
                  min="0"
                  value={form.alertThreshold ?? 0}
                  onChange={(event) =>
                    setForm({ ...form, alertThreshold: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                value={form.description ?? ''}
                rows={3}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
            <footer className="form-actions">
              <button type="button" className="btn ghost" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
