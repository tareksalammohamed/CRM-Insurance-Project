import { expect, it, vi } from 'vitest';
vi.mock('../src/lib/supabase', () => ({ ROLE_LABELS: {} }));
import { qualifiesForRecommendationMemo } from '../src/pages/MonthlyClosing/components/RecommendationMemo';
import type { SupervisorAgg } from '../src/pages/MonthlyClosing/types';
const supervisor = (changes: Partial<SupervisorAgg> = {}): SupervisorAgg => ({
  id: 'supervisor', name: 'مراقب', role: 'supervisor', groupLeaders: [],
  production: 100000, collection: 80001, total: 180001,
  target: 200000, achievementRate: 90, directGroupLeaderCount: 3, ...changes,
});
it.each([179999, 180000])('does not attach the memo for total %s, even above 151 percent', total => {
  expect(qualifiesForRecommendationMemo(supervisor({ total, achievementRate: 200 }))).toBe(false);
});
it.each([180000.01, 180001, 250000])('attaches above the strict amount threshold: %s, regardless of percentage', total => {
  expect(qualifiesForRecommendationMemo(supervisor({ total, achievementRate: 90 }))).toBe(true);
});
it.each([0, 2, 4])('preserves exactly three direct group leaders (actual: %s)', directGroupLeaderCount => {
  expect(qualifiesForRecommendationMemo(supervisor({ directGroupLeaderCount }))).toBe(false);
});
it.each([0, -1])('preserves the positive monthly target condition (%s)', target => {
  expect(qualifiesForRecommendationMemo(supervisor({ target }))).toBe(false);
});
