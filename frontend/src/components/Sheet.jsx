/** Shared bits of the notebook paper. */
export function Holes() {
  return (
    <div className="holes" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

export function todayLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function countWords(text) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Color key under the page — same colors everywhere in the UI. */
export function Legend({ withFind = true, sentLabel = 'pink #n' }) {
  return (
    <div className="legend">
      {withFind && (
        <span>
          <span className="k-find">"…" […] {'{…}'}</span> = find a word
        </span>
      )}
      <span>
        <span className="k-err">red squiggle</span> = grammar &amp; spelling
      </span>
      <span>
        <span className="k-better">blue marker</span> = better word
      </span>
      <span>
        <span className="k-hard">yellow marker</span> = hard word
      </span>
      <span>
        <span className="k-sent">{sentLabel}</span> = hard sentence
      </span>
    </div>
  );
}
