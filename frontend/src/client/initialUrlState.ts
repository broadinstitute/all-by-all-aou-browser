// Capture the URL state at module load time, before React/Recoil can modify it.
// This is needed because lazily-initialized recoil-sync atoms (like topResultsTabAtom)
// may lose their URL values when earlier atoms' syncDefault writes rebuild the state blob.
let parsed: Record<string, any> = {}
try {
  const stateStr = new URLSearchParams(window.location.search).get('state')
  if (stateStr) parsed = JSON.parse(stateStr)
} catch {}

export const initialUrlState = parsed
