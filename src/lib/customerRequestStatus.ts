export const REQUEST_EXPIRY_MS = 60 * 24 * 60 * 60 * 1000;
export type CustomerRequestStatus = 'issuance' | 'expired' | 'with_policy';
export function requestExpiryCutoff(now = Date.now()): string {
  return new Date(now - REQUEST_EXPIRY_MS).toISOString();
}
export function customerRequestStatus(customer: { created_at: string; policies?: readonly unknown[] | null }, now = Date.now()): CustomerRequestStatus {
  if (customer.policies?.length) return 'with_policy';
  return new Date(customer.created_at).getTime() <= now - REQUEST_EXPIRY_MS ? 'expired' : 'issuance';
}
