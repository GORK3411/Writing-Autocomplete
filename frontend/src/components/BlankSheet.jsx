import { useLayoutEffect, useRef, useState } from 'react';
import { countWords, Holes, todayLabel } from './Sheet.jsx';

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
  const [caretAtEnd, setCaretAtEnd] = useState(true);

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
        <div className="blank-field">
          <div className="blank-mirror" aria-hidden="true">
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
            onKeyDown={onKeyDown}
            spellCheck={false}
          />
        </div>
      </article>
    </>
  );
}

const MARK_CLASS = { err: 'u-err', hard: 'u-hard', better: 'u-better' };

/** Mirror copy of the text with the highlight spans (the text itself stays invisible). */
function Highlighted({ chunks }) {
  return chunks.map((c, i) => {
    const parts = c.parts.map((p, j) =>
      p.mark ? (
        <span key={j} className={MARK_CLASS[p.mark]}>
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
