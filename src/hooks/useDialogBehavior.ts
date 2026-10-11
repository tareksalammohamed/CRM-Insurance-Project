import { useEffect, useRef, type RefObject } from 'react';

const dialogStack: symbol[] = [];
let originalOverflow = '';
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogBehavior(onClose?: () => void, enabled = true, dialogRef?: RefObject<HTMLElement>): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const token = Symbol('dialog');
    const previous = document.activeElement as HTMLElement | null;
    if (!dialogStack.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    dialogStack.push(token);
    const topmost = () => dialogStack[dialogStack.length - 1] === token;
    const focusable = () => Array.from(dialogRef?.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      .filter((element) => element.getClientRects().length > 0 && !element.closest('[hidden], [inert], [aria-hidden="true"]'));
    const timer = setTimeout(() => {
      if (topmost() && dialogRef?.current && !dialogRef.current.contains(document.activeElement)) {
        (focusable()[0] ?? dialogRef.current).focus({ preventScroll: true });
      }
    }, 0);
    const handleKey = (event: KeyboardEvent) => {
      if (!topmost()) return;
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        closeRef.current?.();
      }
      if (event.key !== 'Tab' || !dialogRef?.current) return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); dialogRef.current.focus(); return; }
      const outside = !dialogRef.current.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKey);
      const wasTop = topmost();
      dialogStack.splice(dialogStack.indexOf(token), 1);
      if (!dialogStack.length) document.body.style.overflow = originalOverflow;
      if (wasTop && previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [enabled, dialogRef]);
}
