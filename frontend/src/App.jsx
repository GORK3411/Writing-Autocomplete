import { useCallback, useEffect, useMemo, useState } from 'react';
import { HARD, MODEL, TRIGGERS } from './data/sampleDoc.js';
import { LESSONS } from './data/lessons.js';
import DocumentSheet from './components/DocumentSheet.jsx';
import PracticeSheet from './components/PracticeSheet.jsx';
import BlankSheet from './components/BlankSheet.jsx';
import CheatSheet from './components/CheatSheet.jsx';
import { countWords, Legend } from './components/Sheet.jsx';
import { FixesNote, GaugeNote, LearnNote, SimplerNote } from './components/Sidebar.jsx';

const INITIAL_DOC = { open: null, fixed: {}, ignored: {}, picks: {}, simp: {}, choice: {}, cur: 0, filter: 'all', ghost: 0 };

// localStorage can be unavailable (private mode) — never let it break the page.
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('sw:' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('sw:' + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

function usePersisted(key, fallback) {
  const [value, setValue] = useState(() => store.get(key, fallback));
  useEffect(() => store.set(key, value), [key, value]);
  return [value, setValue];
}

const VIEWS = [
  ['practice', 'practice'],
  ['doc', 'sample text'],
  ['blank', 'new page'],
];

export default function App() {
  const [view, setView] = usePersisted('view', 'practice');
  const [auto, setAuto] = usePersisted('autocomplete', true);
  const [tips, setTips] = usePersisted('tips', 0);
  const [blankText, setBlankText] = usePersisted('blank', '');
  const [lessonsDone, setLessonsDone] = useState({});
  const [doc, setDoc] = useState(INITIAL_DOC);
  const [cheat, setCheat] = useState(false);

  const patch = useCallback((p) => setDoc((d) => ({ ...d, ...(typeof p === 'function' ? p(d) : p) })), []);
  const usedTip = useCallback(() => setTips((t) => t + 1), [setTips]);

  const actions = useMemo(() => {
    const mark = (obj, ids) => Object.assign({}, obj, Object.fromEntries(ids.map((i) => [i, true])));
    return {
      setOpen: (id) => patch({ open: id }),
      close: () => patch({ open: null }),
      fix: (ids) => patch((d) => ({ fixed: mark(d.fixed, ids), open: null })),
      ignore: (ids) => patch((d) => ({ ignored: mark(d.ignored, ids), open: null })),
      pick: (key, word) => {
        patch((d) => ({ picks: { ...d.picks, [key]: word }, open: null }));
        usedTip();
      },
      acceptGhost: () => patch((d) => ({ ghost: d.ghost + 1 })),
      selectHard: (k, scroll = true) => {
        patch({ cur: k, open: null });
        if (scroll) document.getElementById('simpler-note')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      },
      choose: (k, i) => patch((d) => ({ choice: { ...d.choice, [k]: i } })),
      setSimp: (k, v) =>
        patch((d) => {
          const simp = { ...d.simp };
          if (v) simp[k] = v;
          else delete simp[k];
          return { simp };
        }),
      setFilter: (f) => patch({ filter: f }),
    };
  }, [patch, usedTip]);

  // ---- derived numbers for the sample text ----
  const live = MODEL.issues.filter((i) => !doc.fixed[i.id] && !doc.ignored[i.id]);
  const hardLeft = HARD.filter((_, k) => doc.simp[k] !== 'swapped').length;
  const cnt = (t) => live.filter((i) => i.type === t).length;
  const score = 30 + 7 * hardLeft + cnt('h') + Math.round(cnt('b') / 2) + (Object.keys(TRIGGERS).length - Object.keys(doc.picks).length);
  const words = useMemo(() => docWordCount(doc, auto), [doc, auto]);

  const fixEverything = () => actions.fix(live.map((i) => i.id));
  const simplifyAll = () =>
    patch((d) => {
      const simp = { ...d.simp };
      HARD.forEach((_, k) => {
        if (!simp[k]) simp[k] = 'swapped';
      });
      return { simp, open: null };
    });

  const openCheat = useCallback(() => setCheat(true), []);
  const closeCheat = useCallback(() => setCheat(false), []);
  const replay = () => {
    setCheat(false);
    setLessonsDone({});
    setView('practice');
  };

  const subtitle =
    view === 'doc'
      ? `${live.length} fixes · ${hardLeft} hard sentences · click anything boxed or highlighted`
      : view === 'practice'
        ? 'first time here? try the 4 tricks below'
        : 'a fresh page — just start typing';

  return (
    <div className="page">
      <div className="wrap">
        <header className="header">
          <div>
            <h1 className="title">
              Smart Writing <span aria-hidden="true">✎</span>
            </h1>
            <p className="subtitle">{subtitle}</p>
          </div>
          <nav aria-label="Tools" className="nav">
            <div role="group" aria-label="Page" className="nav">
              {VIEWS.map(([v, label]) => (
                <button key={v} className="tag" type="button" aria-pressed={view === v} onClick={() => setView(v)}>
                  {label}
                </button>
              ))}
            </div>
            {view === 'doc' && (
              <>
                <button className="tag auto" type="button" aria-pressed={auto} onClick={() => setAuto(!auto)}>
                  autocomplete: {auto ? 'on' : 'off'}
                </button>
                <button className="tag" type="button" onClick={fixEverything} style={{ background: 'var(--note-green)' }}>
                  fix all
                </button>
                <button className="tag" type="button" onClick={simplifyAll} style={{ background: 'var(--note-pink)' }}>
                  simplify all
                </button>
                <button className="tag" type="button" onClick={() => setDoc(INITIAL_DOC)}>
                  ↺ reset
                </button>
              </>
            )}
            <button type="button" className="help-note" onClick={openCheat} aria-label="How it works: open the cheat sheet">
              ?
            </button>
          </nav>
        </header>

        <div className="columns">
          <main className="main">
            {view === 'practice' && (
              <PracticeSheet
                done={lessonsDone}
                onDone={(k, v) => {
                  setLessonsDone((d) => ({ ...d, [k]: v }));
                  usedTip();
                }}
                showTip={tips < 3}
                tipNum={tips + 1}
                onStartWriting={() => {
                  setBlankText('');
                  setView('blank');
                }}
                onOpenSample={() => setView('doc')}
              />
            )}
            {view === 'blank' && <BlankSheet text={blankText} onChange={setBlankText} />}
            {view === 'doc' && <DocumentSheet doc={doc} words={words} auto={auto} showTip={tips < 3} tipNum={tips + 1} actions={actions} />}
            <Legend withFind={view === 'doc'} sentLabel={view === 'doc' ? 'pink #n' : 'pink'} />
          </main>

          <aside className="aside" aria-label="Side notes">
            {view === 'doc' ? (
              <>
                <GaugeNote score={score} hardLeft={hardLeft} liveCount={live.length} />
                <SimplerNote doc={doc} actions={actions} />
                <FixesNote live={live} filter={doc.filter} actions={actions} />
              </>
            ) : (
              <LearnNote onOpenCheat={openCheat} />
            )}
            {view === 'practice' && Object.keys(lessonsDone).length === LESSONS.length && (
              <section className="sticky" style={{ background: 'var(--note-green)', transform: 'rotate(-1deg)' }}>
                <h2 style={{ color: 'var(--green)' }}>All 4 tried ✓</h2>
                <p style={{ margin: '6px 0 0', fontSize: 19, lineHeight: 1.5 }}>
                  Now clear the page and start writing, or open the sample text to see every feature at once.
                </p>
              </section>
            )}
          </aside>
        </div>
      </div>

      {cheat && <CheatSheet onClose={closeCheat} onReplay={replay} />}
    </div>
  );
}

/** Word count of the sample text as currently shown. */
function docWordCount(doc, auto) {
  let text = '';
  for (const sentences of MODEL.paragraphs) {
    for (const s of sentences) {
      if (s.kind === 'hard') {
        text += ' ' + (doc.simp[s.index] === 'swapped' ? HARD[s.index].versions[doc.choice[s.index] ?? 1] : HARD[s.index].orig);
      } else if (s.kind === 'ghost') {
        text += ' ' + s.before + s.parts.slice(0, doc.ghost).join('');
      } else {
        for (const t of s.tokens) {
          if (t.kind === 'text') text += t.text;
          else if (t.kind === 'trigger') text += doc.picks[t.key] || TRIGGERS[t.key].raw;
          else text += doc.fixed[t.issue.id] ? t.issue.to : t.issue.from;
        }
        text += ' ';
      }
    }
  }
  return countWords(text);
}
