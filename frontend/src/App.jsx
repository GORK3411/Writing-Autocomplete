import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BlankSheet from "./components/BlankSheet.jsx";
import CheatSheet from "./components/CheatSheet.jsx";
import { Legend } from "./components/Sheet.jsx";
import {
  DifficultyNote,
  QuickFixesNote,
  SimplerNote,
} from "./components/Sidebar.jsx";
import {
  computeHighlights,
  highlightsNow,
  listFixes,
  overallDifficulty,
} from "./highlights.js";
import { applyEdits } from "./edits.js";
import { simplify } from "./api.js";
import { loadNgram, suggestNgram } from "./ngram.js";

// localStorage can be unavailable (private mode) — never let it break the page.
function usePersisted(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem("sw:" + key);
      const saved = v === null ? fallback : JSON.parse(v);
      return typeof saved === typeof fallback ? saved : fallback;
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
const GRAMMAR_PAUSE_MS = 1200;
// The backend checks (features 5-9) are called only after the user stops typing for this long.
const HIGHLIGHT_PAUSE_MS = 300;

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
  const llmWord = llm.for === text ? llm.value : "";
  const suggestion = llmWord || ngramSuggestion;

  const acceptSuggestion = useCallback(() => {
    // A space after the word lets the user chain Tab presses word by word.
    setText((t) => t + suggestion + " ");
  }, [setText, suggestion]);

  const [revision, setRevision] = useState(0);
  const [checking, setChecking] = useState(false);
  const [grammarChecking, setGrammarChecking] = useState(false);
  const [checkError, setCheckError] = useState(null);
  const [checkRequest, setCheckRequest] = useState(null);
  const [undo, setUndo] = useState(null);
  const [caret, setCaret] = useState(null);
  const [hardIndex, setHardIndex] = useState(0);
  const [skipped, setSkipped] = useState(new Set());
  const [preview, setPreview] = useState(null);
  const update = () => setRevision((value) => value + 1);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const manual = checkRequest?.text === text;
    setChecking(!!text.trim());
    setGrammarChecking(!!text.trim());
    setCheckError(null);
    const report = async (mode) => {
      const failed = await computeHighlights(text, mode, signal, update);
      if (failed && !signal.aborted) setCheckError(text);
    };
    const light = setTimeout(async () => {
      await report("light");
      if (!signal.aborted) setChecking(false);
    }, manual ? 0 : HIGHLIGHT_PAUSE_MS);
    const grammar = setTimeout(async () => {
      await report(manual ? "check" : "grammar");
      if (!signal.aborted) setGrammarChecking(false);
    }, manual ? 0 : GRAMMAR_PAUSE_MS);
    return () => {
      controller.abort();
      clearTimeout(light);
      clearTimeout(grammar);
    };
  }, [text, checkRequest]);

  const highlights = useMemo(() => highlightsNow(text), [text, revision]);
  const fixes = useMemo(() => listFixes(highlights), [highlights]);
  const difficulty = useMemo(() => overallDifficulty(highlights), [highlights]);
  const hardSentences = highlights.filter((chunk) => chunk.hardSentence && !chunk.triggers.length &&
    !skipped.has(chunk.start + ":" + chunk.text));
  const current = Math.min(hardIndex, Math.max(hardSentences.length - 1, 0));
  const selected = hardSentences[current];

  function applyFix(list) {
    const next = applyEdits(text, list);
    if (next === null || next === text) return;
    setUndo({ before: text, after: next });
    if (list.length === 1) setCaret({ position: list[0].start + list[0].to.length });
    setPreview(null);
    setText(next);
  }

  function changeDraft(next) {
    setPreview(null);
    setUndo(null);
    setText(next);
  }

  function undoLast() {
    if (undo?.after !== text) return;
    setText(undo.before);
    setUndo(null);
  }

  async function requestSimplification(chunk) {
    const pending = { draft: text, start: chunk.start, status: "loading" };
    setPreview(pending);
    try {
      const result = await simplify(chunk.text);
      const status = result && result !== chunk.text ? "ready" : "empty";
      setPreview((old) => old === pending ? { ...pending, status, result } : old);
    } catch {
      setPreview((old) => old === pending ? { ...pending, status: "error" } : old);
    }
  }

  function applyRewrite(chunk) {
    if (!currentPreview?.result) return;
    applyFix([{ start: chunk.start, from: chunk.text, to: currentPreview.result,
      sentence: chunk.text, sentenceStart: chunk.start }]);
  }

  function keepOriginal(chunk) {
    setSkipped((previous) => new Set([...previous, chunk.start + ":" + chunk.text]));
  }

  const currentPreview = preview?.draft === text && preview?.start === selected?.start ? preview : null;

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
              onChange={changeDraft}
              suggestion={suggestion}
              suggestionSource={llmWord ? "distilgpt2" : "ngram"}
              onAccept={acceptSuggestion}
              highlights={highlights}
              currentSentence={selected?.start}
              onEdit={applyFix}
              caret={caret}
            />
          </main>
          <aside className="aside" aria-label="Side notes">
            <div className="check-actions">
              <button className="tag" type="button" disabled={!text.trim()}
                onClick={() => setCheckRequest({ text })}>Check draft</button>
              {undo?.after === text && <button className="chip grey" type="button" onClick={undoLast}>Undo last edit</button>}
            </div>
            {checkError === text &&
              <p className="status-note" role="status">Some checks are unavailable. Check local setup and select Check draft to retry.</p>}
            <DifficultyNote
              score={difficulty?.score ?? null}
              calculating={checking}
              hardest={difficulty ? `sentence ${difficulty.hardest} is the hardest` : "nothing to score yet"}
            />
            <SimplerNote
              sentences={hardSentences}
              index={current}
              onIndex={setHardIndex}
              preview={currentPreview}
              onPreview={requestSimplification}
              onSwap={applyRewrite}
              onKeep={keepOriginal}
            />
            <QuickFixesNote fixes={fixes} onFix={applyFix} checking={checking || grammarChecking} unavailable={checkError === text} />
          </aside>
        </div>
      </div>

      {cheat && <CheatSheet onClose={closeCheat} />}
    </div>
  );
}
