import { useState } from 'react';
import { LESSONS } from '../data/lessons.js';
import { KeyTip, Options, PopAnchor } from './Popover.jsx';
import { Holes } from './Sheet.jsx';

/** First-visit practice page (board 7c). */
export default function PracticeSheet({ done, onDone, showTip, tipNum, onStartWriting, onOpenSample }) {
  const [open, setOpen] = useState(null);
  const doneCount = Object.keys(done).length;
  const ghostLesson = LESSONS.find((l) => l.ghost);
  const ghostPending = ghostLesson && !done[ghostLesson.key];

  const finish = (key, value) => {
    setOpen(null);
    onDone(key, value);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Tab' && !e.shiftKey && e.target === e.currentTarget && ghostPending) {
      e.preventDefault();
      finish(ghostLesson.key, true);
    }
  };

  return (
    <article className="sheet" tabIndex={0} aria-label="Practice page" onKeyDown={onKeyDown}>
      <Holes />
      <div className="sheet-meta" style={{ color: 'var(--green)', fontWeight: 700, fontSize: 22 }}>
        {doneCount} of {LESSONS.length} tried
      </div>
      <h2 className="sheet-title">Welcome! Try these {LESSONS.length} tricks ↓</h2>
      <p className="welcome-sub">
        This is a practice page. Click the blue boxes (or put your cursor in them) to see what happens.
      </p>

      {LESSONS.map((l, i) => {
        const val = done[l.key];
        const isOpen = open === l.key && !val;
        return (
          <div className="lesson" key={l.key}>
            <div className="lesson-instr">
              {i + 1}. {l.instr} {val && <span className="ok">✓ nice!</span>}
            </div>
            <p>
              {l.before}
              {l.ghost ? (
                val ? (
                  <span className="ins">{l.result}</span>
                ) : (
                  <>
                    <span className="caret" aria-hidden="true" />
                    <span className="ghost">{l.ghost}</span>{' '}
                    <button className="chip" type="button" onClick={() => finish(l.key, true)}>
                      press Tab
                    </button>
                  </>
                )
              ) : val ? (
                <span className="ins">{val}</span>
              ) : (
                <PopAnchor
                  open={isOpen}
                  onToggle={() => setOpen(isOpen ? null : l.key)}
                  onClose={() => setOpen(null)}
                  note={{ title: l.title, titleColor: 'var(--blue)', bg: l.bg }}
                  renderTrigger={(p) => (
                    <button {...p} className="w trig" type="button">
                      {l.trig}
                    </button>
                  )}
                >
                  <Options options={l.options} onPick={(w) => finish(l.key, w)} />
                  {showTip && <KeyTip num={tipNum} />}
                </PopAnchor>
              )}
              {!l.ghost && l.after}
            </p>
          </div>
        );
      })}

      <div className="welcome-foot">
        <button className="tag" type="button" onClick={onStartWriting} style={{ background: 'var(--note-green)' }}>
          clear page &amp; start writing →
        </button>
        <button className="tag flat" type="button" onClick={onOpenSample}>
          or open the sample text
        </button>
        <span className="hand" style={{ fontSize: 20, color: 'var(--ink-soft)' }}>
          forgot something later? tap the yellow <b>?</b> note
        </span>
      </div>
    </article>
  );
}
