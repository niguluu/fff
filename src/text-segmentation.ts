// Grapheme- and word-aware text segmentation utilities.
//
// Ported (as algorithms) from pi's `packages/tui/src/utils.ts`. Pi's component
// model is incompatible with Ink, so only the segmentation helpers are reused
// here and re-expressed as plain pure functions over strings + cursor offsets.

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

export function getGraphemeSegmenter(): Intl.Segmenter {
  return graphemeSegmenter;
}

export function getWordSegmenter(): Intl.Segmenter {
  return wordSegmenter;
}

// Same punctuation classification pi uses for word navigation.
export const PUNCTUATION_REGEX = /[(){}[\]<>.,;:'"!?+\-=*/\\|&%^$#@~`]/;

export function isWhitespaceChar(char: string): boolean {
  return /\s/.test(char);
}

/**
 * Return all grapheme cluster boundary offsets for `input`, always including
 * `0` and `input.length`. Boundaries are ascending UTF-16 code unit offsets.
 */
function graphemeBoundaries(input: string): number[] {
  const bounds: number[] = [0];
  for (const { segment, index } of graphemeSegmenter.segment(input)) {
    bounds.push(index + segment.length);
  }
  return bounds;
}

/**
 * Offset of the grapheme boundary immediately before `pos`.
 * Used for grapheme-aware left-arrow / backspace.
 */
export function prevGraphemeBoundary(input: string, pos: number): number {
  if (pos <= 0) return 0;
  const bounds = graphemeBoundaries(input);
  let prev = 0;
  for (const b of bounds) {
    if (b < pos) prev = b;
    else break;
  }
  return prev;
}

/**
 * Offset of the grapheme boundary immediately after `pos`.
 * Used for grapheme-aware right-arrow / forward-delete.
 */
export function nextGraphemeBoundary(input: string, pos: number): number {
  if (pos >= input.length) return input.length;
  const bounds = graphemeBoundaries(input);
  for (const b of bounds) {
    if (b > pos) return b;
  }
  return input.length;
}

/**
 * The first grapheme cluster of `str`, or `undefined` for an empty string.
 * Used to render the character "under" the fake cursor without splitting a
 * surrogate pair or combining sequence.
 */
export function firstGrapheme(str: string): string | undefined {
  if (str.length === 0) return undefined;
  const iter = graphemeSegmenter.segment(str)[Symbol.iterator]().next();
  return iter.done ? str : iter.value.segment;
}
