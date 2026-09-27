import { motion } from 'framer-motion'
import type { Cell, Dot, OptionContent, Visual } from '../../engine/types'
import { SYMBOL_NAMES } from '../../engine/generators/quant'
import { ALPHABET } from '../../engine/generators/verbal'
import { FigureCell, SymbolIcon } from './shapes'

// ── Полимино ────────────────────────────────────────────────────────────
export function ShapeView({ cells, unit = 26, className = '' }: { cells: Cell[]; unit?: number; className?: string }) {
  const w = Math.max(...cells.map((c) => c.x)) + 1
  const h = Math.max(...cells.map((c) => c.y)) + 1
  const box = Math.max(w, h)
  const pad = 0.35
  const size = box + pad * 2
  const ox = (size - w) / 2
  const oy = (size - h) / 2
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={unit * size} height={unit * size} className={`max-w-full h-auto ${className}`} aria-hidden="true">
      {cells.map((c, i) => (
        <rect
          key={i}
          x={ox + c.x + 0.05}
          y={oy + c.y + 0.05}
          width={0.9}
          height={0.9}
          rx={0.14}
          style={{ fill: c.c ? 'rgb(var(--saffron))' : 'rgb(var(--cobalt))' }}
        />
      ))}
    </svg>
  )
}

// ── Узор в сетке ────────────────────────────────────────────────────────
export function PatternView({ size, dots, px = 150, className = '' }: { size: number; dots: Dot[]; px?: number; className?: string }) {
  const map = new Map(dots.map((d) => [d.i, d.c]))
  return (
    <svg viewBox={`0 0 ${size * 10} ${size * 10}`} width={px} height={px} className={`max-w-full h-auto ${className}`} aria-hidden="true">
      <rect x="0.5" y="0.5" width={size * 10 - 1} height={size * 10 - 1} rx="2.5" fill="none" stroke="rgb(var(--line))" />
      {Array.from({ length: size - 1 }, (_, i) => (
        <g key={i}>
          <line x1={(i + 1) * 10} y1="1" x2={(i + 1) * 10} y2={size * 10 - 1} stroke="rgb(var(--line))" strokeWidth="0.5" />
          <line y1={(i + 1) * 10} x1="1" y2={(i + 1) * 10} x2={size * 10 - 1} stroke="rgb(var(--line))" strokeWidth="0.5" />
        </g>
      ))}
      {Array.from({ length: size * size }, (_, i) => {
        const c = map.get(i)
        if (c === undefined) return null
        const x = (i % size) * 10 + 5
        const y = Math.floor(i / size) * 10 + 5
        return <circle key={i} cx={x} cy={y} r={3.2} style={{ fill: c ? 'rgb(var(--saffron))' : 'rgb(var(--ink))' }} />
      })}
    </svg>
  )
}

function Chip({ children, missing = false, index = 0 }: { children?: React.ReactNode; missing?: boolean; index?: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.3 }}
      className={`inline-flex min-w-[2.6rem] items-center justify-center rounded-xl px-2.5 py-2 font-mono text-lg font-medium tabular sm:min-w-[3.1rem] sm:px-3 sm:py-2.5 sm:text-xl ${
        missing
          ? 'border-2 border-dashed border-saffron text-saffron bg-saffron-soft/60 animate-pulseRing'
          : 'border border-line bg-raised text-ink'
      }`}
    >
      {missing ? '?' : children}
    </motion.span>
  )
}

function Question() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-saffron bg-saffron-soft/50">
      <span className="font-display text-3xl font-semibold text-saffron animate-pulseRing">?</span>
    </div>
  )
}

