import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { StockMvtRequest, StockMvtResponse, TypeMvt } from '../lib/types';
import { useTenant } from '../lib/tenant';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { Pager } from '../components/Pager';
import { EmptyState, ErrorState, MissingIdNotice } from '../components/Notices';

const SIZE = 10;
const LOOKUP_SIZE = 100;
const TYPES: TypeMvt[] = ['IN', 'OUT'];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const blank = (): StockMvtRequest => ({
  typeMvt: 'IN',
  quantity: 1,
  dateMvt: today(),
  comment: '',
  productId: '',
});

export function StockMvtsPage() {
  const { tenant } = useTenant();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<StockMvtResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<StockMvtRequest>(blank);

  const query = useQuery({
    queryKey: ['stocks', tenant, page],
    queryFn: () => api.stocks.list(page, SIZE),
  });

  const products = useQuery({
    queryKey: ['products', tenant, 'lookup'],
    queryFn: () => api.products.list(0, LOOKUP_SIZE),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['stocks', tenant] });

  const save = useMutation({
    mutationFn: (body: StockMvtRequest) =>
      editing?.id ? api.stocks.update(editing.id, body) : api.stocks.create(body),
    onSuccess: async () => {
      notify('success', editing ? 'Movement updated' : 'Movement created');
      close();
      await invalidate();
    },
    onError: (error: ApiError) => notify('error', error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.stocks.remove(id),
    onSuccess: async () => {
      notify('success', 'Movement deleted');
      await invalidate();
    },
    onError: (error: ApiError) => notify('error', error.message),
  });

  function openCreate() {
    setForm(blank());
    setEditing(null);
    setCreating(true);
  }

  function openEdit(movement: StockMvtResponse) {
    setForm({
      typeMvt: movement.typeMvt ?? 'IN',
      quantity: movement.quantity ?? 1,
      dateMvt: movement.dateMvt ?? today(),
      comment: movement.comment ?? '',
      // The API returns no product on a movement, so editing cannot preserve it.
      productId: '',
    });
    setEditing(movement);
    setCreating(false);
  }

  function close() {
    setCreating(false);
    setEditing(null);
  }

  const open = creating || editing !== null;
  const rows = query.data?.content ?? [];
  const missingIds = rows.length > 0 && rows.every((row) => !row.id);

  // A movement needs a productId, and the products endpoint returns no ids yet,
  // so there is nothing to put in the dropdown.
  const selectableProducts = (products.data?.content ?? []).filter((product) => product.id);
  const canCreate = selectableProducts.length > 0;

  return (
    <>
      <div className="page-head">
        <h1>Stock movements</h1>
        <button className="btn primary" onClick={openCreate} disabled={!canCreate}>
          New movement
        </button>
      </div>

      {!canCreate && !products.isPending && (
        <div className="notice">
          <strong>Cannot create a movement.</strong> It needs a{' '}
          <code>productId</code>, and <code>ProductResponse</code> has no{' '}
          <code>id</code> field, so no product can be selected. Add{' '}
          <code>id</code> to the product response to enable this.
        </div>
      )}
      {missingIds && <MissingIdNotice what="Stock movements" />}

      {query.isError && <ErrorState message={(query.error as ApiError).message} />}
      {query.isPending && <EmptyState message="Loading…" />}

      {query.data && (
        <>
          {rows.length === 0 ? (
            <EmptyState message={`No stock movements for tenant "${tenant}" yet.`} />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th className="right">Quantity</th>
                  <th>Date</th>
                  <th>Comment</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((movement, index) => (
                  <tr key={movement.id ?? index}>
                    <td>
                      <span className={`tag tag-${movement.typeMvt?.toLowerCase()}`}>
                        {movement.typeMvt}
                      </span>
                    </td>
                    <td className="right">{movement.quantity ?? '—'}</td>
                    <td className="mono">{movement.dateMvt ?? '—'}</td>
                    <td className="muted">{movement.comment || '—'}</td>
                    <td className="right nowrap">
                      <button
                        className="btn ghost"
                        disabled={!movement.id}
                        title={movement.id ? undefined : 'The API does not return a movement id'}
                        onClick={() => openEdit(movement)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn danger"
                        disabled={!movement.id || remove.isPending}
                        title={movement.id ? undefined : 'The API does not return a movement id'}
                        onClick={() => {
                          if (movement.id && window.confirm('Delete this movement?')) {
                            remove.mutate(movement.id);
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
        <Modal title={editing ? 'Edit movement' : 'New movement'} onClose={close}>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(form);
            }}
          >
            <label>
              Product
              <select
                value={form.productId}
                required
                onChange={(event) => setForm({ ...form, productId: event.target.value })}
              >
                <option value="">Select a product…</option>
                {selectableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.reference})
                  </option>
                ))}
              </select>
            </label>
            <div className="grid-2">
              <label>
                Type
                <select
                  value={form.typeMvt}
                  onChange={(event) =>
                    setForm({ ...form, typeMvt: event.target.value as TypeMvt })
                  }
                >
                  {TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  value={form.quantity ?? 1}
                  onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
                />
              </label>
            </div>
            <label>
              Date
              <input
                type="date"
                value={form.dateMvt}
                required
                onChange={(event) => setForm({ ...form, dateMvt: event.target.value })}
              />
            </label>
            <label>
              Comment
              <textarea
                value={form.comment ?? ''}
                rows={3}
                onChange={(event) => setForm({ ...form, comment: event.target.value })}
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
