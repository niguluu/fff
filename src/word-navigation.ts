// Word-boundary navigation, ported from pi's `packages/tui/src/word-navigation.ts`.
//
// Pure functions over a string + cursor offset. They rely on the shared word
// segmenter and the same punctuation classification pi uses, so navigation
// matches pi's behaviour for words, punctuation runs and whitespace.

import { getWordSegmenter, isWhitespaceChar, PUNCTUATION_REGEX } from "./text-segmentation.js";

const wordSegmenter = getWordSegmenter();

/**
 * Cursor position after moving one word backward from `cursor` in `text`.
 * Skips trailing whitespace, then stops at the next word/punctuation boundary.
 */
export function findWordBackward(text: string, cursor: number): number {
  if (cursor <= 0) return 0;

  const textBeforeCursor = text.slice(0, cursor);
  const segments = [...wordSegmenter.segment(textBeforeCursor)];
  let newCursor = cursor;

  // Skip trailing whitespace.
  while (
    segments.length > 0 &&
    isWhitespaceChar(segments[segments.length - 1]?.segment || "")
  ) {
    newCursor -= segments.pop()?.segment.length || 0;
  }

  if (segments.length === 0) return newCursor;

  const last = segments[segments.length - 1]!;

  if (last.isWordLike) {
    // Skip inside one word-like segment, preserving ASCII punctuation boundaries.
    const segment = last.segment;
    const matches = [...segment.matchAll(new RegExp(PUNCTUATION_REGEX, "g"))];
    if (matches.length <= 0) {
      newCursor -= segment.length;
    } else {
      const lastMatch = matches[matches.length - 1]!;
      newCursor -= segment.length - (lastMatch.index + lastMatch[0].length);
    }
  } else {
    // Skip a non-word non-whitespace run (punctuation).
    while (
      segments.length > 0 &&
      !segments[segments.length - 1]?.isWordLike &&
      !isWhitespaceChar(segments[segments.length - 1]?.segment || "")
    ) {
      newCursor -= segments.pop()?.segment.length || 0;
    }
  }

  return newCursor;
}

/**
 * Cursor position after moving one word forward from `cursor` in `text`.
 * Skips leading whitespace, then stops at the next word/punctuation boundary.
 */
export function findWordForward(text: string, cursor: number): number {
  if (cursor >= text.length) return text.length;

  const textAfterCursor = text.slice(cursor);
  const iterator = wordSegmenter.segment(textAfterCursor)[Symbol.iterator]();
  let next = iterator.next();
  let newCursor = cursor;

  // Skip leading whitespace.
  while (!next.done && isWhitespaceChar(next.value.segment)) {
    newCursor += next.value.segment.length;
    next = iterator.next();
  }

  if (next.done) return newCursor;

  if (next.value.isWordLike) {
    // Skip inside one word-like segment, preserving ASCII punctuation boundaries.
    newCursor += PUNCTUATION_REGEX.exec(next.value.segment)?.index ?? next.value.segment.length;
  } else {
    // Skip a non-word non-whitespace run (punctuation).
    while (!next.done && !next.value.isWordLike && !isWhitespaceChar(next.value.segment)) {
      newCursor += next.value.segment.length;
      next = iterator.next();
    }
  }

  return newCursor;
}
