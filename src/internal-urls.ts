/**
 * Minimal internal-URL resolution surface.
 *
 * The upstream project resolves custom schemes (`local://`, `memory://`, …) to
 * filesystem paths through a session registry. This project does not implement
 * those schemes, so the helpers below preserve the upstream API shape while
 * resolving to "not available" — callers (e.g. {@link tryResolveInternalUrlSync})
 * gracefully fall back to plain text.
 */

/** Parsed representation of an internal URL. */
export interface InternalUrl {
	scheme: string;
	host: string;
	path: string;
	raw: string;
}

/** Options describing where `local://` URLs resolve on disk. */
export interface LocalResolveOptions {
	root: string;
}

/** A mounted memory namespace root. */
export interface MemoryRoot {
	namespace: string;
	root: string;
}

/** Parse an internal URL of the form `scheme://host/path`. */
export function parseInternalUrl(input: string): InternalUrl {
	const match = /^([a-z][a-z0-9+.-]*):\/\/([^/]*)(\/.*)?$/i.exec(input);
	if (!match) {
		return { scheme: "", host: "", path: "", raw: input };
	}
	return {
		scheme: match[1]!.toLowerCase(),
		host: match[2] ?? "",
		path: match[3] ?? "",
		raw: input,
	};
}

/** Resolver for `local://` URLs. No local root is configured in this project. */
export const LocalProtocolHandler = {
	resolveOptions(): LocalResolveOptions | undefined {
		return undefined;
	},
};

/** Resolve a `local://` URL to an absolute path given resolve options. */
export function resolveLocalUrlToPath(input: string, _opts: LocalResolveOptions): string | undefined {
	void input;
	return undefined;
}

/** List the mounted memory roots from the current session registry. */
export function memoryRootsFromRegistry(): MemoryRoot[] {
	return [];
}

/** Resolve a `memory://` URL to an absolute path within a given root. */
export function resolveMemoryUrlToPath(url: InternalUrl, _root: MemoryRoot): string {
	throw new Error(`memory:// resolution is not supported (${url.raw})`);
}
