import type { Figure, FillKind, Generator, Level, PaintIndex, ShapeKind } from '../types'
import type { Rng } from '../rng'
import { attempt, buildOptions } from '../util'

type Attr = 'shape' | 'count' | 'size' | 'fill' | 'color' | 'rotation'
type RuleKind = 'global' | 'row' | 'column' | 'progression' | 'distribute' | 'sum' | 'diff'

const STATIC_SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'cross']
const FILLS: FillKind[] = ['outline', 'solid', 'striped']
const PAINTS: PaintIndex[] = [0, 1, 2]

export const SHAPE_NAMES: Record<ShapeKind, string> = {
  circle: 'круг',
  square: 'квадрат',
  triangle: 'треугольник',
  diamond: 'ромб',
  pentagon: 'пятиугольник',
  hexagon: 'шестиугольник',
  star: 'звезда',
  cross: 'крест',
  arrow: 'стрелка',
}
export const FILL_NAMES: Record<FillKind, string> = {
  outline: 'контур',
  solid: 'сплошная заливка',
  striped: 'штриховка',
}
export const SIZE_NAMES = ['мелкие', 'средние', 'крупные'] as const
export const PAINT_NAMES = ['нейтральный', 'синий', 'оранжевый'] as const

interface AttrRule {
  attr: Attr
  kind: RuleKind
  value: (r: number, c: number) => number | string
  explain: string
}

const latin = (vals: readonly (number | string)[], shift: number) => (r: number, c: number) => vals[(c + r * shift) % 3]

