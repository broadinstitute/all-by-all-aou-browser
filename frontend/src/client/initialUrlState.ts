// Capture the URL state at module load time, before React/Recoil can modify it.
// This is needed because lazily-initialized recoil-sync atoms (like topResultsTabAtom,
// phenotypeTabAtom, geneBurdenViewModeAtom) may lose their URL values when earlier
// atoms' syncDefault writes rebuild the state blob.
import { useLayoutEffect } from 'react'
import { RecoilState, useSetRecoilState } from 'recoil'

let parsed: Record<string, any> = {}
try {
  const stateStr = new URLSearchParams(window.location.search).get('state')
  if (stateStr) parsed = JSON.parse(stateStr)
} catch {}

export const initialUrlState = parsed

// Track which keys have already been restored globally, so we only
// restore once per page load (not on every component remount during
// client-side navigation).
const restoredKeys = new Set<string>()

/**
 * Restore a Recoil atom's value from the initial URL state on mount.
 * Only runs once per key per page load — subsequent component mounts
 * (from client-side navigation) are no-ops.
 */
export function useRestoreFromUrl<T>(atom: RecoilState<T>, key: string, validValues?: Set<string>) {
  const setState = useSetRecoilState(atom)

  useLayoutEffect(() => {
    if (restoredKeys.has(key)) return
    restoredKeys.add(key)
    const urlValue = initialUrlState[key]
    if (urlValue != null && (!validValues || validValues.has(urlValue))) {
      setState(urlValue as T)
    }
  }, [])
}
