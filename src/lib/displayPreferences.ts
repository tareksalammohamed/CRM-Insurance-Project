export const DISPLAY_KEY = 'crm-display-preferences';
export interface DisplayPreference { compact: boolean; reduceMotion: boolean; largeText: boolean }
export function readDisplayPreferences(): DisplayPreference {
  try {
    const saved = JSON.parse(localStorage.getItem(DISPLAY_KEY) || '{}');
    return { compact: saved?.compact === true, reduceMotion: saved?.reduceMotion === true, largeText: saved?.largeText === true };
  } catch { return { compact: false, reduceMotion: false, largeText: false }; }
}
export function applyDisplayPreferences(value: DisplayPreference) {
  document.documentElement.classList.toggle('crm-compact', value.compact);
  document.documentElement.classList.toggle('crm-reduce-motion', value.reduceMotion);
  document.documentElement.classList.toggle('crm-large-text', value.largeText);
}
export function saveDisplayPreferences(value: DisplayPreference) {
  try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(value)); } catch { /* Keep the current session usable. */ }
  applyDisplayPreferences(value);
}
