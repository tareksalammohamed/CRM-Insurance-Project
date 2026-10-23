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
it('manually expires a recent request, but issuing any policy takes precedence', () => {
  const request = { created_at: created, request_manually_expired: true, policies: [] as unknown[] };
  expect(customerRequestStatus(request, Date.parse(created) + 1000)).toBe('expired');
  for (const status of ['active', 'cancelled']) {
    expect(customerRequestStatus({ ...request, policies: [{ status }] }, boundary + 1)).toBe('with_policy');
  }
  expect(customerRequestStatus({ ...request, request_manually_expired: false }, boundary - 1)).toBe('issuance');
});
