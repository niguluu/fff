/**
 * Sixel detection helper.
 *
 * Lines that embed a Sixel image must be emitted verbatim (never wrapped or
 * padded) by the block renderer. This helper returns a per-line mask flagging
 * lines that contain a DCS Sixel introducer (`ESC P … q`).
 */

const SIXEL_INTRODUCER_REGEX = /\x1bP[0-9;]*q/;

/**
 * Returns a boolean mask (one entry per input line) where `true` marks a line
 * that contains Sixel image data. Returns `undefined` when no line contains
 * Sixel data, letting callers skip per-line bookkeeping entirely.
 */
export function getSixelLineMask(lines: string[]): boolean[] | undefined {
	let found = false;
	const mask = lines.map(line => {
		const isSixel = SIXEL_INTRODUCER_REGEX.test(line);
		if (isSixel) found = true;
		return isSixel;
	});
	return found ? mask : undefined;
}
