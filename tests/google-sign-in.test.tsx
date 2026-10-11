import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { GoogleSignInButton } from '../src/components/auth/GoogleSignInButton';
const { exchange } = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: { signInWithIdToken: exchange } } }));
let config: Parameters<NonNullable<Window['google']>['accounts']['id']['initialize']>[0];
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  exchange.mockReset().mockResolvedValue({ error: null });
  window.google = { accounts: { id: {
    initialize: vi.fn(value => { config = value; }),
    renderButton: vi.fn(host => { const button = document.createElement('button'); button.textContent = 'Google account chooser'; host.append(button); }),
  } } };
});
afterEach(() => { cleanup(); delete window.google; vi.unstubAllGlobals(); vi.useRealTimers(); });
it('renders a visible official button and exchanges the token using matching nonce', async () => {
  const busy = vi.fn();
  render(<GoogleSignInButton clientId="test-client" disabled={false} onBusyChange={busy} onError={vi.fn()} />);
  await screen.findByRole('button', { name: 'Google account chooser' });
  await act(async () => { await config.callback({ credential: 'test-token' }); });
  const args = exchange.mock.calls[0][0];
  expect(args.provider).toBe('google'); expect(args.token).toBe('test-token');
  const hash = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(args.nonce));
  expect(Buffer.from(hash).toString('hex')).toBe(config.nonce);
  expect(busy.mock.calls).toEqual([[true], [false]]);
});
it('shows safe errors and releases loading after rejected token exchange', async () => {
  exchange.mockRejectedValue(new Error('unexpected provider failure'));
  const error = vi.fn(); const busy = vi.fn();
  render(<GoogleSignInButton clientId="test-client" disabled={false} onBusyChange={busy} onError={error} />);
  await screen.findByRole('button');
  await act(async () => { await config.callback({ credential: 'test-token' }); });
  expect(error.mock.calls.at(-1)?.[0]).toContain('تعذّر إكمال');
  expect(busy).toHaveBeenLastCalledWith(false);
});
it('blocks duplicate token submissions and ignores callbacks after unmount', async () => {
  exchange.mockReturnValue(new Promise(() => {}));
  const { unmount } = render(<GoogleSignInButton clientId="test-client" disabled={false} onBusyChange={vi.fn()} onError={vi.fn()} />);
  await screen.findByRole('button');
  act(() => { void config.callback({ credential: 'test' }); void config.callback({ credential: 'test' }); });
  expect(exchange).toHaveBeenCalledTimes(1);
  unmount(); void config.callback({ credential: 'test' }); expect(exchange).toHaveBeenCalledTimes(1);
});
it('times out blocked library loading and offers retry instead of waiting forever', async () => {
  delete window.google; vi.useFakeTimers();
  render(<GoogleSignInButton clientId="test-client" disabled={false} onBusyChange={vi.fn()} onError={vi.fn()} />);
  await act(async () => { vi.advanceTimersByTime(12000); });
  expect(screen.getByRole('alert').textContent).toContain('تعذّر تحميل');
  fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
  expect(screen.getByRole('status').textContent).toContain('جاري تجهيز');
});
it('disables the real button container during another sign-in', async () => {
  render(<GoogleSignInButton clientId="test-client" disabled onBusyChange={vi.fn()} onError={vi.fn()} />);
  await waitFor(() => expect(screen.getByLabelText('تسجيل الدخول بجوجل').hasAttribute('inert')).toBe(true));
  await screen.findByRole('button');
  await config.callback({ credential: 'test' }); expect(exchange).not.toHaveBeenCalled();
});
it('permits the Google stylesheet without broadening the rest of the CSP', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const csp = config.headers.flatMap((rule: { headers: {key: string; value: string}[] }) => rule.headers).find((h: {key: string}) => h.key === 'Content-Security-Policy').value as string;
  expect(csp.split(';').find(s => s.trim().startsWith('style-src'))).toContain('https://accounts.google.com/gsi/style');
  expect(csp).toContain("frame-ancestors 'none'");
});
