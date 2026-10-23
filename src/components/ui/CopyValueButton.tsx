import { useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyValueButton({ value, label }: { value: string; label: string }) {
  const busy = useRef(false);
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const copy = async () => {
    if (busy.current) return;
    busy.current = true;
    setStatus('copying');
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('error');
    } finally {
      busy.current = false;
    }
  };
  return <div className="copy-value-control">
    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy()} disabled={status === 'copying'} aria-busy={status === 'copying'}>
      {status === 'copied' ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
      <span>{status === 'copying' ? 'جارِ النسخ…' : label}</span>
    </button>
    <span role="status" className="copy-value-status">{status === 'copied' ? 'تم النسخ' : status === 'error' ? 'تعذر النسخ. اضغط مطولًا على الرقم لنسخه يدويًا.' : ''}</span>
  </div>;
}
