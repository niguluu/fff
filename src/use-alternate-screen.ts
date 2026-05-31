// Alternate-screen lifecycle is now owned by the process entry point
// (`src/index.tsx`), which enters the alternate buffer *before* Ink's first
// render and restores it on exit. Doing the clear in a post-mount effect (the
// previous behaviour) erased Ink's first frame, so the UI only appeared after
// the next state change (e.g. the first keystroke).
//
// This hook is kept as a no-op so existing call sites stay valid while the
// terminal setup/teardown lives in exactly one place.
export function useAlternateScreen() {
  // intentionally empty — see module comment
}
