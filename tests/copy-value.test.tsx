import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CopyValueButton } from '../src/components/ui/CopyValueButton';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('copies the exact phone including its leading zero and reports success after completion', async () => {
  let complete!: () => void;
  const writeText = vi.fn(() => new Promise<void>(resolve => { complete = resolve; }));
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  render(<CopyValueButton value="01001234567" label="نسخ الرقم" />);
  fireEvent.click(screen.getByRole('button'));
  expect(writeText).toHaveBeenCalledWith('01001234567');
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('status').textContent).toBe('');
  complete();
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('تم النسخ'));
});
it('provides manual-copy guidance when clipboard access is denied', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  render(<CopyValueButton value="01001234567" label="نسخ الرقم" />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('تعذر النسخ'));
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false);
});
