'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import type { PlayerProfile } from '@/lib/actions/player-profile'

/**
 * Placement timeline — HUD chart showing placement percentile over time
 * with field-size context bars along the bottom strip.
 * Top = best (1st), bottom = worst. Dot color reflects percentile tier.
 * Responsive: viewBox matches container width so text stays readable.
 */

const PAD_TOP = 24
const PAD_RIGHT = 16
const PAD_BOTTOM = 52
const BAR_H = 28
const GAP = 10

export function PlacementTimeline({
  results,
}: {
  results: PlayerProfile['tournamentResults']
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hovIdx, setHovIdx] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const MAX_EVENTS = 25
  const allChrono = useMemo(() => [...results].reverse(), [results])
  const capped = allChrono.length > MAX_EVENTS
  const chrono = capped ? allChrono.slice(allChrono.length - MAX_EVENTS) : allChrono
  if (chrono.length < 2) return null

  // Responsive dimensions — taller on mobile so axis labels have room
  const W = width || 360
  const isMobile = W < 500
  const aspect = isMobile ? 0.7 : 0.5
  const padLeft = isMobile ? 36 : 44
  const H = Math.round(W * aspect)
  const PLOT_W = W - padLeft - PAD_RIGHT
  const PLOT_H = H - PAD_TOP - PAD_BOTTOM
  const chartH = PLOT_H - BAR_H - GAP
  const fontSize = isMobile ? 12 : 11
  const n = chrono.length

  const maxField = Math.max(...chrono.map((r) => r.total_participants), 1)

  // Scale dot size down when there are many events
  const dotR = n > 20 ? 2.5 : n > 12 ? 3 : 4
  const glowR = dotR * 2

  const points = chrono.map((r, i) => {
    const pct =
      r.total_participants > 1
        ? (r.placement - 1) / (r.total_participants - 1)
        : 0
    const clampedPct = Math.max(0, Math.min(1, pct))
    const x = padLeft + (i / (n - 1)) * PLOT_W
    const y = PAD_TOP + clampedPct * chartH
    const barHeight = (r.total_participants / maxField) * BAR_H
    const barY = PAD_TOP + chartH + GAP + (BAR_H - barHeight)
    return { ...r, pct: clampedPct, x, y, barHeight, barY }
  })

  const linePath = smoothPath(points)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD_TOP + chartH} L ${points[0].x} ${PAD_TOP + chartH} Z`
  const maxDateLabels = isMobile ? 3 : n > 30 ? 4 : 5
  const xLabels = spacedIndices(n, maxDateLabels)
  const pctTicks = [0, 0.25, 0.5, 0.75, 1.0]
  const pctLabels = ['1st', '25%', '50%', '75%', 'Last']

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
          <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-white/30">
            Tournament Progression
          </h3>
        </div>
        <span className="font-mono text-[10px] text-white/20">
          {capped ? `Last ${MAX_EVENTS} of ${allChrono.length}` : `${chrono.length} events`}
        </span>
      </div>

      <div ref={containerRef} className="relative px-2 pb-3">
        {width > 0 && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            onTouchStart={(e) => {
              if ((e.target as SVGElement).tagName !== 'circle') setHovIdx(null)
            }}
          >
            <defs>
              <filter id="ptl-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="ptl-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
              <pattern id="ptl-scan" width="4" height="4" patternUnits="userSpaceOnUse">
                <rect width="4" height="1" fill="white" opacity="0.012" />
              </pattern>
            </defs>

            {/* Scan-line background */}
            <rect x={padLeft} y={PAD_TOP} width={PLOT_W} height={PLOT_H} fill="url(#ptl-scan)" />

            {/* Percentile grid lines */}
            {pctTicks.map((pct, i) => {
              const y = PAD_TOP + pct * chartH
              return (
                <g key={`g-${i}`}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + PLOT_W}
                    y2={y}
                    stroke="white"
                    strokeOpacity={pct === 0.5 ? 0.06 : 0.03}
                    strokeDasharray={pct === 0.5 ? '6 4' : '3 8'}
                  />
                  <text
                    x={padLeft - 6}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill="white"
                    fillOpacity={0.2}
                    fontSize={fontSize}
                  >
                    {pctLabels[i]}
                  </text>
                </g>
              )
            })}

            {/* "Field" label */}
            <text
              x={padLeft - 6}
              y={PAD_TOP + chartH + GAP + BAR_H / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fill="white"
              fillOpacity={0.12}
              fontSize={fontSize - 2}
              letterSpacing="0.05em"
            >
              Field
            </text>

            {/* Area gradient */}
            <path d={areaPath} fill="url(#ptl-area)" />

            {/* Glow line */}
            <path
              d={linePath}
              fill="none"
              stroke="#22d3ee"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#ptl-glow)"
              opacity={0.35}
            />
            {/* Crisp line */}
            <path
              d={linePath}
              fill="none"
              stroke="#22d3ee"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points + field bars */}
            {points.map((p, i) => {
              const color = pctColor(p.pct)
              const isH = hovIdx === i
              return (
                <g key={i}>
                  <rect
                    x={p.x - Math.max(2, dotR - 1)}
                    y={p.barY}
                    width={Math.max(4, (dotR - 1) * 2)}
                    height={p.barHeight}
                    rx={2}
                    fill="white"
                    fillOpacity={isH ? 0.1 : 0.04}
                  />
                  {/* Crosshair on hover */}
                  {isH && (
                    <>
                      <line x1={p.x} y1={PAD_TOP} x2={p.x} y2={PAD_TOP + chartH} stroke="white" strokeOpacity={0.06} strokeDasharray="2 3" />
                      <line x1={padLeft} y1={p.y} x2={padLeft + PLOT_W} y2={p.y} stroke="white" strokeOpacity={0.06} strokeDasharray="2 3" />
                    </>
                  )}
                  <circle cx={p.x} cy={p.y} r={isH ? glowR * 1.8 : glowR} fill={color} opacity={isH ? 0.2 : 0.08} />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isH ? dotR + 2 : dotR}
                    fill={color}
                    stroke={color}
                    strokeOpacity={isH ? 0.8 : 0.4}
                    strokeWidth={isH ? 2 : 1.5}
                    filter="url(#ptl-glow)"
                    className="cursor-pointer transition-all duration-100"
                    onMouseEnter={() => setHovIdx(i)}
                    onMouseLeave={() => setHovIdx(null)}
                    onTouchStart={(e) => {
                      e.preventDefault()
                      setHovIdx(hovIdx === i ? null : i)
                    }}
                  />
                  {points.length <= 12 && !isH && (
                    <text
                      x={p.x}
                      y={p.y - 10}
                      textAnchor="middle"
                      fill="white"
                      fillOpacity={0.3}
                      fontSize={fontSize - 2}
                      fontFamily="monospace"
                    >
                      {ordinal(p.placement)}
                    </text>
                  )}
                </g>
              )
            })}

            {/* X-axis date labels */}
            {xLabels.map((idx) => {
              const p = points[idx]
              return (
                <text
                  key={idx}
                  x={p.x}
                  y={H - 8}
                  textAnchor="middle"
                  fill="white"
                  fillOpacity={0.18}
                  fontSize={fontSize}
                >
                  {fmtDate(p.tournament_date)}
                </text>
              )
            })}

            {/* Hover tooltip */}
            {hovIdx !== null && points[hovIdx] && (
              <PtlTip p={points[hovIdx]} W={W} H={H} padLeft={padLeft} chartH={chartH} fontSize={fontSize} />
            )}

            {/* HUD corner brackets */}
            <Bracket x={padLeft + 4} y={PAD_TOP + 4} />
            <Bracket x={padLeft + PLOT_W - 4} y={PAD_TOP + 4} flipX />
            <Bracket x={padLeft + 4} y={PAD_TOP + PLOT_H - 4} flipY />
            <Bracket x={padLeft + PLOT_W - 4} y={PAD_TOP + PLOT_H - 4} flipX flipY />
          </svg>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function PtlTip({ p, W, H, padLeft, chartH, fontSize }: {
  p: { tournament_name: string; tournament_date: string; placement: number; total_participants: number; pct: number; x: number; y: number }
  W: number; H: number; padLeft: number; chartH: number; fontSize: number
}) {
  const tw = W < 500 ? 130 : 155
  const th = 52
  let tx = p.x + 10
  let ty = p.y - th - 8
  if (tx + tw > W - 16) tx = p.x - tw - 10
  if (ty < PAD_TOP) ty = p.y + 12

  const topPct = Math.max(1, Math.round(p.pct * 100))
  const pctLabel = p.placement === 1
    ? '1st place'
    : `Top ${topPct}%`

  const maxChars = W < 500 ? 16 : 22
  const name = p.tournament_name.length > maxChars
    ? p.tournament_name.slice(0, maxChars - 1) + '…'
    : p.tournament_name

  return (
    <g className="pointer-events-none">
      <rect x={tx} y={ty} width={tw} height={th} rx={6} fill="#0a0a0a" stroke="white" strokeOpacity={0.1} />
      <text x={tx + 8} y={ty + 15} fill="white" fillOpacity={0.9} fontSize={fontSize} fontWeight="600">
        {name}
      </text>
      <text x={tx + 8} y={ty + 30} fill="white" fillOpacity={0.4} fontSize={fontSize - 1} fontFamily="monospace">
        {ordinal(p.placement)} / {p.total_participants}, {pctLabel}
      </text>
      <text x={tx + 8} y={ty + 44} fill="white" fillOpacity={0.2} fontSize={fontSize - 2}>
        {fmtDate(p.tournament_date)}
      </text>
    </g>
  )
}

function Bracket({
  x,
  y,
  flipX,
  flipY,
}: {
  x: number
  y: number
  flipX?: boolean
  flipY?: boolean
}) {
  const sx = flipX ? -1 : 1
  const sy = flipY ? -1 : 1
  return (
    <g>
      <line x1={x} y1={y} x2={x + 12 * sx} y2={y} stroke="white" strokeOpacity={0.06} />
      <line x1={x} y1={y} x2={x} y2={y + 12 * sy} stroke="white" strokeOpacity={0.06} />
    </g>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pctColor(pct: number): string {
  if (pct <= 0.1) return '#34d399'
  if (pct <= 0.25) return '#22d3ee'
  if (pct <= 0.5) return '#60a5fa'
  return '#f87171'
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function fmtDate(d: string): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function spacedIndices(total: number, max: number): number[] {
  if (total <= max) return Array.from({ length: total }, (_, i) => i)
  const out = [0]
  const step = (total - 1) / (max - 1)
  for (let i = 1; i < max - 1; i++) out.push(Math.round(step * i))
  out.push(total - 1)
  return out
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2)
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`
  }
  return d
}
