import { supabase } from './supabase';
import { emitOfflineEvent } from './offlineEvents';

const HEALTH_CHECK_URL = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`;
export type ConnectionState = 'connected' | 'disconnected' | 'error';
interface NetworkSnapshot { state: ConnectionState; lastSyncAt: number; }
type Listener = (snapshot: NetworkSnapshot) => void;
let snapshot: NetworkSnapshot = {
  state: typeof navigator !== 'undefined' && !navigator.onLine ? 'disconnected' : 'connected',
  lastSyncAt: Date.now(),
};
const listeners = new Set<Listener>();
let teardown: (() => void) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let probe: Promise<boolean> | null = null;
let lifecycle = 0;

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
function setState(state: ConnectionState) {
  const previous = snapshot.state;
  if (previous === state && state !== 'connected') return;
  snapshot = { state, lastSyncAt: state === 'connected' ? Date.now() : snapshot.lastSyncAt };
  if (state === 'connected') stopPolling();
  if (state === 'disconnected' && previous !== 'disconnected') {
    emitOfflineEvent('data-cached', 'لا يوجد اتصال بالإنترنت.');
  }
  for (const listener of listeners) listener(snapshot);
}

async function probeRealConnectivity(): Promise<boolean> {
  // Focus, online and polling share one request, including on slow networks.
  if (probe) return probe;
  probe = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(HEALTH_CHECK_URL, { cache: 'no-store', signal: controller.signal });
      return response.ok;
    } catch { return false; }
    finally { clearTimeout(timer); }
  })();
  try { return await probe; } finally { probe = null; }
}
function ensurePolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void checkConnectivity();
  }, 4000);
}
async function checkConnectivity() {
  const currentLifecycle = lifecycle;
  const online = await probeRealConnectivity();
  if (!teardown || lifecycle !== currentLifecycle) return;
  if (online && navigator.onLine) setState('connected');
  else if (snapshot.state === 'disconnected') ensurePolling();
}
function ensureStarted() {
  if (teardown) return;
  lifecycle += 1;
  const handleOnline = () => { void checkConnectivity(); };
  const handleOffline = () => { setState('disconnected'); ensurePolling(); };
  const handleFocus = () => { if (snapshot.state === 'disconnected') void checkConnectivity(); };
  const handleVisibility = () => { if (document.visibilityState === 'visible') handleFocus(); };
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibility);
  // Supabase already retries dropped channels. Recreating one on CLOSED also
  // scheduled retries for our own unsubscribe, growing channels indefinitely.
  const channel = supabase.channel('connection-status-watch');
  teardown = () => {
    lifecycle += 1;
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibility);
    stopPolling();
    void supabase.removeChannel(channel);
    teardown = null;
  };
  channel.subscribe((status) => {
    if (teardown && status === 'SUBSCRIBED') setState('connected');
    // A failed WebSocket does not imply HTTPS or internet is unavailable.
  });
  if (!navigator.onLine) handleOffline();
  else if (snapshot.state === 'disconnected') void checkConnectivity();
}
export function subscribeNetwork(listener: Listener): () => void {
  listeners.add(listener);
  ensureStarted();
  listener(snapshot);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) teardown?.();
  };
}
export function getNetworkSnapshot(): NetworkSnapshot { return snapshot; }
export function isOnline(): boolean { return snapshot.state !== 'disconnected'; }
