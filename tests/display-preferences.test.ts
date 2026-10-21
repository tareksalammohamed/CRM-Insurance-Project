import { afterEach, expect, it, vi } from 'vitest';
import { applyDisplayPreferences, readDisplayPreferences, saveDisplayPreferences, DISPLAY_KEY } from '../src/lib/displayPreferences';
afterEach(() => { localStorage.clear(); document.documentElement.className = ''; });
it('survives invalid or restricted local storage and applies preferences in memory', () => {
  localStorage.setItem(DISPLAY_KEY, '{broken');
  expect(readDisplayPreferences().compact).toBe(false);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(() => saveDisplayPreferences({ compact: true, largeText: true, reduceMotion: true })).not.toThrow();
  expect(document.documentElement.classList.contains('crm-reduce-motion')).toBe(true);
});
it('restores normal display without affecting the dark theme', () => {
  document.documentElement.classList.add('dark');
  applyDisplayPreferences({ compact: false, reduceMotion: false, largeText: false });
  expect(document.documentElement.className).toBe('dark');
});
