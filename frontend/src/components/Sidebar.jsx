import { HARD, ISSUE_TYPES, VERSION_LABELS } from '../data/sampleDoc.js';

/** "How hard is it?" — hand-drawn difficulty gauge (feature 5). */
export function GaugeNote({ score, hardLeft, liveCount }) {
  const markX = 10 + (Math.min(score, 100) / 100) * 260;
  const level = score >= 60 ? 'fairly hard' : score >= 45 ? 'okay' : 'nice and easy';
  return (
    <section className="sticky" style={{ background: 'var(--note-blue)', transform: 'rotate(0.8deg)' }}>
      <h2 style={{ color: 'var(--blue)' }}>How hard is it?</h2>
      <svg viewBox="0 0 280 70" width="100%" role="img" aria-label={`Difficulty ${score} out of 100, ${level}`} style={{ marginTop: 6 }}>
        <path d="M8 36 C 70 30, 150 42, 272 34" stroke="#1f2a44" strokeWidth="3" fill="none" strokeLinecap="round" />
        <line x1="10" y1="36" x2={markX} y2="36" stroke="#f08a4b" strokeWidth="12" strokeLinecap="round" opacity=".75" style={{ transition: 'all .4s' }} />
        <line x1={markX} y1="14" x2={markX} y2="58" stroke="#d0336f" strokeWidth="3" strokeLinecap="round" style={{ transition: 'all .4s' }} />
        <text x="6" y="66" fontFamily="Caveat" fontSize="20" fill="#1f2a44">easy</text>
        <text x="238" y="66" fontFamily="Caveat" fontSize="20" fill="#1f2a44">hard</text>
      </svg>
      <p style={{ margin: '4px 0 0', fontSize: 20 }}>
        <b className="score">{score}</b> {level} —{' '}
        {hardLeft === 0 ? 'no hard sentences left!' : `${hardLeft} hard sentence${hardLeft > 1 ? 's' : ''}`}, {liveCount} fixes left
      </p>
    </section>
  );
}

/** "Simpler versions" — pick a rewrite for the current hard sentence (feature 6). */
export function SimplerNote({ doc, actions }) {
  const cur = doc.cur;
  const st = doc.simp[cur];
  const choice = doc.choice[cur] ?? 1;
  const total = HARD.length;
  return (
    <section id="simpler-note" className="sticky" style={{ background: 'var(--note-pink)', transform: 'rotate(-0.8deg)' }}>
      <div className="head">
        <h2 style={{ color: 'var(--rose)' }}>Simpler versions</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="round" type="button" aria-label="Previous hard sentence" onClick={() => actions.selectHard((cur + total - 1) % total, false)}>
            ‹
          </button>
          <span className="hand" style={{ fontSize: 22, fontWeight: 700 }} aria-live="polite">
            {cur + 1} / {total}
          </span>
          <button className="round" type="button" aria-label="Next hard sentence" onClick={() => actions.selectHard((cur + 1) % total, false)}>
            ›
          </button>
        </div>
      </div>
      <p className="orig">
        <b>#{cur + 1} original:</b> {HARD[cur].orig}
      </p>

      {!st && (
        <>
          <div role="radiogroup" aria-label="Pick a simpler version" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {HARD[cur].versions.map((t, i) => (
              <button key={i} className="ver" type="button" role="radio" aria-checked={i === choice} onClick={() => actions.choose(cur, i)}>
                <span className="dot">{i === choice ? '●' : '○'}</span>
                <span>
                  <span className="lbl">{VERSION_LABELS[i]}</span>
                  {t}
                </span>
              </button>
            ))}
          </div>
          <div className="row-btns" style={{ marginTop: 10, gap: 10 }}>
            <button className="tag" type="button" onClick={() => actions.setSimp(cur, 'swapped')}>
              swap it
            </button>
            <button className="tag flat" type="button" onClick={() => actions.setSimp(cur, 'kept')}>
              nah
            </button>
          </div>
        </>
      )}
      {st === 'swapped' && (
        <>
          <p style={{ margin: '6px 0 10px', fontSize: 19 }}>
            Swapped ✓ <span style={{ color: 'var(--blue)' }}>“{HARD[cur].versions[choice]}”</span>
          </p>
          <button className="tag" type="button" onClick={() => actions.setSimp(cur, null)}>
            ↶ undo
          </button>
        </>
      )}
      {st === 'kept' && (
        <>
          <p style={{ margin: '6px 0 10px', fontSize: 19 }}>Kept your original sentence.</p>
          <button className="tag" type="button" onClick={() => actions.setSimp(cur, null)}>
            show versions again
          </button>
        </>
      )}
    </section>
  );
}

const FILTERS = [
  ['all', 'all'],
  ['g', 'grammar'],
  ['s', 'spelling'],
  ['b', 'better'],
  ['h', 'hard word'],
];

/** "Quick fixes" — every open issue, filterable (features 7–9). */
export function FixesNote({ live, filter, actions }) {
  const count = (k) => (k === 'all' ? live.length : live.filter((i) => i.type === k).length);
  const shown = live.filter((i) => filter === 'all' || i.type === filter);
  const filterName = filter === 'all' ? '' : FILTERS.find((f) => f[0] === filter)[1] + ' ';
  return (
    <section className="sticky" style={{ background: 'var(--note-green)', transform: 'rotate(0.5deg)' }}>
      <h2 style={{ color: 'var(--green)', marginBottom: 8 }}>Quick fixes · {live.length}</h2>
      <div role="group" aria-label="Filter fixes" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} className="fchip" type="button" aria-pressed={filter === k} onClick={() => actions.setFilter(k)}>
            {label} {count(k)}
          </button>
        ))}
      </div>
      <div className="fix-list">
        {shown.map((i) => (
          <div className="fix-row" key={i.id}>
            <span style={{ minWidth: 0 }}>
              <span className="lbl" style={{ color: ISSUE_TYPES[i.type].color }}>
                {ISSUE_TYPES[i.type].label}
              </span>
              <a
                href={'#' + i.id}
                onClick={(e) => {
                  e.preventDefault();
                  actions.setOpen(i.id);
                }}
              >
                <s>{i.from}</s>
              </a>{' '}
              → <b>{i.to}</b>
            </span>
            <span className="acts">
              <button className="chip green" type="button" onClick={() => actions.fix([i.id])}>
                fix
              </button>
              <button className="chip grey" type="button" aria-label={`Ignore ${i.from}`} onClick={() => actions.ignore([i.id])}>
                ×
              </button>
            </span>
          </div>
        ))}
        {shown.length === 0 && <p className="clean">all clean here ✓</p>}
      </div>
      {shown.length > 0 && (
        <button className="tag" type="button" style={{ marginTop: 12 }} onClick={() => actions.fix(shown.map((i) => i.id))}>
          fix all {filterName}({shown.length})
        </button>
      )}
      <p className="hint">tap a word to jump to it in the text</p>
    </section>
  );
}

/** Shown beside the practice and blank pages. */
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
        <li>The gauge shows how easy your text is to read</li>
      </ol>
      <button className="tag" type="button" style={{ marginTop: 12 }} onClick={onOpenCheat}>
        open the cheat sheet
      </button>
    </section>
  );
}
