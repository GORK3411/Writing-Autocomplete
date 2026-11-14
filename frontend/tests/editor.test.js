import assert from "node:assert/strict";
import test from "node:test";

import { applyEdits, spanToEdit } from "../src/edits.js";
import { computeHighlights, highlightsNow, listFixes, splitDraft } from "../src/highlights.js";
import { suggestForTrigger, triggerAt } from "../src/triggers.js";

test("sentence boundaries and mirror preserve the text exactly", () => {
  const text = '  Dr. Smith paid 3.14 dollars. A. Hill wrote ["why."]!\n\nFirst {unfinished.  ';
  const bodies = splitDraft(text).filter((chunk) => chunk.start !== undefined);
  assert.deepEqual(bodies.map((chunk) => chunk.text),
    ["Dr. Smith paid 3.14 dollars.", 'A. Hill wrote ["why."]!', "First {unfinished."]);
  assert.equal(highlightsNow(text).flatMap((chunk) => chunk.parts).map((part) => part.text).join(""), text);
  assert.equal(triggerAt(highlightsNow(text), text.indexOf("why")).kind, "lang");
});

test("groups apply atomically, including insertion, deletion, and emoji offsets", () => {
  const text = "🙂 She saw the the dog";
  const replace = spanToEdit(text, { start: 10, end: 13, text: "the", suggestion: "a" });
  const deletion = spanToEdit(text, { start: 13, end: 17, text: " the", suggestion: "" });
  const insertion = spanToEdit(text, { start: 21, end: 21, text: "", suggestion: "." });
  assert.equal(applyEdits(text, [replace, deletion, insertion]), "🙂 She saw a dog.");
  assert.equal(applyEdits(text, [replace, replace]), null);
  assert.equal(applyEdits(text.replace("She", "You"), [replace]), null);
  assert.equal(spanToEdit(text, { start: 10, end: 13, text: "bad", suggestion: "a" }), null);
});

test("grammar spans win overlaps, finished replies are cached and trigger offsets count code points", async () => {
  let received = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    received.push([url, body]);
    if (url.endsWith("/describe")) return Response.json({ candidates: [{ text: "author", score: 0.8 }] });
    if (url.endsWith("/difficulty")) return Response.json({ score: 10, hard: false });
    return Response.json({ spans: [{ start: 2, end: 6, text: "werx",
      suggestion: url.endsWith("/grammar") ? "were" : "other" }] });
  };
  const text = "🙂 werx ready.";
  const controller = new AbortController();
  await computeHighlights(text, "light", controller.signal, () => {});
  await computeHighlights(text, "grammar", controller.signal, () => {});
  const fix = listFixes(highlightsNow(text));
  assert.equal(fix.length, 1);
  assert.equal(fix[0].to, "were");
  assert.equal(applyEdits(text, fix), "🙂 were ready.");
  const called = received.length;
  await computeHighlights(text, "light", controller.signal, () => {});
  assert.equal(received.length, called);
  await suggestForTrigger("desc", "person", '🙂 "person"', 3);
  assert.equal(received.at(-1)[1].trigger_start, 2);
});

test("a cancelled analysis does not publish its result to the current editor", async () => {
  const controller = new AbortController();
  let finish;
  globalThis.fetch = () => new Promise((resolve) => { finish = resolve; });
  let updates = 0;
  const request = computeHighlights("Old sentence.", "grammar", controller.signal, () => updates++);
  await Promise.resolve();
  controller.abort();
  finish(Response.json({ spans: [] }));
  await request;
  assert.equal(updates, 0);
});

test("editing lots of sentences stays within the shared request limit", async () => {
  let active = 0;
  let peak = 0;
  globalThis.fetch = async (url) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    return url.endsWith("/difficulty") ? Response.json({ score: 0, hard: false }) : Response.json({ spans: [] });
  };
  const controller = new AbortController();
  await Promise.all([1, 2, 3].map((n) =>
    computeHighlights(String(n) + " separate words.", "light", controller.signal, () => {})));
  assert.equal(peak, 4);
});

test("malformed spans and unknown trigger kinds are discarded", async () => {
  const sentence = "One sentence.";
  assert.equal(spanToEdit(sentence, null), null);
  assert.equal(spanToEdit(sentence, { start: "0", end: 3, text: "One", suggestion: "A" }), null);
  assert.equal(spanToEdit(sentence, { start: -1, end: 3, text: "One", suggestion: "A" }), null);
  assert.deepEqual(await suggestForTrigger("constructor", "query", sentence, 0), []);
});
