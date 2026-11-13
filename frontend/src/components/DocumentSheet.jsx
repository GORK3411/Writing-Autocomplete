import { useEffect } from 'react';
import { HARD, ISSUE_TYPES, MODEL, TITLE, TRIGGERS } from '../data/sampleDoc.js';
import { KeyTip, Options, PopAnchor } from './Popover.jsx';
import { Holes, todayLabel } from './Sheet.jsx';

/** The annotated sample text (boards 7 + 7b). */
export default function DocumentSheet({ doc, words, auto, showTip, tipNum, actions }) {
  const { open } = doc;

  // Jump to an issue opened from the "Quick fixes" note.
  useEffect(() => {
    if (open) document.getElementById(open)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [open]);

  const ghost = MODEL.paragraphs.flat().find((s) => s.kind === 'ghost');
  const ghostLeft = auto && ghost && doc.ghost < ghost.parts.length;

  const onKeyDown = (e) => {
    // Tab accepts the grey suggestion while the page itself has focus.
    if (e.key === 'Tab' && !e.shiftKey && e.target === e.currentTarget && ghostLeft) {
      e.preventDefault();
      actions.acceptGhost();
    }
  };

  return (
    <article
      className="sheet doc"
      tabIndex={0}
      aria-label="Your text. Press Tab to accept the grey suggestion."
      onKeyDown={onKeyDown}
    >
      <Holes />
      <div className="sheet-meta">
        {todayLabel()} · {words} words
      </div>
      <h2 className="sheet-title">{TITLE}</h2>
      {MODEL.paragraphs.map((sentences, pi) => (
        <p key={pi}>
          {sentences.map((s, si) => (
            <Sentence key={si} s={s} doc={doc} auto={auto} showTip={showTip} tipNum={tipNum} actions={actions} />
          ))}
        </p>
      ))}
    </article>
  );
}

function Sentence({ s, doc, auto, showTip, tipNum, actions }) {
  if (s.kind === 'hard') {
    const k = s.index;
    const st = doc.simp[k];
    const choice = doc.choice[k] ?? 1;
    if (st === 'swapped') return <><span className="ins">{HARD[k].versions[choice]}</span> </>;
    if (st === 'kept') return <>{HARD[k].orig} </>;
    return (
      <>
        <button
          type="button"
          className={'w hardsent' + (doc.cur === k ? ' current' : '')}
          onClick={() => actions.selectHard(k)}
          aria-label={`Hard sentence ${k + 1}: ${HARD[k].orig} Click to see simpler versions.`}
        >
          {HARD[k].orig}
        </button>
        <span className="badge" aria-hidden="true">#{k + 1}</span>{' '}
      </>
    );
  }

  if (s.kind === 'ghost') {
    const accepted = s.parts.slice(0, doc.ghost).join('');
    const next = auto ? s.parts[doc.ghost] : undefined;
    return (
      <>
        {s.before}
        {accepted}
        <span className="caret" aria-hidden="true" />
        {next && (
          <>
            <span className="ghost">{next}</span>{' '}
            <button className="chip" type="button" onClick={actions.acceptGhost}>
              press Tab
            </button>
          </>
        )}
      </>
    );
  }

  return (
    <>
      {s.tokens.map((t, i) => {
        if (t.kind === 'text') return <span key={i}>{t.text}</span>;
        if (t.kind === 'trigger') return <Trigger key={i} k={t.key} doc={doc} showTip={showTip} tipNum={tipNum} actions={actions} />;
        return <Issue key={i} issue={t.issue} doc={doc} actions={actions} />;
      })}{' '}
    </>
  );
}

function Issue({ issue, doc, actions }) {
  if (doc.fixed[issue.id]) return <span className="ins">{issue.to}</span>;
  if (doc.ignored[issue.id]) return <span>{issue.from}</span>;
  const ty = ISSUE_TYPES[issue.type];
  const isOpen = doc.open === issue.id;
  return (
    <PopAnchor
      id={issue.id}
      open={isOpen}
      onToggle={() => actions.setOpen(isOpen ? null : issue.id)}
      onClose={actions.close}
      note={{ title: ty.label, titleColor: ty.color, bg: ty.bg, width: 250 }}
      renderTrigger={(p) => (
        <button
          {...p}
          type="button"
          className={`w ${ty.cls}${isOpen ? ' active' : ''}`}
          aria-label={`${issue.from} — ${ty.label}: suggest ${issue.to}`}
        >
          {issue.from}
        </button>
      )}
    >
      <span>
        <s>{issue.from}</s> → <b>{issue.to}</b>
      </span>
      <span className="row-btns">
        <button data-opt className="chip" type="button" onClick={() => actions.fix([issue.id])}>
          fix
        </button>
        <button data-opt className="chip grey" type="button" onClick={() => actions.ignore([issue.id])}>
          ignore
        </button>
      </span>
    </PopAnchor>
  );
}

function Trigger({ k, doc, showTip, tipNum, actions }) {
  const tr = TRIGGERS[k];
  const picked = doc.picks[k];
  if (picked) return <span className="ins">{picked}</span>;
  const id = 'tr-' + k;
  const isOpen = doc.open === id;
  return (
    <PopAnchor
      id={id}
      open={isOpen}
      onToggle={() => actions.setOpen(isOpen ? null : id)}
      onClose={actions.close}
      note={{ title: tr.title, titleColor: tr.color, bg: tr.bg }}
      renderTrigger={(p) => (
        <button {...p} type="button" className="w trig">
          {tr.raw}
        </button>
      )}
    >
      <Options options={tr.options} stacked={tr.stacked} onPick={(w) => actions.pick(k, w)} />
      {tr.note && <span className="pop-hand">{tr.note}</span>}
      {showTip && <KeyTip num={tipNum} />}
    </PopAnchor>
  );
}
