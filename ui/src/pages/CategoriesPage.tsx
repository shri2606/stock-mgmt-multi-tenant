import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { CategoryRequest, CategoryResponse } from '../lib/types';
import { useTenant } from '../lib/tenant';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { Pager } from '../components/Pager';
import { EmptyState, ErrorState } from '../components/Notices';

const SIZE = 10;
const BLANK: CategoryRequest = { name: '', description: '' };

export function CategoriesPage() {
  const { tenant } = useTenant();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<CategoryResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CategoryRequest>(BLANK);

  const query = useQuery({
    queryKey: ['categories', tenant, page],
    queryFn: () => api.categories.list(page, SIZE),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['categories', tenant] });

  const save = useMutation({
    mutationFn: (body: CategoryRequest) =>
      editing?.id ? api.categories.update(editing.id, body) : api.categories.create(body),
    onSuccess: async () => {
      notify('success', editing ? 'Category updated' : 'Category created');
      close();
      await invalidate();
    },
    onError: (error: ApiError) => notify('error', error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.categories.remove(id),
    onSuccess: async () => {
      notify('success', 'Category deleted');
      await invalidate();
    },
    onError: (error: ApiError) => notify('error', error.message),
  });

  function openCreate() {
    setForm(BLANK);
    setEditing(null);
    setCreating(true);
  }

  function openEdit(category: CategoryResponse) {
    setForm({ name: category.name ?? '', description: category.description ?? '' });
    setEditing(category);
    setCreating(false);
  }

  function close() {
    setCreating(false);
    setEditing(null);
  }

  const open = creating || editing !== null;

  return (
    <>
      <div className="page-head">
        <h1>Categories</h1>
        <button className="btn primary" onClick={openCreate}>
          New category
        </button>
      </div>

      {query.isError && <ErrorState message={(query.error as ApiError).message} />}
      {query.isPending && <EmptyState message="Loading…" />}

      {query.data && (
        <>
          {query.data.content.length === 0 ? (
            <EmptyState message={`No categories for tenant "${tenant}" yet.`} />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {query.data.content.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td className="muted">{category.description || '—'}</td>
                    <td className="right nowrap">
                      <button className="btn ghost" onClick={() => openEdit(category)}>
                        Edit
                      </button>
                      <button
                        className="btn danger"
                        disabled={!category.id || remove.isPending}
                        onClick={() => {
                          if (category.id && window.confirm(`Delete "${category.name}"?`)) {
                            remove.mutate(category.id);
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
        <Modal title={editing ? 'Edit category' : 'New category'} onClose={close}>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(form);
            }}
          >
            <label>
              Name
              <input
                value={form.name}
                required
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
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
