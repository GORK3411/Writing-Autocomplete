/**
 * Feature 5: live difficulty gauge. `score` is 0 (easy) … 100 (hard).
 * While `calculating` (user is typing), the score is replaced by "Calculating…".
 */
export function DifficultyNote({ score = null, calculating = false, hardest = '' }) {
  const markX = 10 + (score / 100) * 260;
  const level = score >= 60 ? 'fairly hard' : score >= 48 ? 'okay' : 'nice and easy';
  return (
    <section className="sticky" style={{ background: 'var(--note-blue)', transform: 'rotate(1.5deg)' }}>
      <h2 style={{ color: 'var(--blue)' }}>Readability estimate</h2>
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
        ) : score === null ? (
          <span>Finish a sentence to see its score.</span>
        ) : (
          <>
            <b className="hand" style={{ fontSize: 40, color: 'var(--rose-strong)' }}>{score}</b> {level} — {hardest}
          </>
        )}
      </p>
    </section>
  );
}

/** Feature 6 requests a preview only when the writer clicks Simplify. */
export function SimplerNote({ sentences, index, onIndex, preview, onPreview, onSwap, onKeep }) {
  const item = sentences[index];
  const count = sentences.length;
  return (
    <section className="sticky simpler" style={{ background: 'var(--note-pink)', transform: 'rotate(-1.5deg)' }}>
      <div className="simpler-head">
        <h2 style={{ color: 'var(--rose)' }}>Simpler version</h2>
        {count > 1 && (
          <div className="pager">
            <button
              className="arrow"
              type="button"
              aria-label="Previous hard sentence"
              disabled={index === 0}
              onClick={() => onIndex?.(index - 1)}
            >
              ‹
            </button>
            <span className="hand" aria-live="polite">
              {index + 1} / {count}
            </span>
            <button
              className="arrow"
              type="button"
              aria-label="Next hard sentence"
              disabled={index === count - 1}
              onClick={() => onIndex?.(index + 1)}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {item ? (
        <>
          <p className="simpler-from">{item.text}</p>
          {preview?.status === "ready" && <p className="simpler-result">{preview.result}</p>}
          {preview?.status === "loading" && <p role="status">Preparing a simpler version…</p>}
          {preview?.status === "empty" && <p role="status">No simpler version passed the readability and preservation checks.</p>}
          {preview?.status === "error" && <p role="status">The simplification model is unavailable.</p>}
          <div className="check-actions">
            {preview?.status === "ready"
              ? <button className="tag" type="button" onClick={() => onSwap(item)}>Apply rewrite</button>
              : <button className="tag" type="button" disabled={preview?.status === "loading"}
                  onClick={() => onPreview(item)}>Simplify sentence</button>}
            <button className="tag flat" type="button" onClick={() => onKeep(item)}>Keep original</button>
          </div>
        </>
      ) : (
        <p className="hand" style={{ margin: '4px 0 0', fontSize: 24, color: 'var(--rose)' }}>No hard sentence to simplify.</p>
      )}
    </section>
  );
}

const MARK_CLASS = { err: 'k-err', hard: 'k-hard', better: 'k-better' };

/**
 * Feature 9 (+7/8): one-click corrections for every red / yellow / blue word.
 * `fixes` = [{ start, from, to, mark }]; `onFix(list)` applies them to the text.
 */
export function QuickFixesNote({ fixes = [], onFix, checking, unavailable }) {
  return (
    <section className="sticky fixes" style={{ background: 'var(--note-green)', transform: 'rotate(1deg)' }}>
      <h2 style={{ color: 'var(--green)', marginBottom: 6 }}>Quick fixes · {fixes.length}</h2>
      <div className="fixes-list">
        {fixes.map((f) => (
          <div key={f.start} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 20 }}>
            <span>
              <span className={MARK_CLASS[f.mark]}>{f.from || 'Insert'}</span> → <b>{f.to || 'Delete'}</b>
            </span>
            <button className="chip green" type="button" onClick={() => onFix?.([f])} aria-label={`Fix ${f.from} to ${f.to}`}>
              fix
            </button>
          </div>
        ))}
      </div>
      {fixes.length > 0 ? (
        <button className="tag" type="button" style={{ marginTop: 10 }} onClick={() => onFix?.(fixes)}>
          Apply all fixes
        </button>
      ) : (
        <p className="hand" style={{ margin: '4px 0 0', fontSize: 24, color: 'var(--green)' }}>{checking ? 'Checking…' : unavailable ? 'Some checks are unavailable.' : 'No fixes to review.'}</p>
      )}
    </section>
  );
}
