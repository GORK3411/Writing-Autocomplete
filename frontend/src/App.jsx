import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BlankSheet from "./components/BlankSheet.jsx";
import CheatSheet from "./components/CheatSheet.jsx";
import { Legend } from "./components/Sheet.jsx";
import {
  DifficultyNote,
  LearnNote,
  QuickFixesNote,
  SimplerNote,
} from "./components/Sidebar.jsx";
import { applyFixes, computeHighlights, listFixes, listHardSentences } from "./highlights.js";
import { loadNgram, suggestNgram } from "./ngram.js";

// localStorage can be unavailable (private mode) — never let it break the page.
function usePersisted(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem("sw:" + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("sw:" + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue];
}

// The LLM runs only after the user stops typing for this long.
const LLM_PAUSE_MS = 400;
// The difficulty score is recalculated only after the user stops typing for this long.
const DIFFICULTY_PAUSE_MS = 2000;

export default function App() {
  const [text, setText] = usePersisted("blank", "");
  const [cheat, setCheat] = useState(false);
  const openCheat = useCallback(() => setCheat(true), []);
  const closeCheat = useCallback(() => setCheat(false), []);

  // ---- feature 4: next-word ghost text ----
  // 1. n-gram table: tiny, loads fast, answers instantly on every keystroke.
  // 2. DistilGPT-2: loads in the background; after a typing pause its word replaces the n-gram one.
  const [ngram, setNgram] = useState(null);
  const [llmSuggest, setLlmSuggest] = useState(null); // (text) => Promise<word>, once the model is ready
  const [llm, setLlm] = useState({ for: null, value: "" }); // LLM suggestion and the text it was made for

  useEffect(() => {
    let cancelled = false;
    loadNgram()
      .then((t) => !cancelled && setNgram(t))
      .catch((e) => console.error("[ngram]", e));
    // Dynamic import: transformers.js is a big bundle, so the page and the
    // n-gram suggestions don't wait for it.
    import("./llm.js")
      .then(async ({ getGenerator, suggestWithLlm }) => {
        const gen = await getGenerator();
        // wrap in () => ...: the value is a function, so React would otherwise call it as an updater
        if (!cancelled) setLlmSuggest(() => (t) => suggestWithLlm(gen, t));
      })
      .catch((e) => console.error("[llm]", e));
    return () => {
      cancelled = true;
    };
  }, []);

  const ngramSuggestion = useMemo(
    () => (ngram && text.trim() ? suggestNgram(ngram, text) : ""),
    [ngram, text],
  );

  // Run the LLM after a pause. Only one generation at a time: if the text
  // changed while it was running, run again for the latest text.
  const latestText = useRef(text);
  latestText.current = text;
  const busy = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    if (!llmSuggest || !text.trim()) return;
    const id = setTimeout(async () => {
      if (busy.current) {
        pending.current = true;
        return;
      }
      busy.current = true;
      try {
        do {
          pending.current = false;
          const t = latestText.current;
          const value = await llmSuggest(t);
          if (latestText.current === t) setLlm({ for: t, value });
        } while (pending.current);
      } catch (e) {
        console.error("[llm] generation failed", e);
      } finally {
        busy.current = false;
      }
    }, LLM_PAUSE_MS);
    return () => clearTimeout(id);
  }, [text, llmSuggest]);

  // The LLM's word wins when it is for the current text; otherwise the instant n-gram word.
  const suggestion = (llm.for === text && llm.value) || ngramSuggestion;

  const acceptSuggestion = useCallback(() => {
    // A space after the word lets the user chain Tab presses word by word.
    setText((t) => t + suggestion + " ");
  }, [setText, suggestion]);

  // ---- feature 5: difficulty score (placeholder: random number until the model is connected) ----
  const [difficulty, setDifficulty] = useState(() => Math.floor(Math.random() * 101));
  const [calculating, setCalculating] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setCalculating(true);
    const id = setTimeout(() => {
      setDifficulty(Math.floor(Math.random() * 101));
      setCalculating(false);
    }, DIFFICULTY_PAUSE_MS);
    return () => clearTimeout(id);
  }, [text]);

  // ---- features 7, 8, 9: highlights in the text + their quick fixes ----
  const highlights = useMemo(() => computeHighlights(text), [text]);
  const fixes = useMemo(() => listFixes(highlights), [highlights]);
  const applyFix = useCallback((list) => setText((t) => applyFixes(t, list)), [setText]);

  // ---- feature 6: "Simpler version" note, one pink sentence at a time ----
  // Sentences the user kept ("nah") or that are the result of a swap are not offered again.
  const [skipped, setSkipped] = useState(() => new Set());
  const hardSentences = useMemo(() => listHardSentences(highlights, skipped), [highlights, skipped]);
  const [hardIndex, setHardIndex] = useState(0);
  const current = Math.min(hardIndex, Math.max(hardSentences.length - 1, 0));
  const [lastAction, setLastAction] = useState(null); // { type: 'swapped' | 'kept', item }

  const skip = (sentence, on) =>
    setSkipped((s) => {
      const next = new Set(s);
      on ? next.add(sentence) : next.delete(sentence);
      return next;
    });

  const swapSentence = (item) => {
    setText((t) => applyFixes(t, [item]));
    skip(item.to, true);
    setLastAction({ type: "swapped", item });
  };
  const keepSentence = (item) => {
    skip(item.from, true);
    setLastAction({ type: "kept", item });
  };
  const undoLast = () => {
    const { type, item } = lastAction;
    if (type === "swapped") {
      setText((t) => applyFixes(t, [{ start: item.start, from: item.to, to: item.from }]));
      skip(item.to, false);
    } else {
      skip(item.from, false);
    }
    setLastAction(null);
  };

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
            <p className="below-note">
              The grey hint disappears as soon as you type.
            </p>
          </div>
          <button
            type="button"
            className="help-note"
            onClick={openCheat}
            aria-label="How it works: open the cheat sheet"
          >
            ?
          </button>
        </div>

        <div className="columns">
          <main className="main">
            <BlankSheet
              text={text}
              onChange={setText}
              suggestion={suggestion}
              onAccept={acceptSuggestion}
              highlights={highlights}
              currentSentence={hardSentences[current]?.start}
            />
          </main>
          <aside className="aside" aria-label="Side notes">
            {/*<LearnNote onOpenCheat={openCheat} />*/}
            <DifficultyNote score={difficulty} calculating={calculating} />
            <SimplerNote
              sentences={hardSentences}
              index={current}
              onIndex={setHardIndex}
              onSwap={swapSentence}
              onKeep={keepSentence}
              lastAction={lastAction}
              onUndo={undoLast}
            />
            <QuickFixesNote fixes={fixes} onFix={applyFix} />
          </aside>
        </div>
      </div>

      {cheat && <CheatSheet onClose={closeCheat} />}
    </div>
  );
}
