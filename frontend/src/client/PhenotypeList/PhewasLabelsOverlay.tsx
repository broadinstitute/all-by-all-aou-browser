import React, { useState, useEffect, useRef } from 'react'
import * as d3Force from 'd3-force'

export interface LabelNode {
  id: string
  targetX: number
  targetY: number
  label: string
  color: string
  x: number
  y: number
  fx: number | null
  fy: number | null
  width: number
  height: number
}

interface PhewasLabelsOverlayProps {
  points: { id: string; targetX: number; targetY: number; label: string; color: string }[]
  labeledPhenoIds: Set<string>
  labelOverrides: Record<string, { x: number; y: number }>
  onLabelDragEnd: (id: string, x: number, y: number) => void
  width: number
  height: number
}

export const PhewasLabelsOverlay: React.FC<PhewasLabelsOverlayProps> = ({
  points,
  labeledPhenoIds,
  labelOverrides,
  onLabelDragEnd,
  width,
  height,
}) => {
  const [nodes, setNodes] = useState<LabelNode[]>([])
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Layout engine
  useEffect(() => {
    const newNodes = points
      .filter((p) => labeledPhenoIds.has(p.id))
      .map((p) => {
        const override = labelOverrides[p.id]
        // Estimate label width: ~6px per character + 12px padding
        const textWidth = p.label.length * 6 + 12
        return {
          ...p,
          x: override ? override.x : p.targetX,
          y: override ? override.y : Math.max(15, p.targetY - 30),
          fx: override ? override.x : null,
          fy: override ? override.y : null,
          width: textWidth,
          height: 18,
        }
      })

    if (newNodes.length === 0) {
      setNodes([])
      return
    }

    // Run force simulation to prevent label overlap
    const simulation = d3Force
      .forceSimulation(newNodes as d3Force.SimulationNodeDatum[])
      .force('x', d3Force.forceX((d: any) => d.targetX).strength(0.3))
      .force('y', d3Force.forceY((d: any) => Math.max(15, d.targetY - 30)).strength(0.3))
      .force('collide', d3Force.forceCollide((d: any) => d.width * 0.5 + 4).strength(1))
      .stop()

    for (let i = 0; i < 60; ++i) simulation.tick()

    // Constrain labels within the viewable area
    newNodes.forEach((n) => {
      n.x = Math.max(n.width / 2 + 2, Math.min(width - n.width / 2 - 2, n.x))
      n.y = Math.max(n.height / 2 + 2, Math.min(height - n.height / 2 - 2, n.y))
    })

    setNodes(newNodes)
  }, [points, labeledPhenoIds, labelOverrides, width, height])

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDraggedNode(id)
  }

  useEffect(() => {
    if (!draggedNode) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setNodes((prev) =>
        prev.map((n) => (n.id === draggedNode ? { ...n, x, y } : n))
      )
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      onLabelDragEnd(draggedNode, x, y)
      setDraggedNode(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggedNode, onLabelDragEnd])

  if (nodes.length === 0) return null

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {nodes.map((n) => {
        const isHovered = draggedNode === n.id
        return (
          <g key={n.id}>
            {/* Connecting line */}
            <line
              x1={n.targetX}
              y1={n.targetY}
              x2={n.x}
              y2={n.y}
              stroke={n.color}
              strokeWidth={1.5}
              strokeDasharray="2,2"
              opacity={0.6}
            />
            {/* Draggable label */}
            <g
              transform={`translate(${n.x}, ${n.y})`}
              style={{
                cursor: draggedNode ? 'grabbing' : 'grab',
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => handleMouseDown(e, n.id)}
            >
              <rect
                x={-n.width / 2}
                y={-n.height / 2}
                width={n.width}
                height={n.height}
                fill="rgba(255, 255, 255, 0.95)"
                stroke={isHovered ? '#333' : n.color}
                strokeWidth={isHovered ? 2 : 1}
                rx={3}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="11px"
                fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
                fill={isHovered ? '#000' : '#333'}
                fontWeight={500}
                y={1}
              >
                {n.label}
              </text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}
