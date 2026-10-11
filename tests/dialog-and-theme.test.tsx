import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AppDialog } from '../src/components/ui/AppDialog';
import { ThemeProvider } from '../src/hooks/ThemeProvider';
import { useTheme } from '../src/hooks/useTheme';
import { SearchInput } from '../src/components/forms/SearchInput';
afterEach(cleanup);
it('Escape closes only the top dialog and keeps scroll locked for its parent', () => {
  const parent = vi.fn(); const child = vi.fn();
  const { rerender } = render(<><AppDialog onClose={parent}><button>parent</button></AppDialog><AppDialog onClose={child}><button>child</button></AppDialog></>);
  fireEvent.keyDown(document, { key: 'Escape' }); expect(child).toHaveBeenCalledOnce(); expect(parent).not.toHaveBeenCalled();
  rerender(<AppDialog onClose={parent}><button>parent</button></AppDialog>);
  expect(document.body.style.overflow).toBe('hidden'); fireEvent.keyDown(document, { key: 'Escape' }); expect(parent).toHaveBeenCalledOnce();
});
it('restores scroll after the last dialog closes, including out-of-order removal', () => {
  document.body.style.overflow = 'auto';
  const { rerender, unmount } = render(<><AppDialog key="parent"><button>parent</button></AppDialog><AppDialog key="child"><button>child</button></AppDialog></>);
  rerender(<AppDialog key="child"><button>child</button></AppDialog>); expect(document.body.style.overflow).toBe('hidden');
  unmount(); expect(document.body.style.overflow).toBe('auto'); document.body.style.overflow = '';
});
it('traps Tab in a dialog and restores focus to its opener', async () => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(() => [{}] as unknown as DOMRectList);
  const opener = document.createElement('button'); document.body.append(opener); opener.focus();
  const { unmount } = render(<AppDialog ariaLabel="test"><button>first</button><button>last</button></AppDialog>);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByText('first')));
  screen.getByText('last').focus(); fireEvent.keyDown(document, { key: 'Tab' }); expect(document.activeElement).toBe(screen.getByText('first'));
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(screen.getByText('last'));
  unmount(); expect(document.activeElement).toBe(opener); opener.remove();
});
it('keeps the app and theme toggle usable when localStorage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('denied'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('denied'); });
  function Toggle() { const { toggleTheme, isDark } = useTheme(); return <button onClick={toggleTheme}>{isDark ? 'dark' : 'light'}</button>; }
  render(<ThemeProvider><Toggle /></ThemeProvider>); fireEvent.click(screen.getByText('light')); expect(screen.getByText('dark')).toBeTruthy();
});
it('returns focus to the search field after clearing', () => {
  const clear = vi.fn(); render(<SearchInput value="text" onChange={clear} placeholder="search" />);
  fireEvent.click(screen.getByLabelText('مسح البحث')); expect(clear).toHaveBeenCalledWith(''); expect(document.activeElement).toBe(screen.getByRole('searchbox'));
});
