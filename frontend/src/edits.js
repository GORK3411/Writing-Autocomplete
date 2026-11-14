// Python offsets count Unicode code points. Browser offsets count UTF-16 units.
export function codePointOffsets(text) {
  const offsets = [0];
  for (const char of text) offsets.push(offsets.at(-1) + char.length);
  return offsets;
}

export function spanToEdit(sentence, span, start = 0) {
  if (!span || !Number.isInteger(span.start) || !Number.isInteger(span.end) ||
      typeof span.text !== "string" || typeof span.suggestion !== "string") return null;
  const offsets = codePointOffsets(sentence);
  const beginning = offsets[span.start];
  const end = offsets[span.end];
  if (beginning === undefined || end === undefined || beginning > end ||
      sentence.slice(beginning, end) !== span.text) return null;
  if (span.text === span.suggestion) return null;
  return { start: start + beginning, from: span.text, to: span.suggestion, sentence, sentenceStart: start };
}

// Two insertions at the same boundary conflict. Adjacent replacements can coexist.
export function overlaps(a, b) {
  const aEnd = a.start + a.from.length;
  const bEnd = b.start + b.from.length;
  if (a.start === b.start) return true;
  return a.start < bEnd && b.start < aEnd;
}

export function applyEdits(text, edits) {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  for (const [i, edit] of sorted.entries()) {
    const { start, from, to, sentence, sentenceStart } = edit;
    if (!Number.isInteger(start) || typeof from !== "string" || typeof to !== "string" ||
        typeof sentence !== "string" || !Number.isInteger(sentenceStart) ||
        sentenceStart < 0 || start < sentenceStart ||
        start + from.length > sentenceStart + sentence.length ||
        text.slice(sentenceStart, sentenceStart + sentence.length) !== sentence ||
        text.slice(start, start + from.length) !== from ||
        (i > 0 && overlaps(sorted[i - 1], edit))) return null;
  }
  let result = text;
  for (const { start, from, to } of sorted.reverse()) {
    result = result.slice(0, start) + to + result.slice(start + from.length);
  }
  return result;
}
