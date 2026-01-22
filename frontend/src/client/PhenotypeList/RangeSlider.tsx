/* eslint-disable react/button-has-type */

import React, { useEffect, useRef } from 'react'
import styled from 'styled-components'
import debounce from 'lodash/debounce'
import { useRanger } from 'react-ranger'
import { scaleLinear, scaleLog } from 'd3-scale'

const RootBase = styled.div`
  display: grid;
  grid-template-columns: 1fr 3fr 1fr;
  column-gap: 5px;
  align-items: center;
  height: 100%;
`

const RootNoInputs = styled(RootBase)`
  grid-template-columns: 100%;
  width: 100%;
`

const SliderContainer = styled.div``
const InputContainer = styled.div`
  padding: 5px;
`

const Input = styled.input`
  max-width: 30px;
`

export const Track = styled('div')`
  display: inline-block;
  height: 8px;
  width: 90%;
  margin: 0 5%;
`

export const Tick = styled.div`
  :before {
    content: '';
    position: absolute;
    left: 0;
    background: rgba(0, 0, 0, 0.2);
    height: 5px;
    width: 2px;
    transform: translate(-50%, 0.7rem);
  }
`

export const TickLabel = styled.div`
  position: absolute;
  font-size: 0.6rem;
  color: rgba(0, 0, 0, 0.5);
  top: 100%;
  transform: translate(-50%, 1.2rem);
  white-space: nowrap;
`

export const Segment = styled('div')`
  background: lightgrey;
  margin-top: 2px;
  height: 50%;
`

const logInterpolator = {
  getPercentageForValue: (val: number, min: number, max: number) => {
    const minSign = Math.sign(min)
    const maxSign = Math.sign(max)

    if (minSign !== maxSign) {
      throw new Error('Error: logarithmic interpolation does not support ranges that cross 0.')
    }

    let percent =
      (100 / (Math.log10(Math.abs(max)) - Math.log10(Math.abs(min)))) *
      (Math.log10(Math.abs(val)) - Math.log10(Math.abs(min)))

    if (minSign < 0) {
      // negative range, means we need to invert our percent because of the Math.abs above
      return 100 - percent
    }

    return percent
  },
  getValueForClientX: (clientX: number, trackDims: any, min: number, max: number) => {
    const { left, width } = trackDims
    let value = clientX - left
    value *= Math.log10(max) - Math.log10(min)
    value /= width
    value = Math.pow(10, Math.log10(min) + value)
    return value
  },
}

const RangeSlider = ({
  presetInterval,
  initialValues,
  onIntervalChange,
  step,
  hideLowerBound = false,
  showInputs = true,
  updateInterval = 200,
  useLogScale = false,
}: any) => {
  const [min, max] = presetInterval
  const [values, setValues] = React.useState(initialValues || [min, max])

  const scaleLogOrLinear = useLogScale ? scaleLog : scaleLinear

  const scale = scaleLogOrLinear().domain([min, max])

  const { getTrackProps, segments, handles, ticks } = useRanger({
    min,
    max,
    stepSize: step,
    values,
    onDrag: setValues,
    ticks: scale.ticks(4),
    interpolator: useLogScale ? logInterpolator : undefined,
  })

  const precision = max < 10 && 3

  const renderTruncatedNumber = (num: any) => {
    if (num === null || num === undefined) {
      return null
    }
    if (precision) {
      return Number(num).toPrecision(precision)
    }
    return Number(num)
  }

  const onIntervalChangeRef = useRef(onIntervalChange)
  useEffect(() => {
    onIntervalChangeRef.current = onIntervalChange
  }, [])

  const notifyRef = useRef(
    debounce(currentInterval => {
      onIntervalChangeRef.current(currentInterval)
    }, updateInterval)
  )

  useEffect(() => {
    notifyRef.current([values[0], values[1]])
    return () => notifyRef.current.cancel()
  }, [values[0], values[1]])

  const Root = showInputs ? RootBase : RootNoInputs

  const handlesRendered = hideLowerBound ? [handles[1]] : handles

  return (
    <Root>
      {showInputs && (
        <InputContainer>
          <Input
            // @ts-expect-error ts-migrate(2769) FIXME: No overload matches this call.
            value={renderTruncatedNumber(values[0])}
            onChange={event => setValues([event.target.value, values[1]])}
          />
        </InputContainer>
      )}
      <SliderContainer>
        <Track {...getTrackProps()}>
          {ticks.map(({ value, getTickProps }: any) => (
            <Tick {...getTickProps()}>
              <TickLabel>{value}</TickLabel>
            </Tick>
          ))}
          {segments.map(({ getSegmentProps }: any, i: any) => (
            <Segment {...getSegmentProps()} index={i} />
          ))}
          {handlesRendered.map(({ getHandleProps }: any) => (
            <button
              {...getHandleProps({
                style: {
                  width: '14px',
                  height: '14px',
                  outline: 'none',
                  borderRadius: '100%',
                  background: 'linear-gradient(to bottom, #eee 45%, #ddd 55%)',
                  border: 'solid 1px #888',
                },
              })}
            />
          ))}
        </Track>
      </SliderContainer>
      {showInputs && (
        <InputContainer>
          <Input
            // @ts-expect-error ts-migrate(2769) FIXME: No overload matches this call.
            value={renderTruncatedNumber(values[1])}
            margin="dense"
            onChange={event => setValues([values[0], event.target.value])}
          />
        </InputContainer>
      )}
    </Root>
  )
}

export default RangeSlider
