import { debounce } from 'lodash'
import { useEffect, useState } from 'react'

let resizeCallbacks: any = []

window.addEventListener(
  'resize',
  debounce(
    () =>
      // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'cb' implicitly has an 'any' type.
      resizeCallbacks.forEach((cb) => {
        const width = window.innerWidth
        const height = window.innerHeight
        cb({ width, height })
      }),
    500
  )
)

const withWindowSize = (Component: any) => {
  const WithWindowSize = (props: any) => {
    const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })

    useEffect(() => {
      resizeCallbacks.push(setSize)
      return function unsubscribe() {
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'cb' implicitly has an 'any' type.
        resizeCallbacks = resizeCallbacks.filter((cb) => cb !== setSize)
      }
    })

    return <Component {...props} width={size.width} height={size.height} />
  }

  const componentName = Component.displayName || Component.name || 'Component'
  WithWindowSize.displayName = `withWindowSize(${componentName}`

  return WithWindowSize
}

export default withWindowSize
