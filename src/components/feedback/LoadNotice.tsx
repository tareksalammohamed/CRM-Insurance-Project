import { AlertCircle, RefreshCw } from 'lucide-react';

interface LoadNoticeProps {
  message: string | null;
  loading?: boolean;
  onRetry: () => void;
}

export function LoadNotice({ message, loading = false, onRetry }: LoadNoticeProps) {
  if (!message) return null;
  return (
    <div className="load-notice" role="status" aria-live="polite">
      <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm leading-6">{message}</p>
      <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={onRetry}>
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        {loading ? 'جارٍ التحميل' : 'إعادة المحاولة'}
      </button>
    </div>
  );
}
