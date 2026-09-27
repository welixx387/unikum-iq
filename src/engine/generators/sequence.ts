import type { Generator, Level } from '../types'
import type { Rng } from '../rng'
import { attempt, formatNumber, numberOptions, signed } from '../util'

interface Rule {
  kind: string
  label: string
  terms: number[]
  explain: string
  /** Типичные ошибки для скрытого члена с индексом idx */
  wrongs: (idx: number) => number[]
  /** С какого индекса можно прятать член ряда (правило должно читаться по открытым) */
  hideFrom: number
}

const MAX_ABS = 99999
const POSITIVE_ONLY = new Set(['seq-linrec', 'seq-altops', 'seq-fib', 'seq-fibc', 'seq-geom', 'seq-geom-down'])

const scale = (n: number, boost: number) => Math.round(n * (1 + boost))

function seqFrom(first: number[], len: number, next: (prev: number[], i: number) => number): number[] {
  const out = first.slice()
  while (out.length < len) out.push(next(out, out.length))
  return out
}

const around = (x: number, d: number) => [x + 1, x - 1, x + d, x - d, x + 2, x + 2 * d]
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113]

function arith(rng: Rng, len: number, down: boolean, boost: number): Rule {
  const d = down ? -rng.int(3, scale(25, boost)) : rng.int(2, scale(25, boost))
  const a = down ? rng.int(-d * len, scale(400, boost)) : rng.int(1, scale(150, boost))
  const terms = seqFrom([a], len, (p) => p[p.length - 1] + d)
  return {
    kind: 'seq-arith',
    label: 'Арифметическая прогрессия',
    terms,
    explain: `Каждое число ${d > 0 ? 'больше' : 'меньше'} предыдущего на ${Math.abs(d)}.`,
    wrongs: (i) => around(terms[i], d),
    hideFrom: 2,
  }
}

function altSteps(rng: Rng, len: number, boost: number): Rule {
  const p = rng.int(1, scale(15, boost))
  let q = rng.int(1, scale(15, boost))
  if (q === p) q = p + 1
  const a = rng.int(1, scale(120, boost))
  const terms = seqFrom([a], len, (prev, i) => prev[i - 1] + (i % 2 === 1 ? p : q))
  return {
    kind: 'seq-altsteps',
    label: 'Два чередующихся шага',
    terms,
    explain: `Шаги чередуются: ${signed(p)}, ${signed(q)}, ${signed(p)}, ${signed(q)}…`,
    wrongs: (i) => {
      const prev = terms[i - 1]
      return [prev + (i % 2 === 1 ? q : p), terms[i] + 1, terms[i] - 1, prev + p + q, prev + Math.round((p + q) / 2)]
    },
    hideFrom: 3,
  }
}

function geom(rng: Rng, len: number, ratios: number[], boost: number): Rule {
  const r = rng.pick(ratios)
  const a = rng.int(1, scale(r === 2 ? 80 : r === 3 ? 30 : 12, boost))
  const terms = seqFrom([a], len, (p) => p[p.length - 1] * r)
  return {
    kind: 'seq-geom',
    label: 'Геометрическая прогрессия',
    terms,
    explain: `Каждое число в ${r} раза больше предыдущего.`,
    wrongs: (i) => {
      const x = terms[i]
      const prev = terms[i - 1]
      return [prev + (prev - terms[i - 2]), prev + prev, x + r, x - r, x * r, prev * (r + 1)]
    },
    hideFrom: 2,
  }
}

function geomDown(rng: Rng, len: number, boost: number): Rule {
  const r = rng.pick([2, 3])
  const m = rng.int(1, scale(r === 2 ? 150 : 60, boost))
  const terms = seqFrom([m * r ** (len - 1)], len, (p) => p[p.length - 1] / r)
  return {
    kind: 'seq-geom-down',
    label: 'Деление на постоянное число',
    terms,
    explain: `Каждое число в ${r} раза меньше предыдущего.`,
    wrongs: (i) => {
      const x = terms[i]
      return [x + 1, x - 1, x * r, x + r, Math.max(0, x - r), terms[i - 1] - x]
    },
    hideFrom: 2,
  }
}

