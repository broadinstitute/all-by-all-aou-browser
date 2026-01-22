import { Button } from '@gnomad/ui'
import React from 'react'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { regionIdAtom } from '../sharedState'

export const ZoomRegion: React.FC = () => {
  const setRegionId = useSetRecoilState(regionIdAtom)

  const handleZoom = (zoomIn: boolean) => {
    setRegionId((currentRegionId) => {
      if (!currentRegionId) return currentRegionId

      const [contig, start, stop] = currentRegionId.split('-')
      const regionStart = parseInt(start)
      const regionStop = parseInt(stop)
      const zoomValue = 200_000

      const newStart = zoomIn
        ? Math.max(0, regionStart + zoomValue)
        : Math.max(0, regionStart - zoomValue)
      const newStop = zoomIn ? regionStop - zoomValue : regionStop + zoomValue

      return `${contig}-${Math.round(newStart)}-${Math.round(newStop)}`
    })
  }

  const isZoomInDisabled = () => {
    const currentRegionId = useRecoilValue(regionIdAtom)
    if (!currentRegionId) return false
    const [_, start, stop] = currentRegionId.split('-')
    return parseInt(stop) <= parseInt(start)
  }

  return (
    <div style={{ display: 'flex', gap: '10px', }}>
      <Button
        onClick={() => handleZoom(true)}
        backgroundColor='lightgreen'
        disabled={isZoomInDisabled()}
      >
        Zoom In
      </Button>
      <Button onClick={() => handleZoom(false)} backgroundColor='lightcoral'>
        Zoom Out
      </Button>
    </div>
  )
}
