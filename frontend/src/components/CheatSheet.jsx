import { useEffect, useRef } from 'react';

/** The yellow "?" note: every trick on one page (board 7c). */
export default function CheatSheet({ onClose, onReplay }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="cs-title" className="cheat">
        <button ref={closeRef} className="x" type="button" aria-label="Close cheat sheet" onClick={onClose} style={{ top: 10, right: 12 }}>
          ×
        </button>
        <h2 id="cs-title">Cheat sheet</h2>
        <p style={{ margin: '0 0 16px', fontSize: 18, color: 'var(--ink-soft)' }}>Everything works right inside your text.</p>
        <div className="cheat-grid">
          <div>
            <h3 style={{ color: 'var(--blue)' }}>Find the right words</h3>
            <Row k={<b>"…"</b>} what="Describe a word" ex={<>I am "a person who writes books" → I am <b>an author</b></>} />
            <Row k={<b>[…]</b>} what="A French or Arabic word" ex={<>I feel [fatigué] → I feel <b>tired</b></>} />
            <Row k={<b>{'{…}'}</b>} what="Describe an idiom" ex={<>The exam was {'{something very easy}'} → <b>a piece of cake</b></>} />
          </div>
          <div>
            <h3 style={{ color: '#6a3fb5' }}>Write faster</h3>
            <Row k={<span className="kbd">Tab</span>} what="Accept the grey suggestion" ex={<>The results show that the <span className="ghost">new method works</span></>} />
            <h3 style={{ color: 'var(--rose)', marginTop: 14 }}>Keep it easy to read</h3>
            <Row k={<b>gauge</b>} what="Live score, easy → hard (top of the side notes)" />
            <Row k={<b style={{ background: 'var(--mark-sent)' }}>pink</b>} what="Click a hard sentence to simplify" ex={<>Notwithstanding the ramifications… → <b>Despite the consequences…</b></>} />
            <Row k={<b style={{ background: 'var(--mark-hard)' }}>yellow</b>} what="Hard word → simpler word" ex={<>We will utilize → We will <b>use</b></>} />
          </div>
          <div>
            <h3 style={{ color: 'var(--green)' }}>Polish the writing</h3>
            <Row k={<b style={{ background: 'var(--mark-better)' }}>blue</b>} what="Stronger word" ex={<>a very big house → a <b>huge</b> house</>} />
            <Row k={<b style={{ textDecoration: 'underline wavy var(--mark-err)' }}>red</b>} what="Spelling & grammar" ex={<>She go to school every days → She <b>goes</b> … every <b>day</b></>} />
          </div>
          <div>
            <h3>Keys inside a note</h3>
            <Row k={<span className="kbd">Enter</span>} what="Pick the top choice" />
            <Row k={<><span className="kbd">↑</span> <span className="kbd">↓</span></>} what="Choose another option" />
            <Row k={<span className="kbd">Esc</span>} what="Close it, keep what you typed" />
          </div>
        </div>
        <div className="row-btns" style={{ marginTop: 20, gap: 12 }}>
          <button className="tag" type="button" onClick={onClose}>
            got it
          </button>
          <button className="tag" type="button" onClick={onReplay} style={{ background: 'var(--note-blue)' }}>
            open the practice page
          </button>
        </div>
      </section>
    </div>
  );
}

function Row({ k, what, ex }) {
  return (
    <div className="cs-row">
      <span>{k}</span>
      <span>
        {what}
        {ex && (
          <>
            <br />
            <span className="ex">{ex}</span>
          </>
        )}
      </span>
    </div>
  );
}