function altPlusMinus(rng: Rng, len: number, boost: number): Rule {
  const p = rng.int(3, scale(20, boost))
  const q = rng.int(1, p - 1)
  const a = rng.int(5, scale(120, boost))
  const terms = seqFrom([a], len, (prev, i) => prev[i - 1] + (i % 2 === 1 ? p : -q))
  return {
    kind: 'seq-alt',
    label: 'Чередование действий',
    terms,
    explain: `Числа поочерёдно увеличиваются на ${p} и уменьшаются на ${q}.`,
    wrongs: (i) => {
      const prev = terms[i - 1]
      const x = terms[i]
      return [prev + (i % 2 === 1 ? -q : p), x + 1, x - 1, prev + p - q, x + q, x - p]
    },
    hideFrom: 3,
  }
}

function second(rng: Rng, len: number, level: Level, boost: number): Rule {
  const a = rng.int(1, scale(150, boost))
  const d0 = rng.int(1, scale(level <= 2 ? 9 : 15, boost))
  const k = level <= 2 ? rng.int(1, 2) : rng.int(1, scale(6, boost))
  const terms = seqFrom([a], len, (p, i) => p[i - 1] + d0 + (i - 1) * k)
  const diffs = terms.slice(1).map((t, i) => t - terms[i])
  return {
    kind: 'seq-second',
    label: 'Растущие разности',
    terms,
    explain: `Разности между соседними числами растут на ${k}: ${diffs.join(', ')}.`,
    wrongs: (i) => {
      const x = terms[i]
      const lastDiff = terms[i - 1] - terms[i - 2]
      return [terms[i - 1] + lastDiff, x + k, x - k, x + 1, x - 1, x + 2 * k]
    },
    hideFrom: 3,
  }
}

function squares(rng: Rng, len: number, boost: number): Rule {
  const n0 = rng.int(1, scale(25, boost))
  const c = rng.int(-20, 30)
  const terms = seqFrom([], len, (_, i) => (n0 + i) ** 2 + c)
  const tail = c === 0 ? '' : c > 0 ? ` плюс ${c}` : ` минус ${-c}`
  const L = len - 1
  return {
    kind: 'seq-squares',
    label: 'Квадраты чисел',
    terms,
    explain: `Это квадраты чисел ${n0}, ${n0 + 1}, ${n0 + 2}, …${tail}: например, ${n0 + L}² ${c === 0 ? '' : signed(c) + ' '}= ${terms[L]}.`,
    wrongs: (i) => {
      const x = terms[i]
      const lastDiff = terms[i - 1] - terms[i - 2]
      return [terms[i - 1] + lastDiff, x + 1, x - 1, (n0 + i + 1) ** 2 + c, x + 2, x - 2]
    },
    hideFrom: 3,
  }
}

function interleave(rng: Rng, len: number, level: Level, boost: number): Rule {
  const d1 = rng.int(2, scale(12, boost))
  let d2 = rng.int(-9, scale(12, boost))
  if (d2 === 0 || d2 === d1) d2 = -3
  const a1 = rng.int(1, scale(60, boost))
  const b1 = rng.int(20, scale(120, boost))
  const geomB = level >= 5
  const r = rng.pick([2, 3])
  const b0 = rng.int(1, 6)
  const terms = seqFrom([], len, (_, i) => {
    const j = Math.floor(i / 2)
    if (i % 2 === 0) return a1 + j * d1
    return geomB ? b0 * r ** j : b1 + j * d2
  })
  const odd = terms.filter((_, i) => i % 2 === 0)
  const even = terms.filter((_, i) => i % 2 === 1)
  return {
    kind: 'seq-interleave',
    label: 'Два чередующихся ряда',
    terms,
    explain: `Здесь два ряда вперемешку. На нечётных местах: ${odd.join(', ')} (каждый раз ${signed(d1)}). На чётных: ${even.join(', ')} (${geomB ? `каждый раз × ${r}` : `каждый раз ${signed(d2)}`}).`,
    wrongs: (i) => {
      const x = terms[i]
      const other = terms[i - 1]
      return [other + d1, x + 1, x - 1, terms[i - 1] + (terms[i - 1] - terms[i - 2]), x + d1, x - (geomB ? b0 : d2)]
    },
    hideFrom: 4,
  }
}

