import { useEffect, useRef } from 'react'
import { useRecoilSnapshot } from 'recoil'

export function DebugObserver() {
  const snapshot = useRecoilSnapshot()
  useEffect(() => {
    // @ts-ignore
    for (const node of snapshot.getNodes_UNSTABLE({ isModified: true })) {
      const loadable = snapshot.getLoadable(node)
      if (node.key === 'selectedAnalyses') {
        console.debug(node.key, loadable.contents)
      }
    }
  }, [snapshot])

  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function print(value: any) {
  if (typeof value === 'object') {
    return JSON.stringify(value).slice(0,100)
    // return value.entries()
  } else {
    return value.toString()
  }
}

export function useLogIfChanged<T>(name: string, value: T) {
  const previous = useRef(value)
  if (!Object.is(previous.current, value)) {
    console.log(`${name} changed. Old: ${print(previous.current)}, New: ${print(value)} `)
    previous.current = value
  }
}

