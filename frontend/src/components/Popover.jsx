import { useEffect, useRef } from 'react';

/**
 * An inline word/phrase with a sticky-note pop-up anchored under it.
 * Keyboard: ↑/↓ move between choices, Enter picks, Esc closes and returns focus.
 */
export function PopAnchor({ id, open, onToggle, onClose, renderTrigger, note, children }) {
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  const close = (refocus) => {
    onClose();
    if (refocus) triggerRef.current?.focus();
  };

  // Close when clicking anywhere outside the note.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onClose]);

  return (
    <span className="anchor" id={id} ref={wrapRef}>
      {renderTrigger({ ref: triggerRef, onClick: onToggle, 'aria-expanded': open })}
      {open && (
        <Popover {...note} onClose={close}>
          {children}
        </Popover>
      )}
    </span>
  );
}

function Popover({ title, titleColor, bg, width, onClose, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const first = ref.current?.querySelector('[data-opt]');
    first?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const btns = [...ref.current.querySelectorAll('[data-opt]')];
      if (!btns.length) return;
      const i = btns.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length;
      btns[next].focus();
      e.preventDefault();
    }
  };

  return (
    <span
      className="pop"
      role="dialog"
      aria-label={title}
      ref={ref}
      style={{ background: bg, width }}
      onKeyDown={onKeyDown}
    >
      <button className="x" type="button" aria-label="Close" onClick={() => onClose(true)}>
        ×
      </button>
      <span className="pop-title" style={{ color: titleColor }}>
        {title}
      </span>
      {children}
    </span>
  );
}

/** List of word choices, first one pre-highlighted. */
export function Options({ options, onPick, stacked }) {
  return options.map(([word, score], i) => (
    <button
      key={word}
      data-opt
      type="button"
      className={'opt' + (i === 0 ? ' top' : '') + (stacked ? ' stack' : '')}
      onClick={() => onPick(word)}
    >
      <span>{word}</span>
      <span className={stacked ? 'sub' : undefined}>{score}</span>
    </button>
  ));
}

/** Keyboard tip shown inside the first 3 notes a user opens. */
export function KeyTip({ num }) {
  return (
    <span className="tip">
      tip: <span className="kbd">Enter</span> pick · <span className="kbd">↑↓</span> choose ·{' '}
      <span className="kbd">Esc</span> keep what you typed
      <br />
      (hint {num} of 3, then I’ll stop)
    </span>
  );
}
