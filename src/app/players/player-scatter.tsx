'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { PlayerListItem } from './page'

/**
 * Scatter plot: Sets Played (X) vs Win Rate (Y).
 * Top-right = most active + highest win rate.
 * Only shows players with at least 1 set.
 */

const W = 720
const H = 340
const PAD = { top: 20, right: 20, bottom: 38, left: 48 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

// Grid lines
const Y_TICKS = [0, 25, 50, 75, 100]

export function PlayerScatter({ players }: { players: PlayerListItem[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const eligible = useMemo(
    () => players.filter((p) => p.total_sets > 0),
    [players],
  )

  const points = useMemo(() => {
    const maxSets = Math.max(...eligible.map((p) => p.total_sets), 1)
    // Round up to nearest nice number for X axis
    const xCeil = Math.ceil(maxSets / 5) * 5

    return eligible.map((p) => {
      const winRate = (p.set_wins / p.total_sets) * 100
      const x = PAD.left + (p.total_sets / xCeil) * PLOT_W
      const y = PAD.top + (1 - winRate / 100) * PLOT_H
      // Radius based on tournament count (more tournaments = bigger dot)
      const r = Math.max(4, Math.min(10, 3 + p.tournament_count * 0.6))
      return { ...p, winRate, x, y, r, xCeil }
    })
  }, [eligible])

  if (eligible.length < 3) return null

  const xCeil = points[0]?.xCeil ?? 20
  const xTicks = buildXTicks(xCeil)

  const hovered = hoveredId ? points.find((p) => p.id === hoveredId) : null

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-xs font-medium uppercase tracking-widest text-white/30">
          Competitive Landscape
        </h3>
        <span className="text-[10px] text-white/20">
          {eligible.length} players with set data
        </span>
      </div>

      <div className="relative px-2 pb-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: 340 }}
        >
          <defs>
            {/* Glow filter for dots */}
            <filter id="scatter-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Stronger glow for hovered */}
            <filter id="scatter-glow-hover" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Scan line pattern */}
            <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="1" fill="white" opacity="0.015" />
            </pattern>
          </defs>

          {/* Background scanlines */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="url(#scanlines)"
          />

          {/* 50% win rate reference line */}
          <line
            x1={PAD.left}
            y1={PAD.top + PLOT_H * 0.5}
            x2={PAD.left + PLOT_W}
            y2={PAD.top + PLOT_H * 0.5}
            stroke="white"
            strokeOpacity={0.08}
            strokeDasharray="6 4"
          />

          {/* Y grid lines */}
          {Y_TICKS.map((tick) => {
            const y = PAD.top + (1 - tick / 100) * PLOT_H
            return (
              <g key={`y-${tick}`}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={PAD.left + PLOT_W}
                  y2={y}
                  stroke="white"
                  strokeOpacity={0.04}
                />
                <text
                  x={PAD.left - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-[10px]"
                  fill="white"
                  fillOpacity={0.2}
                >
                  {tick}%
                </text>
              </g>
            )
          })}

          {/* X grid lines */}
          {xTicks.map((tick) => {
            const x = PAD.left + (tick / xCeil) * PLOT_W
            return (
              <g key={`x-${tick}`}>
                <line
                  x1={x}
                  y1={PAD.top}
                  x2={x}
                  y2={PAD.top + PLOT_H}
                  stroke="white"
                  strokeOpacity={0.04}
                />
                <text
                  x={x}
                  y={PAD.top + PLOT_H + 16}
                  textAnchor="middle"
                  className="text-[10px]"
                  fill="white"
                  fillOpacity={0.2}
                >
                  {tick}
                </text>
              </g>
            )
          })}

          {/* Axis labels */}
          <text
            x={PAD.left + PLOT_W / 2}
            y={H - 4}
            textAnchor="middle"
            className="text-[10px] uppercase"
            fill="white"
            fillOpacity={0.15}
            letterSpacing="0.1em"
          >
            Sets Played
          </text>
          <text
            x={12}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(-90, 12, ${PAD.top + PLOT_H / 2})`}
            className="text-[10px] uppercase"
            fill="white"
            fillOpacity={0.15}
            letterSpacing="0.1em"
          >
            Win Rate
          </text>

          {/* Player dots */}
          {points.map((p) => {
            const isHovered = hoveredId === p.id
            const color = dotColor(p.winRate)
            return (
              <g key={p.id}>
                <Link href={`/players/${p.id}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? p.r + 3 : p.r}
                    fill={color}
                    fillOpacity={isHovered ? 0.9 : 0.5}
                    stroke={color}
                    strokeOpacity={isHovered ? 0.8 : 0.2}
                    strokeWidth={isHovered ? 2 : 1}
                    filter={isHovered ? 'url(#scatter-glow-hover)' : 'url(#scatter-glow)'}
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                </Link>
              </g>
            )
          })}

          {/* Hover tooltip */}
          {hovered && (
            <g>
              {/* Crosshair lines */}
              <line
                x1={hovered.x}
                y1={PAD.top}
                x2={hovered.x}
                y2={PAD.top + PLOT_H}
                stroke="white"
                strokeOpacity={0.08}
                strokeDasharray="2 3"
              />
              <line
                x1={PAD.left}
                y1={hovered.y}
                x2={PAD.left + PLOT_W}
                y2={hovered.y}
                stroke="white"
                strokeOpacity={0.08}
                strokeDasharray="2 3"
              />

              {/* Tooltip box */}
              <TooltipBox point={hovered} />
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}

// ── Tooltip positioned to avoid edge clipping ──────────────────────────

function TooltipBox({ point }: { point: ReturnType<typeof usePoint> }) {
  const tipW = 140
  const tipH = 52
  // Position tooltip above and to the right, flip if near edges
  let tx = point.x + 12
  let ty = point.y - tipH - 8
  if (tx + tipW > W - PAD.right) tx = point.x - tipW - 12
  if (ty < PAD.top) ty = point.y + 16

  return (
    <g>
      <rect
        x={tx}
        y={ty}
        width={tipW}
        height={tipH}
        rx={6}
        fill="#0a0a0a"
        stroke="white"
        strokeOpacity={0.12}
        strokeWidth={1}
      />
      <text x={tx + 10} y={ty + 18} fill="white" fillOpacity={0.9} className="text-[12px] font-semibold">
        {point.gamer_tag}
      </text>
      <text x={tx + 10} y={ty + 33} fill="white" fillOpacity={0.4} className="text-[10px]">
        {point.set_wins}W–{point.total_sets - point.set_wins}L · {point.winRate.toFixed(0)}%
      </text>
      <text x={tx + 10} y={ty + 45} fill="white" fillOpacity={0.25} className="text-[9px]">
        {point.tournament_count} tournaments · {point.total_sets} sets
      </text>
    </g>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

// Dummy type helper for inference
function usePoint() {
  return null as unknown as {
    id: string
    gamer_tag: string
    tournament_count: number
    best_placement: number | null
    total_sets: number
    set_wins: number
    winRate: number
    x: number
    y: number
    r: number
    xCeil: number
  }
}

function dotColor(winRate: number): string {
  if (winRate >= 70) return '#34d399'  // emerald-400
  if (winRate >= 50) return '#60a5fa'  // blue-400
  if (winRate >= 30) return '#c084fc'  // purple-400
  return '#f87171'                     // red-400
}

function buildXTicks(max: number): number[] {
  if (max <= 10) return Array.from({ length: max / 2 + 1 }, (_, i) => i * 2)
  if (max <= 25) return [0, 5, 10, 15, 20, 25].filter((t) => t <= max)
  if (max <= 50) return [0, 10, 20, 30, 40, 50].filter((t) => t <= max)
  const step = Math.ceil(max / 5 / 10) * 10
  return Array.from({ length: 6 }, (_, i) => i * step).filter((t) => t <= max)
}