function makeRule(rng: Rng, attr: Attr, kind: RuleKind, level: Level): AttrRule | null {
  switch (attr) {
    case 'shape': {
      const vals = rng.sample(STATIC_SHAPES, 3)
      const names = vals.map((v) => SHAPE_NAMES[v]).join(', ')
      if (kind === 'global') return { attr, kind, value: () => vals[0], explain: '' }
      if (kind === 'row') return { attr, kind, value: (r) => vals[r], explain: 'В каждой строке все фигуры одной формы.' }
      if (kind === 'column')
        return { attr, kind, value: (_, c) => vals[c], explain: 'В каждом столбце фигуры одной формы.' }
      if (kind === 'distribute')
        return {
          attr,
          kind,
          value: latin(vals, rng.pick([1, 2])),
          explain: `В каждой строке по одному разу встречаются формы: ${names}.`,
        }
      return null
    }
    case 'count': {
      if (kind === 'global') {
        const n = rng.int(1, 3)
        return { attr, kind, value: () => n, explain: '' }
      }
      if (kind === 'row') {
        const vals = rng.sample([1, 2, 3, 4], 3)
        return { attr, kind, value: (r) => vals[r], explain: 'В каждой строке одинаковое число фигур.' }
      }
      if (kind === 'progression') {
        const step = rng.pick([1, -1]) * (level >= 5 && rng.chance(0.4) ? 2 : 1)
        const span = Math.abs(step) * 2
        const bases = [0, 1, 2].map(() => (step > 0 ? rng.int(1, 6 - span) : rng.int(1 + span, 6)))
        if (new Set(bases).size < 2) return null
        return {
          attr,
          kind,
          value: (r, c) => bases[r] + c * step,
          explain: `Слева направо число фигур ${step > 0 ? 'увеличивается' : 'уменьшается'} на ${Math.abs(step)}.`,
        }
      }
      if (kind === 'distribute') {
        const vals = rng.sample([1, 2, 3, 4, 5], 3).sort((a, b) => a - b)
        return {
          attr,
          kind,
          value: latin(rng.shuffle(vals), rng.pick([1, 2])),
          explain: `В каждой строке по одному разу встречаются количества ${vals.join(', ')}.`,
        }
      }
      if (kind === 'sum' || kind === 'diff') {
        const rows = [0, 1, 2].map(() => {
          if (kind === 'sum') {
            const a = rng.int(1, 4)
            const b = rng.int(1, 6 - a)
            return [a, b, a + b]
          }
          const b = rng.int(1, 3)
          const c = rng.int(1, 6 - b)
          return [b + c, b, c]
        })
        if (new Set(rows.map((x) => x.join())).size < 3) return null
        return {
          attr,
          kind,
          value: (r, c) => rows[r][c],
          explain:
            kind === 'sum'
              ? 'В каждой строке число фигур в третьей клетке равно сумме первых двух.'
              : 'В каждой строке число фигур в третьей клетке равно разности первых двух.',
        }
      }
      return null
    }
    case 'size': {
      if (kind === 'global') {
        const s = rng.int(1, 2)
        return { attr, kind, value: () => s, explain: '' }
      }
      if (kind === 'row') {
        const vals = rng.shuffle([0, 1, 2])
        return { attr, kind, value: (r) => vals[r], explain: 'В каждой строке фигуры одного размера.' }
      }
      if (kind === 'progression') {
        const up = rng.chance(0.5)
        return {
          attr,
          kind,
          value: (_, c) => (up ? c : 2 - c),
          explain: `Слева направо фигуры становятся ${up ? 'крупнее' : 'мельче'}.`,
        }
      }
      if (kind === 'distribute')
        return {
          attr,
          kind,
          value: latin(rng.shuffle([0, 1, 2]), rng.pick([1, 2])),
          explain: 'В каждой строке есть мелкие, средние и крупные фигуры — по одному разу.',
        }
      return null
    }
    case 'fill': {
      const vals = rng.shuffle(FILLS)
      if (kind === 'global') return { attr, kind, value: () => vals[0], explain: '' }
      if (kind === 'row') return { attr, kind, value: (r) => vals[r], explain: 'В каждой строке одинаковая заливка.' }
      if (kind === 'column')
        return { attr, kind, value: (_, c) => vals[c], explain: 'В каждом столбце одинаковая заливка.' }
      if (kind === 'distribute')
        return {
          attr,
          kind,
          value: latin(vals, rng.pick([1, 2])),
          explain: 'В каждой строке по одному разу встречаются контур, сплошная заливка и штриховка.',
        }
      return null
    }
    case 'color': {
      const vals = rng.shuffle(PAINTS)
      if (kind === 'global') return { attr, kind, value: () => vals[0], explain: '' }
      if (kind === 'row') return { attr, kind, value: (r) => vals[r], explain: 'В каждой строке фигуры одного цвета.' }
      if (kind === 'column')
        return { attr, kind, value: (_, c) => vals[c], explain: 'В каждом столбце фигуры одного цвета.' }
      if (kind === 'distribute')
        return {
          attr,
          kind,
          value: latin(vals, rng.pick([1, 2])),
          explain: 'В каждой строке по одному разу встречаются нейтральный, синий и оранжевый цвет.',
        }
      return null
    }
    case 'rotation': {
      if (kind === 'global') return { attr, kind, value: () => 0, explain: '' }
      if (kind === 'progression') {
        const step = rng.pick([45, 90]) * rng.pick([1, -1])
        const starts = rng.sample([0, 45, 90, 135, 180, 225, 270, 315], 3)
        return {
          attr,
          kind,
          value: (r, c) => (((starts[r] + c * step) % 360) + 360) % 360,
          explain: `Слева направо стрелка каждый раз поворачивается на ${Math.abs(step)}° ${step > 0 ? 'по часовой стрелке' : 'против часовой стрелки'}.`,
        }
      }
      if (kind === 'distribute') {
        const vals = rng.sample([0, 45, 90, 135, 180, 225, 270, 315], 3)
        return {
          attr,
          kind,
          value: latin(vals, rng.pick([1, 2])),
          explain: 'В каждой строке стрелка по одному разу смотрит в три разных направления.',
        }
      }
      return null
    }
  }
}

interface Plan {
  informative: [Attr, RuleKind][]
}

