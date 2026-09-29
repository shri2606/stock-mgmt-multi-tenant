/**
 * Shown when the backend does not return the ids this screen needs. The API
 * returns no `id` on ProductResponse or StockMvtResponse yet, which makes edit,
 * delete, and picking a product for a stock movement impossible.
 */
export function MissingIdNotice({ what }: { what: string }) {
  return (
    <div className="notice">
      <strong>{what} have no id in the API response.</strong> Edit and delete are
      disabled. Add an <code>id</code> field to the response DTO and its mapper to
      enable them.
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty">{message}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="notice error">{message}</div>;
}
