import { useState } from 'react';
// Side notes beside the page (board 7).

/** Side note shown beside the page. */
export function LearnNote({ onOpenCheat }) {
  return (
    <section className="sticky" style={{ background: 'var(--note-blue)', transform: 'rotate(1deg)' }}>
      <h2 style={{ color: 'var(--blue)', marginBottom: 6 }}>How it works</h2>
      <ol>
        <li>
          Put a description in <b>"quotes"</b>, a French or Arabic word in <b>[brackets]</b>, or an idea in <b>{'{curly brackets}'}</b>
        </li>
        <li>
          Grey text is a suggestion: press <span className="kbd">Tab</span> to keep it
        </li>
        <li>Click any colored word to see a fix</li>
      </ol>
      <button className="tag" type="button" style={{ marginTop: 12 }} onClick={onOpenCheat}>
        open the cheat sheet
      </button>
    </section>
  );
}

// ---- Placeholder notes (board 7). Dummy data until features 5, 6 and 9 are connected. ----

/**
 * Feature 5: live difficulty gauge. `score` is 0 (easy) … 100 (hard).
 * While `calculating` (user is typing), the score is replaced by "Calculating…".
 */
export function DifficultyNote({ score = 62, calculating = false, hardest = 'sentence 6 is the worst' }) {
  const markX = 10 + (score / 100) * 260;
  const level = score >= 60 ? 'fairly hard' : score >= 48 ? 'okay' : 'nice and easy';
  return (
    <section className="sticky" style={{ background: 'var(--note-blue)', transform: 'rotate(1.5deg)' }}>
      <h2 style={{ color: 'var(--blue)' }}>How hard is it?</h2>
      <svg viewBox="0 0 280 70" width="100%" role="img" aria-label={calculating ? 'Difficulty: calculating' : `Difficulty: ${score} out of 100, ${level}`} style={{ marginTop: 6 }}>
        <path d="M8 36 C 70 30, 150 42, 272 34" stroke="var(--ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <line x1="10" y1="36" x2={markX} y2="36" stroke="#f08a4b" strokeWidth="12" strokeLinecap="round" opacity=".75" />
        <line x1={markX} y1="14" x2={markX} y2="58" stroke="var(--rose-strong)" strokeWidth="3" strokeLinecap="round" />
        <text x="6" y="66" fontFamily="Caveat" fontSize="20" fill="var(--ink)">easy</text>
        <text x="238" y="66" fontFamily="Caveat" fontSize="20" fill="var(--ink)">hard</text>
      </svg>
      <p style={{ margin: '4px 0 0', fontSize: 20 }} aria-live="polite">
        {calculating ? (
          <b className="hand" style={{ fontSize: 40, color: 'var(--rose-strong)' }}>Calculating…</b>
        ) : (
          <>
            <b className="hand" style={{ fontSize: 40, color: 'var(--rose-strong)' }}>{score}</b> {level} — {hardest}
          </>
        )}
      </p>
    </section>
  );
}

/** Feature 6: simpler rewrite of the hardest sentence. */
export function SimplerNote({ suggestion = '"Despite the effects of moving, the decision came down to money."' }) {
  const [state, setState] = useState('hard'); // 'hard' | 'swapped' | 'kept'
  return (
    <section className="sticky" style={{ background: 'var(--note-pink)', transform: 'rotate(-1.5deg)' }}>
      <h2 style={{ color: 'var(--rose)' }}>Simpler version</h2>
      {state === 'hard' && (
        <>
          <p style={{ margin: '6px 0 12px', fontSize: 20, lineHeight: 1.4 }}>{suggestion}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="tag" type="button" onClick={() => setState('swapped')}>swap it</button>
            <button className="tag flat" type="button" onClick={() => setState('kept')}>nah</button>
          </div>
        </>
      )}
      {state === 'swapped' && (
        <>
          <p style={{ margin: '6px 0 12px', fontSize: 20 }}>Swapped! Sentence 6 is easy now.</p>
          <button className="tag" type="button" onClick={() => setState('hard')}>↶ undo</button>
        </>
      )}
      {state === 'kept' && (
        <>
          <p style={{ margin: '6px 0 12px', fontSize: 20 }}>Kept your original sentence.</p>
          <button className="tag" type="button" onClick={() => setState('hard')}>show again</button>
        </>
      )}
    </section>
  );
}

const MARK_CLASS = { err: 'k-err', hard: 'k-hard', better: 'k-better' };

/**
 * Feature 9 (+7/8): one-click corrections for every red / yellow / blue word.
 * `fixes` = [{ start, from, to, mark }]; `onFix(list)` applies them to the text.
 */
export function QuickFixesNote({ fixes = [], onFix }) {
  return (
    <section className="sticky fixes" style={{ background: 'var(--note-green)', transform: 'rotate(1deg)' }}>
      <h2 style={{ color: 'var(--green)', marginBottom: 6 }}>Quick fixes · {fixes.length}</h2>
      <div className="fixes-list">
        {fixes.map((f) => (
          <div key={f.start} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 20 }}>
            <span>
              <span className={MARK_CLASS[f.mark]}>{f.from}</span> → <b>{f.to}</b>
            </span>
            <button className="chip green" type="button" onClick={() => onFix?.([f])} aria-label={`Fix ${f.from} to ${f.to}`}>
              fix
            </button>
          </div>
        ))}
      </div>
      {fixes.length > 0 ? (
        <button className="tag" type="button" style={{ marginTop: 10 }} onClick={() => onFix?.(fixes)}>
          fix them all
        </button>
      ) : (
        <p className="hand" style={{ margin: '4px 0 0', fontSize: 24, color: 'var(--green)' }}>all clean ✓</p>
      )}
    </section>
  );
}
