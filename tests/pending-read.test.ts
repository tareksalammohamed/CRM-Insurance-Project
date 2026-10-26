import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ identity: { userId: 'a' as string | null, generation: 0 } }));
vi.mock('../src/lib/dataCache', () => ({ getDataCacheIdentity: () => state.identity }));
import { pendingRead } from '../src/lib/pendingRead';
beforeEach(() => { state.identity = { userId: 'a', generation: state.identity.generation + 1 }; });
it('shares simultaneous reads and fetches again after completion', async () => {
  let finish!: (value: string[]) => void;
  const fetch = vi.fn(() => new Promise<string[]>(resolve => { finish = resolve; }));
  const a = pendingRead('scope', fetch); const b = pendingRead('scope', fetch);
  await Promise.resolve(); expect(fetch).toHaveBeenCalledOnce();
  finish(['a']); expect(await a).toEqual(['a']); expect(await b).toEqual(['a']);
  expect(await pendingRead('scope', async () => ['fresh'])).toEqual(['fresh']);
});
it('does not share across accounts or branches and releases failed requests', async () => {
  const a = pendingRead('scope:branch1', async () => ['a']);
  state.identity = { userId: 'b', generation: 2 };
  expect(await pendingRead('scope:branch1', async () => ['b'])).toEqual(['b']);
  expect(await a).toEqual(['a']);
  await expect(pendingRead('scope', async () => { throw new Error('failed'); })).rejects.toThrow('failed');
  expect(await pendingRead('scope', async () => ['retry'])).toEqual(['retry']);
  expect(await pendingRead('scope:branch2', async () => ['other branch'])).toEqual(['other branch']);
});
