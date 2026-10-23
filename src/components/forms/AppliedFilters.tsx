interface AppliedFiltersProps {
  labels: string[];
  onReset: () => void;
  resetLabel?: string;
}

/** Shows applied values, never the unsubmitted filter drafts. */
export function AppliedFilters({ labels, onReset, resetLabel = 'مسح البحث والفلاتر' }: AppliedFiltersProps) {
  if (!labels.length) return null;
  return (
    <div className="applied-filters" aria-label="الفلاتر المطبقة">
      <span className="applied-filters-label">العرض الحالي:</span>
      <ul>{labels.map((label, index) => <li key={`${index}:${label}`}>{label}</li>)}</ul>
      <button type="button" onClick={onReset} className="btn btn-ghost btn-sm">{resetLabel}</button>
    </div>
  );
}