function fib(rng: Rng, len: number, withConst: boolean, boost: number): Rule {
  const x0 = rng.int(1, scale(30, boost))
  const x1 = rng.int(1, scale(40, boost))
  const c = withConst ? rng.int(1, 6) * rng.sign() : 0
  const terms = seqFrom([x0, x1], len, (p, i) => p[i - 1] + p[i - 2] + c)
  const L = len - 1
  return {
    kind: withConst ? 'seq-fibc' : 'seq-fib',
    label: withConst ? 'Сумма двух предыдущих со сдвигом' : 'Сумма двух предыдущих',
    terms,
    explain: withConst
      ? `Каждое число равно сумме двух предыдущих ${c > 0 ? 'плюс' : 'минус'} ${Math.abs(c)}: ${terms[L - 2]} + ${terms[L - 1]} ${signed(c)} = ${terms[L]}.`
      : `Каждое число равно сумме двух предыдущих: ${terms[L - 2]} + ${terms[L - 1]} = ${terms[L]}.`,
    wrongs: (i) => {
      const x = terms[i]
      const a = terms[i - 1]
      const b = terms[i - 2]
      return [a + (a - b), a * 2, x + 1, x - 1, a + b, x - c * 2, x + b]
    },
    hideFrom: 3,
  }
}

function linRec(rng: Rng, len: number, boost: number): Rule {
  const k = rng.pick([2, 3])
  let c = rng.int(-9, 9)
  if (c === 0) c = 1
  const x0 = rng.int(2, scale(20, boost))
  const terms = seqFrom([x0], len, (p, i) => p[i - 1] * k + c)
  const L = len - 1
  return {
    kind: 'seq-linrec',
    label: 'Умножение и сдвиг',
    terms,
    explain: `Каждое число — это предыдущее, умноженное на ${k}, ${c > 0 ? 'плюс' : 'минус'} ${Math.abs(c)}: ${terms[L - 1]} × ${k} ${signed(c)} = ${terms[L]}.`,
    wrongs: (i) => {
      const p = terms[i - 1]
      const x = terms[i]
      return [p * k, p * k + 2 * c, p * k - c, p + (p - terms[i - 2]), x + 1, x - 1]
    },
    hideFrom: 2,
  }
}

function altOps(rng: Rng, len: number, level: Level, boost: number): Rule {
  const p = rng.int(1, scale(20, boost))
  const q = rng.pick(level >= 5 ? [2, 3, 4] : [2, 3])
  const x0 = rng.int(1, scale(20, boost))
  const minus = level >= 5 && rng.chance(0.5)
  const mulFirst = rng.chance(0.5)
  const opA = (v: number) => (minus ? v * q : v + p)
  const opB = (v: number) => (minus ? v - p : v * q)
  const first = mulFirst ? opB : opA
  const then = mulFirst ? opA : opB
  const terms = seqFrom([x0], len, (prev, i) => (i % 2 === 1 ? first(prev[i - 1]) : then(prev[i - 1])))
  const txtA = minus ? `× ${q}` : `+ ${p}`
  const txtB = minus ? `− ${p}` : `× ${q}`
  return {
    kind: 'seq-altops',
    label: 'Чередование операций',
    terms,
    explain: `Действия чередуются: сначала ${mulFirst ? txtB : txtA}, затем ${mulFirst ? txtA : txtB}, и так далее.`,
    wrongs: (i) => {
      const prev = terms[i - 1]
      const x = terms[i]
      const swapped = i % 2 === 1 ? then(prev) : first(prev)
      return [swapped, x + 1, x - 1, prev + p + q, x + p, x * 2]
    },
    hideFrom: 3,
  }
}

