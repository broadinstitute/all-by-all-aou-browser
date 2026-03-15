import { useLayoutEffect } from 'react'
import { RecoilState, useSetRecoilState } from 'recoil'

/**
 * Restore a Recoil atom's value from the current URL state on mount.
 * This ensures that lazily-mounted components correctly pick up state
 * from client-side navigation, bypassing recoil-sync initialization bugs.
 */
export function useRestoreFromUrl<T>(atom: RecoilState<T>, key: string, validValues?: Set<string>) {
  const setState = useSetRecoilState(atom)

  useLayoutEffect(() => {
    let parsed: Record<string, any> = {}
    try {
      const stateStr = new URLSearchParams(window.location.search).get('state')
      if (stateStr) parsed = JSON.parse(stateStr)
    } catch {}

    const urlValue = parsed[key]
    if (urlValue != null && (!validValues || validValues.has(urlValue))) {
      setState(urlValue as T)
    }
  }, [key, setState, validValues])
}
