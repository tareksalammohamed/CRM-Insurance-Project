import { expect, it } from 'vitest';
import { customerRequestStatus, REQUEST_EXPIRY_MS, requestExpiryCutoff } from '../src/lib/customerRequestStatus';
const created = '2026-08-01T10:15:00.000Z';
const boundary = Date.parse(created) + REQUEST_EXPIRY_MS;
it('expires only after 60 full days, including the exact boundary', () => {
  expect(customerRequestStatus({ created_at: created, policies: [] }, boundary - 1)).toBe('issuance');
  expect(customerRequestStatus({ created_at: created, policies: [] }, boundary)).toBe('expired');
  expect(customerRequestStatus({ created_at: created, policies: [] }, boundary + 1)).toBe('expired');
  expect(requestExpiryCutoff(boundary)).toBe(created);
});
it('never classifies a customer with any policy as a spoiled request', () => {
  for (const status of ['active', 'cancelled']) expect(customerRequestStatus({ created_at: created, policies: [{ status }] }, boundary + REQUEST_EXPIRY_MS)).toBe('with_policy');
});
it('uses elapsed days across month lengths and time zones', () => {
  expect(customerRequestStatus({ created_at: '2026-08-01T13:15:00+03:00', policies: [] }, boundary)).toBe('expired');
  expect(customerRequestStatus({ created_at: new Date(boundary + 1000).toISOString() }, boundary)).toBe('issuance');
});
