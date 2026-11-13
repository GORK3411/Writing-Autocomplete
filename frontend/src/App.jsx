import { useCallback, useEffect, useState } from 'react';
import BlankSheet from './components/BlankSheet.jsx';
import CheatSheet from './components/CheatSheet.jsx';
import { Legend } from './components/Sheet.jsx';
import { LearnNote } from './components/Sidebar.jsx';

// localStorage can be unavailable (private mode) — never let it break the page.
function usePersisted(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem('sw:' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('sw:' + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue];
}

export default function App() {
  const [text, setText] = usePersisted('blank', '');
  const [cheat, setCheat] = useState(false);
  const openCheat = useCallback(() => setCheat(true), []);
  const closeCheat = useCallback(() => setCheat(false), []);

  return (
    <div className="page">
      <div className="wrap">
        <header className="header">
          <div>
            <h1 className="title">
              Smart Writing <span aria-hidden="true">✎</span>
            </h1>
            <p className="subtitle">a fresh page — just start typing</p>
          </div>
        </header>

        <div className="topbar">
          <div>
            <Legend />
            <p className="below-note">The grey hint disappears as soon as you type.</p>
          </div>
          <button type="button" className="help-note" onClick={openCheat} aria-label="How it works: open the cheat sheet">
            ?
          </button>
        </div>

        <div className="columns">
          <main className="main">
            <BlankSheet text={text} onChange={setText} />
          </main>
          <aside className="aside" aria-label="Side notes">
            <LearnNote onOpenCheat={openCheat} />
          </aside>
        </div>
      </div>

      {cheat && <CheatSheet onClose={closeCheat} />}
    </div>
  );
}
