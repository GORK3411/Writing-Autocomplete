import { countWords, Holes, todayLabel } from './Sheet.jsx';

const PLACEHOLDER = `Start writing…

Stuck on a word? Try:
   "describe the word"    [mot français / كلمة عربية]    {an idea → idiom}

Grey text = a suggestion. Press Tab to keep it.`;

/** Empty page with the grey first-time hint (board 7c). */
export default function BlankSheet({ text, onChange }) {
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
        <textarea
          id="nb-text"
          className="blank-text"
          rows={10}
          placeholder={PLACEHOLDER}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </article>
      <p className="below-note">The grey hint disappears as soon as you type.</p>
    </>
  );
}
