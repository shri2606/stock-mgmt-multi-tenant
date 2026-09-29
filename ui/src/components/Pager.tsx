interface PagerProps {
  page: number;
  totalPages: number;
  totalElements: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onChange: (page: number) => void;
}

export function Pager({
  page,
  totalPages,
  totalElements,
  hasPrevious,
  hasNext,
  onChange,
}: PagerProps) {
  return (
    <div className="pager">
      <span className="muted">
        {totalElements} {totalElements === 1 ? 'row' : 'rows'}
        {totalPages > 0 && ` · page ${page + 1} of ${totalPages}`}
      </span>
      <div className="pager-buttons">
        <button className="btn ghost" disabled={!hasPrevious} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <button className="btn ghost" disabled={!hasNext} onClick={() => onChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
