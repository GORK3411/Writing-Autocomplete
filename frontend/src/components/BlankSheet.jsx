import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { countWords, Holes, todayLabel } from './Sheet.jsx';
import { Popover } from './Popover.jsx';
import { spanToEdit } from '../edits.js';
import { suggestForTrigger, TRIGGER_TITLE, triggerAt, triggerQuery } from '../triggers.js';

const PLACEHOLDER = `Start writing…

Stuck on a word? Try:
   "describe the word"    [mot français / كلمة عربية]    {an idea → idiom}

Grey text = a suggestion. Press Tab to keep it.
Click a word box or use Alt+Enter to look it up.`;

/**
 * Empty page with the grey first-time hint (board 7c).
 *
 * Ghost text: a <textarea> can't colour part of its text, so a "mirror" div with
 * the same font sits behind it. The mirror's copy of the text is invisible and
 * only pushes the grey suggestion to exactly where the cursor is. The same mirror
 * paints the highlight backgrounds (yellow / blue / pink), which show through the
 * transparent textarea right under the matching words.
 */
export default function BlankSheet({ text, onChange, suggestion = '', suggestionSource, onAccept, highlights = [], currentSentence, caret, onEdit }) {
  const ref = useRef(null);
  const fieldRef = useRef(null);
  const mirrorRef = useRef(null);
  const [caretAtEnd, setCaretAtEnd] = useState(true);
  const trig = useTriggerPopup({ text, onEdit, highlights, textareaRef: ref, fieldRef, mirrorRef });

  const trackCaret = (el) =>
    setCaretAtEnd(el.selectionStart === el.selectionEnd && el.selectionEnd === el.value.length);

  // Grow with the text instead of scrolling, so the mirror never has to follow a scroll position.
  useLayoutEffect(() => {
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [text]);

  useLayoutEffect(() => {
    if (!caret) return;
    ref.current.focus();
    ref.current.setSelectionRange(caret.position, caret.position);
    trackCaret(ref.current);
  }, [caret]);

  // Only when typing at the end: a suggestion in the middle of the text would cover words.
  const ghost = text && caretAtEnd ? suggestion : '';

  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && e.altKey) {
      e.preventDefault();
      trig.openAtCaret(e.currentTarget);
      return;
    }
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
            <Highlighted chunks={highlights} current={currentSentence} />
            <span className="ghost" data-source={ghost ? suggestionSource : undefined}>{ghost}</span>
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
// `current` = start of the pink sentence shown in the "Simpler version" note (outlined).
function Highlighted({ chunks, current }) {
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
      <span key={i} className={'hardsent' + (c.start === current ? ' current' : '')}>
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
function useTriggerPopup({ text, onEdit, highlights, textareaRef, fieldRef, mirrorRef }) {
  const [open, setOpen] = useState(null); // { start, text, kind, left, top, height, options|null }
  const popRef = useRef(null);
  const lastRequest = useRef(0);

  const close = (refocus) => {
    setOpen(null);
    if (refocus) textareaRef.current?.focus();
  };

  const openAtCaret = (el) => {
    if (el.selectionStart !== el.selectionEnd) return;
    const part = triggerAt(highlights, el.selectionStart);
    if (!part || part.open) return setOpen(null);
    if (open && open.draft === text && open.start === part.start && !open.error) return; // already showing this one

    // Place the note under the box, using its span in the mirror.
    const span = mirrorRef.current?.querySelector(`[data-start="${part.start}"]`);
    const rects = span?.getClientRects();
    if (!rects?.length) return;
    const field = fieldRef.current.getBoundingClientRect();
    const first = rects[0];
    const last = rects[rects.length - 1];
    const pos = { left: Math.max(0, Math.min(first.left - field.left, field.width - 260)), top: last.top - field.top, height: last.height };

    const id = ++lastRequest.current;
    const next = { ...part, ...pos, id, draft: text, options: null };
    setOpen(next);
    suggestForTrigger(part.kind, triggerQuery(part), part.sentence, part.start - part.sentenceStart)
      .then((options) => setOpen((cur) => cur?.id === id ? { ...cur, options } : cur))
      .catch(() => setOpen((cur) => cur?.id === id ? { ...cur, error: true } : cur));
  };

  const stale = open && open.draft !== text;
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

  const pick = (candidate) => {
    if (open.draft !== text) return close(true);
    const edit = candidate.edit ? spanToEdit(open.sentence, candidate.edit, open.sentenceStart) :
      { start: open.start, from: open.text, to: candidate.text, sentence: open.sentence, sentenceStart: open.sentenceStart };
    if (edit) onEdit([edit]);
    setOpen(null);
  };

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
          {open.error ? (
            <span className="pop-hand">Word lookup unavailable. Check the local server and try again.</span>
          ) : open.options === null ? (
            <span className="pop-hand">looking for words…</span>
          ) : open.options.length ? (
            open.options.map((candidate) => (
              <button key={candidate.text} data-opt className="opt" type="button" onClick={() => pick(candidate)}>
                {candidate.edit?.suggestion ?? candidate.text}
              </button>
            ))
          ) : (
            <span className="pop-hand">No matching suggestions. Try another description or word.</span>
          )}
        </Popover>
      </span>
    ) : null;

  return { onClick: (event) => openAtCaret(event.currentTarget), openAtCaret, popup };
}
