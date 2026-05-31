/**
 * Minimal settings accessor.
 *
 * The upstream project ships a full layered settings store; this project only
 * needs a tiny typed getter for the handful of keys referenced by the ported
 * TUI components. Values fall back to sensible defaults and may be overridden
 * via environment variables.
 */

export type HyperlinkMode = "off" | "auto" | "always";

interface SettingsSchema {
	"tui.hyperlinks": HyperlinkMode;
}

const DEFAULTS: SettingsSchema = {
	"tui.hyperlinks": (Bun.env.PI_TUI_HYPERLINKS as HyperlinkMode) ?? "auto",
};

export const settings = {
	get<K extends keyof SettingsSchema>(key: K): SettingsSchema[K] {
		return DEFAULTS[key];
	},
};
