import { createContext } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const STORAGE_KEY = 'insurance-crm-theme';
export const ThemeContext = createContext<ThemeContextValue | null>(null);
