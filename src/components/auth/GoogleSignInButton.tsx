import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errorMessages';

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; nonce: string }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    } } };
  }
}

export function GoogleSignInButton({ clientId, disabled, onBusyChange, onError }: {
  clientId?: string; disabled: boolean; onBusyChange: (busy: boolean) => void; onError: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ disabled, onBusyChange, onError });
  callbacks.current = { disabled, onBusyChange, onError };
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { container.current?.toggleAttribute('inert', disabled); }, [disabled]);
  useEffect(() => {
    if (!clientId) { setState('failed'); return; }
    let active = true;
    let initializing = false;
    let submitting = false;
    setState('loading');
    const host = container.current;
    host?.replaceChildren();
    const initialize = async () => {
      if (!active || initializing || !window.google || !host) return;
      initializing = true;
      clearInterval(interval);
      try {
        const rawNonce = crypto.randomUUID();
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
        if (!active) return;
        const nonce = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
        window.google.accounts.id.initialize({ client_id: clientId, nonce,
          callback: async ({ credential }) => {
            if (!active || submitting || callbacks.current.disabled) return;
            submitting = true;
            callbacks.current.onError('');
            callbacks.current.onBusyChange(true);
            try {
              const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce: rawNonce });
              if (error) throw error;
            } catch (error) {
              if (active) callbacks.current.onError(friendlyError(error, 'تعذّر إكمال الدخول بجوجل. أعد المحاولة أو استخدم البريد وكلمة المرور.'));
            } finally {
              submitting = false;
              if (active) callbacks.current.onBusyChange(false);
            }
          },
        });
        // A genuine user click on Google's visible button opens the account chooser.
        // Do not proxy clicks into an invisible iframe or depend on One Tap prompts.
        window.google.accounts.id.renderButton(host, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', locale: 'ar', width: Math.min(320, host.clientWidth || 280) });
        clearTimeout(timeout);
        setState('ready');
      } catch {
        if (active) { clearTimeout(timeout); setState('failed'); }
      }
    };
    const interval = setInterval(() => { void initialize(); }, 200);
    const timeout = setTimeout(() => { active = false; clearInterval(interval); setState('failed'); }, 12000);
    void initialize();
    return () => { active = false; clearInterval(interval); clearTimeout(timeout); host?.replaceChildren(); };
  }, [clientId, attempt]);

  return <div className="col-span-2 min-w-0 space-y-2">
    <div ref={container} className="flex min-h-11 justify-center" aria-label="تسجيل الدخول بجوجل" aria-busy={disabled} />
    {state === 'loading' && <p role="status" className="text-center text-xs text-secondary-500">جاري تجهيز زر جوجل…</p>}
    {state === 'failed' && <div role="alert" className="text-center text-sm text-error-700">
      <p>{clientId ? 'تعذّر تحميل تسجيل الدخول بجوجل. تحقق من الاتصال أو افتح التطبيق في متصفح خارجي.' : 'تسجيل الدخول بجوجل غير مهيّأ حاليًا. استخدم البريد وكلمة المرور.'}</p>
      {clientId && <button type="button" className="btn btn-secondary mt-2" disabled={disabled} onClick={() => setAttempt(n => n + 1)}>إعادة المحاولة</button>}
    </div>}
    {disabled && <p role="status" className="text-center text-xs text-secondary-500">جاري إتمام تسجيل الدخول…</p>}
  </div>;
}
