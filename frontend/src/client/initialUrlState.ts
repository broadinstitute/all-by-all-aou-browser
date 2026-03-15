// Capture the URL state at module load time, before React/Recoil can modify it.
// This is needed because lazily-initialized recoil-sync atoms (like topResultsTabAtom,
// phenotypeTabAtom, geneBurdenViewModeAtom) may lose their URL values when earlier
// atoms' syncDefault writes rebuild the state blob.
import { useLayoutEffect, useRef } from 'react'
import { RecoilState, useSetRecoilState } from 'recoil'

let parsed: Record<string, any> = {}
try {
  const stateStr = new URLSearchParams(window.location.search).get('state')
  if (stateStr) parsed = JSON.parse(stateStr)
} catch {}

export const initialUrlState = parsed

/**
 * Restore a Recoil atom's value from the initial URL state on mount.
 * Works around the recoil-sync lazy initialization race condition where
 * atoms that subscribe after the initial URL read lose their values.
 */
export function useRestoreFromUrl<T>(atom: RecoilState<T>, key: string, validValues?: Set<string>) {
  const setState = useSetRecoilState(atom)
  const hasInitialized = useRef(false)

  useLayoutEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    const urlValue = initialUrlState[key]
    if (urlValue != null && (!validValues || validValues.has(urlValue))) {
      setState(urlValue as T)
    }
  }, [])
}
