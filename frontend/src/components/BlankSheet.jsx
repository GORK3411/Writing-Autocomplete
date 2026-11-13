import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { countWords, Holes, todayLabel } from './Sheet.jsx';
import { Options, Popover } from './Popover.jsx';
import { suggestForTrigger, TRIGGER_TITLE, triggerAt, triggerQuery } from '../triggers.js';

const PLACEHOLDER = `Start writing…

Stuck on a word? Try:
   "describe the word"    [mot français / كلمة عربية]    {an idea → idiom}

Grey text = a suggestion. Press Tab to keep it.`;

/**
 * Empty page with the grey first-time hint (board 7c).
 *
 * Ghost text: a <textarea> can't colour part of its text, so a "mirror" div with
 * the same font sits behind it. The mirror's copy of the text is invisible and
 * only pushes the grey suggestion to exactly where the cursor is. The same mirror
 * paints the highlight backgrounds (yellow / blue / pink), which show through the
 * transparent textarea right under the matching words.
 */
export default function BlankSheet({ text, onChange, suggestion = '', onAccept, highlights = [] }) {
  const ref = useRef(null);
  const fieldRef = useRef(null);
  const mirrorRef = useRef(null);
  const [caretAtEnd, setCaretAtEnd] = useState(true);
  const trig = useTriggerPopup({ text, onChange, highlights, textareaRef: ref, fieldRef, mirrorRef });

  const trackCaret = (el) =>
    setCaretAtEnd(el.selectionStart === el.selectionEnd && el.selectionEnd === el.value.length);

  // Grow with the text instead of scrolling, so the mirror never has to follow a scroll position.
  useLayoutEffect(() => {
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [text]);

  // Only when typing at the end: a suggestion in the middle of the text would cover words.
  const ghost = text && caretAtEnd ? suggestion : '';

  const onKeyDown = (e) => {
    if (e.key === 'Tab' && ghost && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault(); // keep focus in the editor
      onAccept?.();
    }
  };

  return (
    <>
      <article className="sheet" style={{ minHeight: 620 }}>
        <Holes />
        <div className="sheet-meta">
          {todayLabel()} · {countWords(text)} words
        </div>
        <label htmlFor="nb-text" className="blank-label">
          Untitled page
        </label>
        <div className="blank-field" ref={fieldRef}>
          <div className="blank-mirror" aria-hidden="true" ref={mirrorRef}>
            <Highlighted chunks={highlights} />
            <span className="ghost">{ghost}</span>
          </div>
          <textarea
            ref={ref}
            id="nb-text"
            className="blank-text"
            rows={10}
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => {
              onChange(e.target.value);
              trackCaret(e.target);
            }}
            onSelect={(e) => trackCaret(e.target)}
            onClick={trig.onClick}
            onKeyDown={onKeyDown}
            spellCheck={false}
          />
          {trig.popup}
        </div>
      </article>
    </>
  );
}

const MARK_CLASS = { err: 'u-err', hard: 'u-hard', better: 'u-better', trig: 'u-trig' };

/** Mirror copy of the text with the highlight spans (the text itself stays invisible). */
function Highlighted({ chunks }) {
  return chunks.map((c, i) => {
    const parts = c.parts.map((p, j) =>
      p.mark ? (
        <span key={j} className={MARK_CLASS[p.mark] + (p.open ? ' open' : '')} data-start={p.mark === 'trig' ? p.start : undefined}>
          {p.text}
        </span>
      ) : (
        p.text
      ),
    );
    return c.hardSentence ? (
      <span key={i} className="hardsent">
        {parts}
      </span>
    ) : (
      <span key={i}>{parts}</span>
    );
  });
}

/**
 * Features 1-3: click inside a "..." / [...] / {...} box -> sticky note with words to
 * replace the whole box with. Returns the textarea click handler and the popup element.
 */
function useTriggerPopup({ text, onChange, highlights, textareaRef, fieldRef, mirrorRef }) {
  const [open, setOpen] = useState(null); // { start, text, kind, left, top, height, options|null }
  const popRef = useRef(null);
  const caretAfterPick = useRef(null);

  const close = (refocus) => {
    setOpen(null);
    if (refocus) textareaRef.current?.focus();
  };

  const onClick = (e) => {
    const el = e.target;
    if (el.selectionStart !== el.selectionEnd) return;
    const part = triggerAt(highlights, el.selectionStart);
    if (!part) return setOpen(null);
    if (open && open.start === part.start) return; // already showing this one

    // Place the note under the box, using its span in the mirror.
    const span = mirrorRef.current?.querySelector(`[data-start="${part.start}"]`);
    const rects = span?.getClientRects();
    if (!rects?.length) return;
    const field = fieldRef.current.getBoundingClientRect();
    const first = rects[0];
    const last = rects[rects.length - 1];
    const pos = { left: first.left - field.left, top: last.top - field.top, height: last.height };

    const next = { start: part.start, text: part.text, kind: part.kind, ...pos, options: null };
    setOpen(next);
    suggestForTrigger(part.kind, triggerQuery(part), part.sentence)
      .then((options) =>
        setOpen((cur) => (cur && cur.start === next.start && cur.text === next.text ? { ...cur, options } : cur)),
      )
      .catch((err) => {
        console.error('[trigger]', err);
        setOpen((cur) => (cur && cur.start === next.start ? { ...cur, options: [] } : cur));
      });
  };

  // The text changed under the box (typing, Tab, quick fix): the note is stale.
  const stale = open && text.slice(open.start, open.start + open.text.length) !== open.text;
  useEffect(() => {
    if (stale) setOpen(null);
  }, [stale]);

  // Click outside the note (and not in the textarea, whose own click decides) closes it.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || e.target === textareaRef.current) return;
      setOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, textareaRef]);

  const pick = (word) => {
    const end = open.start + open.text.length;
    caretAfterPick.current = open.start + word.length;
    onChange(text.slice(0, open.start) + word + text.slice(end));
    setOpen(null);
  };

  // Put the caret right after the inserted word once the new text is rendered.
  useLayoutEffect(() => {
    const pos = caretAfterPick.current;
    if (pos === null) return;
    caretAfterPick.current = null;
    const el = textareaRef.current;
    el.focus();
    el.setSelectionRange(pos, pos);
  }, [text, textareaRef]);

  const popup =
    open && !stale ? (
      <span
        className="anchor trig-anchor"
        ref={popRef}
        style={{ position: 'absolute', left: open.left, top: open.top, height: open.height }}
      >
        <Popover
          key={open.start + ':' + (open.options ? 'ready' : 'loading')}
          title={TRIGGER_TITLE[open.kind]}
          titleColor="var(--blue)"
          bg="var(--note-blue)"
          onClose={close}
        >
          {open.options === null ? (
            <span className="pop-hand">looking for words…</span>
          ) : open.options.length ? (
            <Options options={open.options.map(([w, s]) => [w, Math.round(s * 100) + '%'])} onPick={pick} />
          ) : (
            <span className="pop-hand">no idea yet — try describing it differently</span>
          )}
        </Popover>
      </span>
    ) : null;

  return { onClick, popup };
}
