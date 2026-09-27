import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { normalCdf } from '../../engine/scoring'

const PAD_L = 14
const PAD_R = 14
const TOP = 34
const MIN = 40
const MAX = 160
const TICKS = [55, 70, 85, 100, 115, 130, 145]
const pdf = (iq: number) => Math.exp(-0.5 * ((iq - 100) / 15) ** 2)

/** Рисуем в реальных пикселях контейнера, чтобы подписи не мельчали на телефоне. */
function useGeometry(W: number) {
  const H = Math.round(Math.max(190, Math.min(250, W * 0.34)))
  const BASE = H - 44
  const x = (iq: number) => PAD_L + ((iq - MIN) / (MAX - MIN)) * (W - PAD_L - PAD_R)
  const y = (iq: number) => BASE - pdf(iq) * (BASE - TOP)
  const areaPath = (from: number, to: number) => {
    let d = `M ${x(from).toFixed(1)} ${BASE}`
    for (let v = from; v <= to + 0.001; v += 0.5) d += ` L ${x(v).toFixed(1)} ${y(v).toFixed(1)}`
    return `${d} L ${x(to).toFixed(1)} ${BASE} Z`
  }
  let line = ''
  for (let v = MIN; v <= MAX; v += 0.5) line += `${line ? ' L' : 'M'} ${x(v).toFixed(1)} ${y(v).toFixed(1)}`
  return { H, BASE, x, y, areaPath, line }
}

const pct = (iq: number) => normalCdf((iq - 100) / 15) * 100

/** Нормальное распределение IQ (μ = 100, σ = 15) с отметкой результата. */
export function BellCurve({ iq, se }: { iq: number; se: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(680)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const { H, BASE, x, y, areaPath, line } = useGeometry(W)
  const narrow = W < 460
  const ticks = narrow ? TICKS.filter((t) => t !== 55 && t !== 145) : TICKS
  const clamped = Math.max(MIN, Math.min(MAX, iq))
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const v = MIN + ((px - PAD_L) / (W - PAD_L - PAD_R)) * (MAX - MIN)
    setHover(Math.round(Math.max(MIN, Math.min(MAX, v))))
  }
  const labelX = Math.max(44, Math.min(W - 44, x(clamped)))
  return (
    <figure className="w-full">
      <div className="relative" ref={box}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="h-auto w-full touch-none select-none"
          role="img"
          aria-label={`Ваш IQ ${iq} на нормальном распределении: выше, чем у ${Math.round(pct(iq))}% людей`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <line key={t} x1={x(t)} x2={x(t)} y1={TOP - 6} y2={BASE} strokeWidth="1" style={{ stroke: 'rgb(var(--line))' }} />
          ))}
          <path d={areaPath(Math.max(MIN, iq - se), Math.min(MAX, iq + se))} style={{ fill: 'rgb(var(--saffron) / 0.16)' }} />
          <motion.path
            key={`fill-${W}`}
            d={areaPath(MIN, clamped)}
            style={{ fill: 'rgb(var(--cobalt) / 0.14)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          />
          <motion.path
            key={`line-${W}`}
            d={line}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ stroke: 'rgb(var(--cobalt))' }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />
          <line x1={PAD_L} x2={W - PAD_R} y1={BASE} y2={BASE} strokeWidth="1" style={{ stroke: 'rgb(var(--faint))' }} />
          {ticks.map((t) => (
            <text key={t} x={x(t)} y={BASE + 20} textAnchor="middle" className="font-mono" style={{ fill: 'rgb(var(--muted))', fontSize: 12 }}>
              {t}
            </text>
          ))}
          <text x={x(100)} y={BASE + 38} textAnchor="middle" style={{ fill: 'rgb(var(--faint))', fontSize: 11 }}>
            среднее
          </text>
          <motion.g initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.5 }}>
            <line x1={x(clamped)} x2={x(clamped)} y1={TOP - 12} y2={BASE} strokeWidth="2" style={{ stroke: 'rgb(var(--saffron))' }} />
            <circle cx={x(clamped)} cy={y(clamped)} r="6" strokeWidth="2" style={{ fill: 'rgb(var(--saffron))', stroke: 'rgb(var(--surface))' }} />
            <text x={labelX} y={TOP - 18} textAnchor="middle" style={{ fill: 'rgb(var(--ink))', fontSize: 13, fontWeight: 600 }}>
              вы · {iq}
            </text>
          </motion.g>
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={BASE} strokeWidth="1" style={{ stroke: 'rgb(var(--ink) / 0.35)' }} />
              <circle cx={x(hover)} cy={y(hover)} r="4" strokeWidth="2" style={{ fill: 'rgb(var(--cobalt))', stroke: 'rgb(var(--surface))' }} />
            </g>
          )}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-sm"
            style={{ left: `${Math.max(18, Math.min(82, (x(hover) / W) * 100))}%` }}
          >
            <div className="font-semibold tabular">IQ {hover}</div>
            <div className="text-muted tabular">ниже этого — {pct(hover).toFixed(pct(hover) > 99 ? 1 : 0)}% людей</div>
          </div>
        )}
      </div>
      <figcaption className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm" style={{ background: 'rgb(var(--cobalt) / 0.3)' }} /> доля людей с результатом ниже вашего
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm" style={{ background: 'rgb(var(--saffron) / 0.35)' }} /> погрешность ±{se}
        </span>
      </figcaption>
    </figure>
  )
}
