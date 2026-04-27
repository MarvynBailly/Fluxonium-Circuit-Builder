import { useEffect } from 'react';

/**
 * Global keyboard shortcuts for the circuit editor:
 *   Ctrl/Cmd+Z            → undo
 *   Ctrl/Cmd+Shift+Z / +Y → redo
 *   Ctrl/Cmd+C            → onCopy()
 *   Ctrl/Cmd+V            → onPaste()
 *   Ctrl/Cmd+Q            → onRotate()        (Shift inverts direction)
 *   Escape                → onEscape()
 *   Delete / Backspace    → onDelete()
 *
 * Shortcuts that conflict with browser defaults (C / V) are
 * suppressed only when the focus is outside text inputs, so input
 * editing keeps working as expected.
 */
export function useKeyboardShortcuts({
  undo,
  redo,
  onEscape,
  onDelete,
  onCopy,
  onPaste,
  onRotate,
}) {
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const inInput = e.target && e.target.tagName === 'INPUT';

      if (mod && e.key === 'z') {
        e.preventDefault();
        (e.shiftKey ? redo : undo)();
        return;
      }
      if (mod && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Escape') {
        onEscape();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (inInput) return;
        onDelete();
        return;
      }
      if (mod && (e.key === 'c' || e.key === 'C')) {
        if (inInput) return;
        if (!onCopy) return;
        e.preventDefault();
        onCopy();
        return;
      }
      if (mod && (e.key === 'v' || e.key === 'V')) {
        if (inInput) return;
        if (!onPaste) return;
        e.preventDefault();
        onPaste();
        return;
      }
      if (mod && (e.key === 'q' || e.key === 'Q')) {
        if (inInput) return;
        if (!onRotate) return;
        e.preventDefault();
        onRotate(e.shiftKey);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, onEscape, onDelete, onCopy, onPaste, onRotate]);
}
