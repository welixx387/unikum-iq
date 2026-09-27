import { useId } from 'react'
import type { Figure, PaintIndex, ShapeKind } from '../../engine/types'

export const PAINT: Record<PaintIndex, string> = {
  0: 'rgb(var(--ink))',
  1: 'rgb(var(--cobalt))',
  2: 'rgb(var(--saffron))',
}

function polygon(n: number, r: number, start = -90): string {
  return Array.from({ length: n }, (_, i) => {
    const a = ((start + (360 / n) * i) * Math.PI) / 180
    return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`
  }).join(' ')
}

function star(r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 === 0 ? r : r * 0.45
    const a = ((-90 + 36 * i) * Math.PI) / 180
    return `${(rr * Math.cos(a)).toFixed(2)},${(rr * Math.sin(a)).toFixed(2)}`
  }).join(' ')
}

/** Путь фигуры радиуса r с центром в (0, 0). */
export function ShapePath({ kind, r, ...rest }: { kind: ShapeKind; r: number } & React.SVGProps<SVGElement>) {
  const p = rest as React.SVGProps<SVGPolygonElement>
  switch (kind) {
    case 'circle':
      return <circle r={r * 0.92} {...(rest as React.SVGProps<SVGCircleElement>)} />
    case 'square':
      return <rect x={-r * 0.8} y={-r * 0.8} width={r * 1.6} height={r * 1.6} rx={r * 0.08} {...(rest as React.SVGProps<SVGRectElement>)} />
    case 'triangle':
      return <polygon points={polygon(3, r * 1.05, -90)} transform={`translate(0 ${r * 0.14})`} {...p} />
    case 'diamond':
      return <polygon points={`0,${-r} ${r * 0.72},0 0,${r} ${-r * 0.72},0`} {...p} />
    case 'pentagon':
      return <polygon points={polygon(5, r, -90)} transform={`translate(0 ${r * 0.06})`} {...p} />
    case 'hexagon':
      return <polygon points={polygon(6, r * 0.95, -90)} {...p} />
    case 'star':
      return <polygon points={star(r * 1.05)} transform={`translate(0 ${r * 0.06})`} {...p} />
    case 'cross': {
      const w = r * 0.34
      const e = r * 0.9
      return (
        <polygon
          points={`${-w},${-e} ${w},${-e} ${w},${-w} ${e},${-w} ${e},${w} ${w},${w} ${w},${e} ${-w},${e} ${-w},${w} ${-e},${w} ${-e},${-w} ${-w},${-w}`}
          {...p}
        />
      )
    }
    case 'arrow':
      return (
        <polygon
          points={`0,${-r} ${r * 0.72},${-r * 0.08} ${r * 0.27},${-r * 0.08} ${r * 0.27},${r} ${-r * 0.27},${r} ${-r * 0.27},${-r * 0.08} ${-r * 0.72},${-r * 0.08}`}
          {...p}
        />
      )
  }
}

const LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [29, 50],
    [71, 50],
  ],
  3: [
    [50, 28],
    [28, 69],
    [72, 69],
  ],
  4: [
    [30, 30],
    [70, 30],
    [30, 70],
    [70, 70],
  ],
  5: [
    [25, 25],
    [75, 25],
    [50, 50],
    [25, 75],
    [75, 75],
  ],
  6: [
    [22, 33],
    [50, 33],
    [78, 33],
    [22, 67],
    [50, 67],
    [78, 67],
  ],
}

const BASE_R: Record<number, number> = { 1: 30, 2: 18, 3: 17, 4: 16.5, 5: 12.5, 6: 11.5 }
const SIZE_K = [0.58, 0.8, 1]

/** Клетка матрицы: одна или несколько одинаковых фигур. */
export function FigureCell({ figure, className = '' }: { figure: Figure; className?: string }) {
  const id = useId().replace(/:/g, '')
  const color = PAINT[figure.color]
  const r = BASE_R[figure.count] * SIZE_K[figure.size]
  const fill = figure.fill === 'solid' ? color : figure.fill === 'striped' ? `url(#h${id})` : 'none'
  const pos = LAYOUTS[figure.count] ?? LAYOUTS[1]
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-hidden="true">
      <defs>
        <pattern id={`h${id}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="none" />
          <line x1="0" y1="0" x2="0" y2="5" style={{ stroke: color }} strokeWidth="2.2" />
        </pattern>
      </defs>
      {pos.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${figure.rotation})`}>
          <ShapePath kind={figure.shape} r={r} style={{ fill, stroke: color }} strokeWidth={2.4} strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  )
}

export const SYMBOL_SHAPES: ShapeKind[] = ['circle', 'triangle', 'square', 'star', 'diamond', 'hexagon']
const SYMBOL_PAINT: PaintIndex[] = [1, 2, 0, 2, 1, 0]

export function SymbolIcon({ s, size = 34 }: { s: number; size?: number }) {
  const color = PAINT[SYMBOL_PAINT[s]]
  return (
    <svg viewBox="-20 -20 40 40" width={size} height={size} aria-hidden="true" className="shrink-0">
      <ShapePath kind={SYMBOL_SHAPES[s]} r={15} style={{ fill: color, stroke: color }} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}