function diffGeom(rng: Rng, len: number, boost: number): Rule {
  const a = rng.int(1, scale(99, boost))
  const d = rng.int(1, scale(9, boost))
  const r = rng.pick([2, 3])
  const terms = seqFrom([a], len, (p, i) => p[i - 1] + d * r ** (i - 1))
  const diffs = terms.slice(1).map((t, i) => t - terms[i])
  return {
    kind: 'seq-diffgeom',
    label: 'Разности-прогрессия',
    terms,
    explain: `Разности между соседними числами каждый раз умножаются на ${r}: ${diffs.join(', ')}.`,
    wrongs: (i) => {
      const x = terms[i]
      const lastDiff = terms[i - 1] - terms[i - 2]
      return [terms[i - 1] + lastDiff, terms[i - 1] + lastDiff + d, x + 1, x - 1, terms[i - 1] + lastDiff * (r + 1), x + d]
    },
    hideFrom: 3,
  }
}

function diffSquares(rng: Rng, len: number, boost: number): Rule {
  const a = rng.int(1, scale(99, boost))
  const s = rng.int(1, 4)
  const terms = seqFrom([a], len, (p, i) => p[i - 1] + (s + i - 1) ** 2)
  const diffs = terms.slice(1).map((t, i) => t - terms[i])
  return {
    kind: 'seq-diffsq',
    label: 'Разности — квадраты',
    terms,
    explain: `Разности между соседними числами — квадраты подряд идущих чисел: ${diffs.join(', ')}.`,
    wrongs: (i) => {
      const x = terms[i]
      const lastDiff = terms[i - 1] - terms[i - 2]
      return [terms[i - 1] + lastDiff, terms[i - 1] + lastDiff + 2, x + 1, x - 1, x + (s + i - 1), x - 2 * (s + i - 1) + 1]
    },
    hideFrom: 3,
  }
}

function primesShift(rng: Rng, len: number, boost: number): Rule {
  const i0 = rng.int(0, Math.min(PRIMES.length - len, 12 + boost * 4))
  const c = rng.int(-1, 25)
  const terms = PRIMES.slice(i0, i0 + len).map((p) => p + c)
  const plain = PRIMES.slice(i0, i0 + len)
  return {
    kind: 'seq-primes',
    label: 'Простые числа',
    terms,
    explain:
      c === 0
        ? `Это простые числа подряд: ${plain.join(', ')}.`
        : `Это простые числа подряд (${plain.join(', ')}), к каждому ${c > 0 ? 'прибавлено' : 'от каждого отнято'} ${Math.abs(c)}.`,
    wrongs: (i) => {
      const x = terms[i]
      return [x + 1, x - 1, x + 2, x - 2, terms[i - 1] + (terms[i - 1] - terms[i - 2]), x + 4]
    },
    hideFrom: 3,
  }
}

function trib(rng: Rng, len: number, boost: number): Rule {
  const s = [rng.int(0, scale(9, boost)), rng.int(1, scale(9, boost)), rng.int(1, scale(9, boost))]
  const terms = seqFrom(s, len, (p, i) => p[i - 1] + p[i - 2] + p[i - 3])
  const L = len - 1
  return {
    kind: 'seq-trib',
    label: 'Сумма трёх предыдущих',
    terms,
    explain: `Каждое число равно сумме трёх предыдущих: ${terms[L - 3]} + ${terms[L - 2]} + ${terms[L - 1]} = ${terms[L]}.`,
    wrongs: (i) => {
      const x = terms[i]
      return [terms[i - 1] + terms[i - 2], x + 1, x - 1, terms[i - 1] * 2, x + terms[i - 3], x - terms[i - 3] + 1]
    },
    hideFrom: 4,
  }
}

function cubes(rng: Rng, len: number, boost: number): Rule {
  const n0 = rng.int(1, scale(6, boost))
  const c = rng.int(-30, 30)
  const terms = seqFrom([], len, (_, i) => (n0 + i) ** 3 + c)
  const tail = c === 0 ? '' : c > 0 ? ` плюс ${c}` : ` минус ${-c}`
  const L = len - 1
  return {
    kind: 'seq-cubes',
    label: 'Кубы чисел',
    terms,
    explain: `Это кубы чисел ${n0}, ${n0 + 1}, ${n0 + 2}, …${tail}: ${n0 + L}³ ${c === 0 ? '' : signed(c) + ' '}= ${terms[L]}.`,
    wrongs: (i) => {
      const x = terms[i]
      const lastDiff = terms[i - 1] - terms[i - 2]
      return [terms[i - 1] + lastDiff, (n0 + i) ** 2 + c, x + 1, x - 1, x + (n0 + i), terms[i - 1] + lastDiff + 6]
    },
    hideFrom: 3,
  }
}