function planFor(rng: Rng, level: Level): Plan {
  switch (level) {
    case 1: {
      const main = rng.pick<[Attr, RuleKind]>([
        ['count', 'progression'],
        ['shape', 'distribute'],
        ['size', 'progression'],
        ['fill', 'distribute'],
      ])
      const extra: [Attr, RuleKind] = main[0] === 'shape' ? ['color', 'row'] : ['shape', 'row']
      return { informative: [main, extra] }
    }
    case 2:
      return {
        informative: rng.pick<[Attr, RuleKind][]>([
          [['shape', 'distribute'], ['count', 'progression']],
          [['shape', 'distribute'], ['fill', 'row']],
          [['count', 'distribute'], ['shape', 'row']],
          [['fill', 'distribute'], ['size', 'progression']],
          [['color', 'distribute'], ['shape', 'column']],
          [['shape', 'distribute'], ['size', 'progression']],
        ]),
      }
    case 3:
      return {
        informative: rng.pick<[Attr, RuleKind][]>([
          [['shape', 'distribute'], ['fill', 'distribute'], ['count', 'row']],
          [['shape', 'distribute'], ['count', 'progression'], ['color', 'column']],
          [['rotation', 'progression'], ['fill', 'row']],
          [['count', 'distribute'], ['fill', 'distribute'], ['size', 'row']],
          [['shape', 'row'], ['color', 'distribute'], ['size', 'progression']],
        ]),
      }
    case 4:
      return {
        informative: rng.pick<[Attr, RuleKind][]>([
          [['count', 'sum'], ['shape', 'distribute'], ['fill', 'row']],
          [['rotation', 'progression'], ['fill', 'distribute'], ['count', 'row']],
          [['shape', 'distribute'], ['fill', 'distribute'], ['color', 'distribute']],
          [['count', 'progression'], ['shape', 'distribute'], ['fill', 'distribute']],
          [['rotation', 'distribute'], ['color', 'distribute'], ['size', 'progression']],
        ]),
      }
    default:
      return {
        informative: rng.pick<[Attr, RuleKind][]>([
          [['count', 'sum'], ['shape', 'distribute'], ['fill', 'distribute'], ['color', 'row']],
          [['count', 'diff'], ['shape', 'distribute'], ['color', 'distribute'], ['size', 'row']],
          [['rotation', 'progression'], ['fill', 'distribute'], ['color', 'distribute'], ['count', 'row']],
          [['shape', 'distribute'], ['fill', 'distribute'], ['color', 'distribute'], ['size', 'progression']],
          [['count', 'progression'], ['shape', 'distribute'], ['fill', 'distribute'], ['color', 'distribute']],
        ]),
      }
  }
}

export function figureKey(f: Figure): string {
  return `${f.shape}.${f.count}.${f.size}.${f.fill}.${f.color}.${f.rotation}`
}

export function describeFigure(f: Figure): string {
  const parts = [`${SHAPE_NAMES[f.shape]} × ${f.count}`, FILL_NAMES[f.fill], SIZE_NAMES[f.size], PAINT_NAMES[f.color]]
  if (f.shape === 'arrow') parts.push(`поворот ${f.rotation}°`)
  return parts.join(', ')
}

const ALL_ATTRS: Attr[] = ['shape', 'count', 'size', 'fill', 'color', 'rotation']

function variantsOf(f: Figure, attr: Attr, used: Set<ShapeKind>, rng: Rng): Figure[] {
  switch (attr) {
    case 'shape': {
      if (f.shape === 'arrow') return []
      const pool = [...used, rng.pick(STATIC_SHAPES)].filter((s) => s !== f.shape && s !== 'arrow')
      return pool.map((shape) => ({ ...f, shape }))
    }
    case 'count':
      return [f.count + 1, f.count - 1, f.count + 2].filter((n) => n >= 1 && n <= 6).map((count) => ({ ...f, count }))
    case 'size':
      return ([0, 1, 2] as const).filter((s) => s !== f.size).map((size) => ({ ...f, size }))
    case 'fill':
      return FILLS.filter((x) => x !== f.fill).map((fill) => ({ ...f, fill }))
    case 'color':
      return PAINTS.filter((x) => x !== f.color).map((color) => ({ ...f, color }))
    case 'rotation':
      if (f.shape !== 'arrow') return []
      return [45, 90, 180, 270].map((d) => ({ ...f, rotation: (f.rotation + d) % 360 }))
  }
}

