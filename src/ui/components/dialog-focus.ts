/** Keep keyboard focus inside an open modal and return it to its opener on close. */
export function installDialogFocus(dialog: HTMLElement, onClose: () => void): () => void {
  const doc = dialog.ownerDocument;
  const ownerWindow = doc.defaultView ?? window;
  const previousFocus = doc.activeElement as HTMLElement | null;
  const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
    'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'
  )).filter((el) => el.getClientRects().length > 0 && !el.hasAttribute("disabled"));

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Tab") {
      const items = focusable();
      if (items.length === 0) return;
      const active = doc.activeElement;
      if (!dialog.contains(active) ||
          (event.shiftKey && active === items[0]) ||
          (!event.shiftKey && active === items[items.length - 1])) {
        event.preventDefault();
        (event.shiftKey ? items[items.length - 1] : items[0]).focus();
      }
    }
  };
  ownerWindow.addEventListener("keydown", onKeyDown);
  return () => {
    ownerWindow.removeEventListener("keydown", onKeyDown);
    if (previousFocus?.isConnected) previousFocus.focus();
  };
}