type Maker = (len: number) => Rule

function weighted(rng: Rng, items: [number, Maker][]): Maker {
  const total = items.reduce((s, [w]) => s + w, 0)
  let r = rng.next() * total
  for (const [w, m] of items) {
    r -= w
    if (r <= 0) return m
  }
  return items[items.length - 1][1]
}

function pickRule(rng: Rng, level: Level, boost: number): Rule {
  const len = rng.int(6, 8)
  const b = boost
  const table: Record<Level, [number, Maker][]> = {
    1: [
      [5, (n) => arith(rng, n, false, b)],
      [2, (n) => arith(rng, n, true, b)],
      [3, (n) => altSteps(rng, n, b)],
      [1, (n) => geom(rng, rng.int(5, 6), [2, 3], b)],
    ],
    2: [
      [3, (n) => arith(rng, n, true, b)],
      [3, (n) => altPlusMinus(rng, n, b)],
      [3, (n) => second(rng, n, level, b)],
      [1, (n) => geom(rng, rng.int(5, 6), [2, 3, 4], b)],
      [1, (n) => geomDown(rng, rng.int(5, 6), b)],
    ],
    3: [
      [3, (n) => second(rng, n, level, b)],
      [1, (n) => squares(rng, n, b)],
      [3, (n) => interleave(rng, Math.max(n, 7), level, b)],
      [2, (n) => fib(rng, n, false, b)],
    ],
    4: [
      [2, (n) => fib(rng, n, rng.chance(0.5), b)],
      [2, (n) => linRec(rng, Math.min(n, 6), b)],
      [2, (n) => altOps(rng, n, level, b)],
      [2, (n) => diffSquares(rng, n, b)],
      [1, (n) => primesShift(rng, n, b)],
      [2, (n) => interleave(rng, Math.max(n, 7), level, b)],
    ],
    5: [
      [2, (n) => diffGeom(rng, Math.min(n, 7), b)],
      [2, (n) => trib(rng, n, b)],
      [1, (n) => cubes(rng, Math.min(n, 6), b)],
      [2, (n) => altOps(rng, n, level, b)],
      [2, (n) => interleave(rng, Math.max(n, 7), level, b)],
      [2, (n) => fib(rng, n, true, b)],
      [1, (n) => primesShift(rng, n, b)],
    ],
  }
  return weighted(rng, table[level])(len)
}

export const sequenceGenerator: Generator = (rng, level, boost) =>
  attempt(() => {
    const rule = pickRule(rng, level, boost)
    const { terms } = rule
    if (terms.some((t) => !Number.isInteger(t) || Math.abs(t) > MAX_ABS)) return null
    if (new Set(terms).size < terms.length - 1) return null
    if (POSITIVE_ONLY.has(rule.kind) && terms.some((t, i) => t <= 0 || (i > 0 && t === terms[i - 1]))) return null
    const last = terms.length - 1
    const middleChance = level === 1 ? 0.15 : level <= 3 ? 0.3 : 0.4
    const hidden = rng.chance(middleChance) && rule.hideFrom < last ? rng.int(rule.hideFrom, last - 1) : last
    const x = terms[hidden]
    const { options, answer } = numberOptions(rng, x, rule.wrongs(hidden), 5, terms.some((t) => t < 0))
    const shown = terms.map((t, i) => (i === hidden ? null : formatNumber(t)))
    return {
      category: 'sequence',
      kind: rule.kind,
      kindLabel: rule.label,
      level,
      prompt: hidden === last ? 'Какое число продолжает ряд?' : 'Какое число пропущено в ряду?',
      visual: { type: 'sequence', items: shown },
      options,
      answer,
      explanation: `${rule.explain} Пропущено число ${formatNumber(x)}. Полный ряд: ${terms.map(formatNumber).join(', ')}.`,
      signature: `seq|${rule.kind}|${terms.join(',')}|${hidden}`,
    }
  })