export const matrixGenerator: Generator = (rng, level) =>
  attempt(() => {
    const plan = planFor(rng, level)
    const rules = new Map<Attr, AttrRule>()
    for (const [attr, kind] of plan.informative) {
      const rule = makeRule(rng, attr, kind, level)
      if (!rule) return null
      rules.set(attr, rule)
    }
    if (level <= 2 && rng.chance(0.5)) {
      const free = (['color', 'fill', 'size'] as Attr[]).filter((a) => !rules.has(a))
      if (free.length) {
        const attr = rng.pick(free)
        const rule = makeRule(rng, attr, 'row', level)
        if (rule) {
          rules.set(attr, rule)
          plan.informative.push([attr, 'row'])
        }
      }
    }
    const hasRotation = rules.has('rotation')
    if (hasRotation) {
      rules.set('shape', { attr: 'shape', kind: 'global', value: () => 'arrow', explain: '' })
    }
    for (const attr of ALL_ATTRS) {
      if (!rules.has(attr)) rules.set(attr, makeRule(rng, attr, 'global', level)!)
    }
    const cells: Figure[] = []
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const v = (a: Attr) => rules.get(a)!.value(r, c)
        cells.push({
          shape: v('shape') as ShapeKind,
          count: v('count') as number,
          size: v('size') as 0 | 1 | 2,
          fill: v('fill') as FillKind,
          color: v('color') as PaintIndex,
          rotation: v('rotation') as number,
        })
      }
    }
    if (new Set(cells.map(figureKey)).size < 6) return null
    const correct = cells[8]
    const used = new Set(cells.map((c) => c.shape))
    const informativeAttrs = plan.informative.map(([a]) => a)
    const primary: Figure[] = []
    for (const a of informativeAttrs) primary.push(...variantsOf(correct, a, used, rng))
    const secondary: Figure[] = []
    for (const a of ALL_ATTRS.filter((x) => !informativeAttrs.includes(x))) secondary.push(...variantsOf(correct, a, used, rng).slice(0, 1))
    secondary.push(cells[5], cells[7])
    const total = level <= 2 ? 6 : 8
    const nearCount = level >= 4 ? total - 1 : Math.ceil((total - 1) / 2)
    const candidates = [...rng.shuffle(primary).slice(0, nearCount), ...rng.shuffle(secondary), ...rng.shuffle(primary)]
    const doubleChange = () => {
      const [a1, a2] = rng.sample(informativeAttrs.length > 1 ? informativeAttrs : ALL_ATTRS, 2)
      const first = rng.pick(variantsOf(correct, a1, used, rng).concat([correct]))
      const opts = variantsOf(first, a2, used, rng)
      return opts.length ? rng.pick(opts) : first
    }
    const { options, answer } = buildOptions(
      { ...rng, shuffle: <T>(x: readonly T[]) => x.slice() },
      correct,
      candidates,
      total,
      figureKey,
      (figure) => ({ type: 'figure', figure }),
      doubleChange,
    )
    if (options.length < total) return null
    // buildOptions выше не перемешивал — перемешаем здесь.
    const order = rng.shuffle(options.map((_, i) => i))
    const shuffled = order.map((i) => options[i])
    const explainLines = [...rules.values()].map((r) => r.explain).filter(Boolean)
    return {
      category: 'matrix',
      kind: `mx-${plan.informative.map(([a, k]) => `${a}:${k}`).join('+')}`,
      kindLabel: plan.informative.length >= 4 ? 'Матрица из четырёх правил' : `Матрица (${plan.informative.length} ${plan.informative.length === 1 ? 'правило' : 'правила'})`,
      level,
      prompt: 'Какая фигура должна стоять на месте знака вопроса?',
      visual: { type: 'matrix', cells: [...cells.slice(0, 8), null] },
      options: shuffled,
      answer: order.indexOf(answer),
      explanation: `${explainLines.join(' ')} Поэтому в пустой клетке: ${describeFigure(correct)}.`,
      signature: `mx|${cells.map(figureKey).join('|')}`,
    }
  })
