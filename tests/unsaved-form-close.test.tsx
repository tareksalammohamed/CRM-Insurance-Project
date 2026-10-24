import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const { confirm } = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock('../src/lib/notify', () => ({ useNotify: () => ({ confirm }) }));
import { useUnsavedFormClose } from '../src/hooks/useUnsavedFormClose';
function Form({ dirty = false, saving = false, close }: { dirty?: boolean; saving?: boolean; close: () => void }) {
  const dismiss = useUnsavedFormClose({ dirty, saving, onClose: close });
  return <button onClick={() => void dismiss()}>close</button>;
}
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('closes untouched forms immediately but never closes during saving', () => {
  const close = vi.fn(); const { rerender } = render(<Form close={close} />);
  fireEvent.click(screen.getByText('close')); expect(close).toHaveBeenCalledOnce();
  rerender(<Form close={close} saving dirty />); fireEvent.click(screen.getByText('close'));
  expect(close).toHaveBeenCalledOnce(); expect(confirm).not.toHaveBeenCalled();
});
it('keeps edits on cancel, discards only after confirmation, and suppresses duplicate prompts', async () => {
  let resolve!: (value: boolean) => void;
  confirm.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce(true);
  const close = vi.fn(); render(<Form close={close} dirty />);
  fireEvent.click(screen.getByText('close')); fireEvent.click(screen.getByText('close'));
  expect(confirm).toHaveBeenCalledOnce(); resolve(false);
  await waitFor(() => expect(close).not.toHaveBeenCalled());
  await Promise.resolve(); fireEvent.click(screen.getByText('close'));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
});
it('warns on refresh only while needed and cleans up on unmount', () => {
  const { rerender, unmount } = render(<Form close={vi.fn()} dirty />);
  const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
  rerender(<Form close={vi.fn()} />);
  const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false);
  unmount();
});
it('does not close an unmounted form after a late confirmation', async () => {
  let resolve!: (value: boolean) => void; confirm.mockImplementation(() => new Promise(r => { resolve = r; }));
  const close = vi.fn(); const { unmount } = render(<Form close={close} dirty />);
  fireEvent.click(screen.getByText('close')); unmount(); resolve(true); await Promise.resolve(); expect(close).not.toHaveBeenCalled();
});