export function AlphabetStrip() {
  return (
    <div>
      <div className="flex flex-wrap justify-center gap-[3px] font-mono text-[11px] text-muted" aria-label="Алфавит без буквы Ё">
        {[...ALPHABET].map((ch, i) => (
          <span key={ch} className="flex w-[22px] flex-col items-center rounded-md bg-raised py-1">
            <span className="text-[13px] text-ink">{ch}</span>
            <span className="text-[9px] text-faint">{i + 1}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function VisualView({ visual, compact = false }: { visual: Visual; compact?: boolean }) {
  switch (visual.type) {
    case 'sequence':
      return (
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
          {visual.items.map((it, i) => (
            <Chip key={i} missing={it === null} index={i}>
              {it}
            </Chip>
          ))}
        </div>
      )
    case 'matrix':
      return (
        <div className={`mx-auto grid grid-cols-3 gap-1.5 rounded-2xl border border-line bg-raised p-1.5 ${compact ? 'w-[210px]' : 'w-full max-w-[340px]'}`}>
          {visual.cells.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.035 * i, duration: 0.28 }}
              className="aspect-square rounded-lg bg-surface"
            >
              {c ? <FigureCell figure={c} className="h-full w-full" /> : <Question />}
            </motion.div>
          ))}
        </div>
      )
    case 'numberGrid':
      return (
        <div className="mx-auto grid w-full max-w-[300px] grid-cols-3 gap-1.5 rounded-2xl border border-line bg-raised p-1.5">
          {visual.cells.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.04 * i }}
              className="flex aspect-[4/3] items-center justify-center rounded-lg bg-surface font-mono text-xl font-medium tabular"
            >
              {c === null ? <Question /> : c}
            </motion.div>
          ))}
        </div>
      )
    case 'shape':
      return (
        <div className="flex justify-center">
          <div className="rounded-2xl border border-line bg-raised p-4">
            <ShapeView cells={visual.cells} unit={compact ? 20 : 30} />
          </div>
        </div>
      )
    case 'pattern':
      return (
        <div className="flex justify-center">
          <div className="rounded-2xl border border-line bg-raised p-3">
            <PatternView size={visual.size} dots={visual.dots} px={compact ? 120 : 170} />
          </div>
        </div>
      )
    case 'overlay':
      return (
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <div className="rounded-2xl border border-line bg-raised p-2.5 sm:p-3">
            <PatternView size={visual.size} dots={visual.a} px={140} className={compact ? 'w-[96px]' : 'w-[108px] sm:w-[140px]'} />
          </div>
          <span className="font-display text-2xl text-muted">+</span>
          <div className="rounded-2xl border border-line bg-raised p-2.5 sm:p-3">
            <PatternView size={visual.size} dots={visual.b} px={140} className={compact ? 'w-[96px]' : 'w-[108px] sm:w-[140px]'} />
          </div>
        </div>
      )
    case 'equations':
      return (
        <div className="mx-auto flex w-fit flex-col gap-2.5">
          {visual.lines.map((line, li) => (
            <motion.div
              key={li}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * li }}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 ${li === visual.lines.length - 1 ? 'bg-saffron-soft/60' : 'bg-raised'}`}
            >
              {line.map((tok, ti) =>
                tok.t === 'sym' ? (
                  <span key={ti} title={SYMBOL_NAMES[tok.s]}>
                    <SymbolIcon s={tok.s} size={compact ? 24 : 32} />
                  </span>
                ) : tok.t === 'op' ? (
                  <span key={ti} className="w-5 text-center font-mono text-xl text-muted">
                    {tok.v}
                  </span>
                ) : tok.t === 'num' ? (
                  <span key={ti} className="font-mono text-xl font-medium tabular">
                    {tok.v}
                  </span>
                ) : (
                  <span key={ti} className="font-display text-xl font-semibold text-saffron">
                    ?
                  </span>
                ),
              )}
            </motion.div>
          ))}
        </div>
      )
    case 'premises':
      return (
        <ul className="mx-auto flex max-w-xl flex-col gap-2">
          {visual.lines.map((l, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i }}
              className="rounded-xl border border-line bg-raised px-4 py-2.5 text-[15px] sm:text-base"
            >
              {l}
            </motion.li>
          ))}
        </ul>
      )
    case 'cipher':
      return (
        <div className="mx-auto flex w-fit flex-col gap-2 font-mono text-lg sm:text-xl">
          {visual.examples.map(([a, b], i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-raised px-4 py-2">
              <span className="tracking-[0.18em]">{a}</span>
              <span className="text-muted">→</span>
              <span className="tracking-[0.18em] text-cobalt">{b}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 rounded-xl bg-saffron-soft/60 px-4 py-2">
            <span className="tracking-[0.18em]">{visual.query}</span>
            <span className="text-muted">→</span>
            <span className="font-display font-semibold text-saffron">?</span>
          </div>
        </div>
      )
  }
}

export function OptionView({ option, small = false }: { option: OptionContent; small?: boolean }) {
  switch (option.type) {
    case 'text':
      return (
        <span className={`font-mono font-medium tabular ${option.value.length > 14 ? 'text-[15px] font-sans' : small ? 'text-lg' : 'text-xl'} leading-snug`}>
          {option.value}
        </span>
      )
    case 'figure':
      return <FigureCell figure={option.figure} className={small ? 'h-14 w-14' : 'h-full w-full'} />
    case 'shape':
      return <ShapeView cells={option.cells} unit={small ? 12 : 17} />
    case 'pattern':
      return <PatternView size={option.size} dots={option.dots} px={small ? 76 : 108} />
  }
}
