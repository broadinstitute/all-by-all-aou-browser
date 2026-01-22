import { debounce } from 'lodash'
import { useEffect } from 'react'
import { useSetRecoilState } from 'recoil'
import { windowSizeAtom } from './sharedState'

let resizeCallbacks: any = []

window.addEventListener(
  'resize',
  debounce(
    () =>
      resizeCallbacks.forEach((cb: any) => {
        const width = window.innerWidth
        const height = window.innerHeight
        cb({ width, height })
      }),
    500
  )
)

export function useMonitorWindowSize() {
  const setSize = useSetRecoilState(windowSizeAtom)

  useEffect(() => {
    resizeCallbacks.push(setSize)
    return function unsubscribe() {
      resizeCallbacks = resizeCallbacks.filter((cb: any) => cb !== setSize)
    }
  })
}
