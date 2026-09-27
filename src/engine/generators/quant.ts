import type { EqToken, Generator, Level, TaskDraft } from '../types'
import type { Rng } from '../rng'
import { buildOptions, firstThatWorks, formatNumber, numberOptions, plural } from '../util'
import { NAMES_F, NAMES_M } from '../words'

const grow = (n: number, boost: number) => Math.round(n * (1 + boost))
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

// ── Числовая таблица ────────────────────────────────────────────────────

interface GridRule {
  id: string
  level: Level
  f: (a: number, b: number, k: number) => number
  ks: number[]
  text: (k: number) => string
  sample: (a: number, b: number, c: number, k: number) => string
}

const GRID_RULES: GridRule[] = [
  { id: 'sum', level: 1, f: (a, b) => a + b, ks: [0], text: () => 'третье число равно сумме первых двух', sample: (a, b, c) => `${a} + ${b} = ${c}` },
  { id: 'diff', level: 2, f: (a, b) => a - b, ks: [0], text: () => 'третье число равно разности первых двух', sample: (a, b, c) => `${a} − ${b} = ${c}` },
  { id: 'prod', level: 2, f: (a, b) => a * b, ks: [0], text: () => 'третье число равно произведению первых двух', sample: (a, b, c) => `${a} × ${b} = ${c}` },
  { id: 'prodk', level: 3, f: (a, b, k) => a * b + k, ks: [-3, -2, -1, 1, 2, 3, 4, 5], text: (k) => `третье число равно произведению первых двух ${k > 0 ? 'плюс' : 'минус'} ${Math.abs(k)}`, sample: (a, b, c, k) => `${a} × ${b} ${k > 0 ? '+' : '−'} ${Math.abs(k)} = ${c}` },
  { id: 'sumk', level: 3, f: (a, b, k) => (a + b) * k, ks: [2, 3, 4], text: (k) => `третье число — это сумма первых двух, умноженная на ${k}`, sample: (a, b, c, k) => `(${a} + ${b}) × ${k} = ${c}` },
  { id: 'sqminus', level: 4, f: (a, b) => a * a - b, ks: [0], text: () => 'третье число — квадрат первого минус второе', sample: (a, b, c) => `${a}² − ${b} = ${c}` },
  { id: 'prodminus', level: 4, f: (a, b) => a * b - a - b, ks: [0], text: () => 'третье число — произведение первых двух минус их сумма', sample: (a, b, c) => `${a} × ${b} − (${a} + ${b}) = ${c}` },
  { id: 'sqsum', level: 5, f: (a, b) => a * a + b * b, ks: [0], text: () => 'третье число — сумма квадратов первых двух', sample: (a, b, c) => `${a}² + ${b}² = ${c}` },
  { id: 'sqdiff', level: 5, f: (a, b) => (a + b) * (a - b), ks: [0], text: () => 'третье число — разность квадратов первых двух', sample: (a, b, c) => `${a}² − ${b}² = ${c}` },
]

function numberGrid(rng: Rng, level: Level, boost: number): TaskDraft | null {
  const pool = GRID_RULES.filter((r) => r.level === level || (level >= 4 && r.level === level - 1))
  const rule = rng.pick(pool)
  const k = rng.pick(rule.ks)
  const big = rule.id === 'sum' || rule.id === 'diff' || rule.id === 'sumk'
  const hi = grow(big ? 40 : 12, boost)
  const rows: number[][] = []
  for (let r = 0; r < 3; r++) {
    const a = rng.int(2, hi)
    const b = rng.int(1, rule.id === 'diff' || rule.id === 'sqdiff' ? a - 1 : hi)
    const c = rule.f(a, b, k)
    if (c < 0 || c > 9999 || b < 1) return null
    rows.push([a, b, c])
  }
  if (new Set(rows.map((r) => r.join())).size < 3) return null
  const hiddenCol = level >= 4 && rng.chance(0.5) ? rng.int(0, 1) : 2
  const x = rows[2][hiddenCol]
  // Ответ должен определяться единственным образом по правилу.
  let solutions = 0
  for (let v = 0; v <= 10000 && solutions < 2; v++) {
    const t = rows[2].slice()
    t[hiddenCol] = v
    if (rule.f(t[0], t[1], k) === t[2]) solutions++
  }
  if (solutions !== 1) return null
  // Никакое другое простое правило не должно объяснять первые две строки иначе.
  for (const alt of GRID_RULES) {
    for (const ak of alt.ks) {
      if (alt.id === rule.id && ak === k) continue
      if (!rows.slice(0, 2).every(([a, b, c]) => alt.f(a, b, ak) === c)) continue
      const t = rows[2].slice()
      for (let v = 0; v <= 10000; v++) {
        t[hiddenCol] = v
        if (alt.f(t[0], t[1], ak) === t[2] && v !== x) return null
      }
    }
  }
  const byColumns = level >= 4 && rng.chance(0.5)
  const cells: (number | null)[] = Array(9).fill(null)
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const v = r === 2 && c === hiddenCol ? null : rows[r][c]
      cells[byColumns ? c * 3 + r : r * 3 + c] = v
    }
  const [a0, b0, c0] = rows[0]
  const wrongs = [x + 1, x - 1, x + k, x + rows[2][0], x - rows[2][1], x * 2, x + 10]
  const { options, answer } = numberOptions(rng, x, wrongs, 5)
  const where = byColumns ? 'каждом столбце (сверху вниз)' : 'каждой строке (слева направо)'
  return {
    category: 'quant',
    kind: `qt-grid-${rule.id}`,
    kindLabel: 'Числовая таблица',
    level,
    prompt: 'Числа в таблице подчиняются одному правилу. Какое число пропущено?',
    visual: { type: 'numberGrid', cells },
    options,
    answer,
    explanation: `В ${where} ${rule.text(k)}: например, ${rule.sample(a0, b0, c0, k)}. Значит, пропущено число ${x}: ${rule.sample(rows[2][0], rows[2][1], rows[2][2], k)}.`,
    signature: `qt-grid|${rule.id}|${k}|${byColumns}|${cells.map((c) => c ?? '?').join(',')}`,
  }
}

// ── Уравнения с символами ───────────────────────────────────────────────

type Expr = (number | '+' | '−' | '×')[]

function evalExpr(expr: Expr, vals: number[]): number {
  // Сначала умножение, потом сложение и вычитание — как в обычной записи.
  const terms: (number | string)[] = []
  for (let i = 0; i < expr.length; i++) {
    const tok = expr[i]
    if (tok === '×') {
      const prev = terms.pop() as number
      const next = vals[expr[++i] as number]
      terms.push(prev * next)
    } else if (typeof tok === 'number') terms.push(vals[tok])
    else terms.push(tok)
  }
  let acc = terms[0] as number
  for (let i = 1; i < terms.length; i += 2) acc = terms[i] === '+' ? acc + (terms[i + 1] as number) : acc - (terms[i + 1] as number)
  return acc
}

interface EqPlan {
  vars: number
  lines: Expr[]
  question: Expr
  steps: (v: number[], sym: string[]) => string
}

const S = (i: number, sym: string[]) => sym[i]

const EQ_PLANS: Record<Level, EqPlan[]> = {
  1: [
    { vars: 2, lines: [[0, '+', 0], [0, '+', 1]], question: [1], steps: (v, s) => `${S(0, s)} = ${v[0]}, значит ${S(1, s)} = ${v[0] + v[1]} − ${v[0]} = ${v[1]}.` },
    { vars: 2, lines: [[0, '+', 0, '+', 0], [1, '−', 0]], question: [1], steps: (v, s) => `${S(0, s)} = ${v[0]}, значит ${S(1, s)} = ${v[1] - v[0]} + ${v[0]} = ${v[1]}.` },
  ],
  2: [
    { vars: 2, lines: [[0, '+', 0, '+', 0], [0, '+', 1]], question: [1, '−', 0], steps: (v, s) => `${S(0, s)} = ${v[0]}, ${S(1, s)} = ${v[1]}.` },
    { vars: 2, lines: [[0, '+', 0], [1, '−', 0]], question: [0, '×', 1], steps: (v, s) => `${S(0, s)} = ${v[0]}, ${S(1, s)} = ${v[1]}.` },
  ],
  3: [
    { vars: 3, lines: [[0, '+', 0], [0, '+', 1], [1, '+', 2]], question: [0, '+', 1, '+', 2], steps: (v, s) => `${S(0, s)} = ${v[0]}, ${S(1, s)} = ${v[1]}, ${S(2, s)} = ${v[2]}.` },
    { vars: 3, lines: [[0, '×', 0], [0, '+', 1], [2, '−', 1]], question: [2, '+', 0], steps: (v, s) => `${S(0, s)} = ${v[0]}, ${S(1, s)} = ${v[1]}, ${S(2, s)} = ${v[2]}.` },
  ],
  4: [
    { vars: 3, lines: [[0, '+', 0, '+', 0], [0, '×', 1], [1, '−', 2]], question: [0, '+', 1, '+', 2], steps: (v, s) => `${S(0, s)} = ${v[0]}, ${S(1, s)} = ${v[1]}, ${S(2, s)} = ${v[2]}.` },
    { vars: 3, lines: [[0, '+', 1], [0, '−', 1], [2, '+', 2, '+', 0]], question: [2, '×', 1], steps: (v, s) => `${S(0, s)} = ${v[0]}, ${S(1, s)} = ${v[1]}, ${S(2, s)} = ${v[2]}.` },
  ],
  5: [
    { vars: 3, lines: [[0, '+', 1], [1, '+', 2], [0, '+', 2]], question: [0, '×', 1, '−', 2], steps: (v, s) => `Сложив все три равенства, получаем 2 × (${S(0, s)} + ${S(1, s)} + ${S(2, s)}) = ${2 * (v[0] + v[1] + v[2])}. Отсюда ${S(0, s)} = ${v[0]}, ${S(1, s)} = ${v[1]}, ${S(2, s)} = ${v[2]}.` },
    { vars: 3, lines: [[0, '×', 1], [0, '−', 1], [2, '+', 0]], question: [2, '×', 1, '−', 0], steps: (v, s) => `Два числа с разностью ${v[0] - v[1]} и произведением ${v[0] * v[1]} — это ${v[0]} и ${v[1]}, значит ${S(0, s)} = ${v[0]}, ${S(1, s)} = ${v[1]}. Из третьего равенства ${S(2, s)} = ${v[2]}.` },
  ],
}

export const SYMBOL_NAMES = ['круг', 'треугольник', 'квадрат', 'звезда', 'ромб', 'шестиугольник']

function toTokens(expr: Expr, sym: number[]): EqToken[] {
  return expr.map((t) => (typeof t === 'number' ? { t: 'sym', s: sym[t] } : { t: 'op', v: t }))
}

function exprText(expr: Expr, names: string[]) {
  return expr.map((t) => (typeof t === 'number' ? names[t] : t)).join(' ')
}

function symbolEquations(rng: Rng, level: Level, boost: number): TaskDraft | null {
  const plan = rng.pick(EQ_PLANS[level])
  const hi = grow(level <= 2 ? 80 : level === 3 ? 30 : 25, boost)
  const vals = Array.from({ length: plan.vars }, () => rng.int(2, hi))
  if (new Set(vals).size < vals.length) return null
  const results = plan.lines.map((l) => evalExpr(l, vals))
  if (results.some((r) => r <= 0 || r > 999)) return null
  // Все планы решаются последовательно и однозначно для положительных чисел.
  const answerValue = evalExpr(plan.question, vals)
  if (answerValue < 0) return null
  const sym = rng.sample([0, 1, 2, 3, 4, 5], plan.vars)
  const symNames = sym.map((i) => SYMBOL_NAMES[i])
  const lines: EqToken[][] = plan.lines.map((l, j) => [...toTokens(l, sym), { t: 'op', v: '=' }, { t: 'num', v: results[j] }])
  lines.push([...toTokens(plan.question, sym), { t: 'op', v: '=' }, { t: 'q' }])
  const wrongs = [answerValue + 1, answerValue - 1, answerValue + vals[0], answerValue - vals[0], answerValue + 2, ...vals]
  const { options, answer } = numberOptions(rng, answerValue, wrongs, 5)
  return {
    category: 'quant',
    kind: `qt-eq-${level}`,
    kindLabel: 'Уравнения с символами',
    level,
    prompt: 'Одинаковые символы означают одинаковые числа. Чему равно выражение в последней строке?',
    visual: { type: 'equations', lines },
    options,
    answer,
    explanation: `${plan.steps(vals, symNames)} Тогда ${exprText(plan.question, symNames)} = ${answerValue}.`,
    signature: `qt-eq|${EQ_PLANS[level].indexOf(plan)}|${level}|${vals.join(',')}`,
  }
}

// ── Лишнее число ────────────────────────────────────────────────────────

const isPrime = (n: number) => {
  if (n < 2) return false
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false
  return true
}
const isSquare = (n: number) => Number.isInteger(Math.sqrt(n))
const isCube = (n: number) => Math.round(Math.cbrt(n)) ** 3 === n
const digitSum = (n: number) => [...String(n)].reduce((s, d) => s + Number(d), 0)
const isPalindrome = (n: number) => String(n) === [...String(n)].reverse().join('')

interface Property {
  id: string
  test: (n: number) => boolean
  text: string
  why: (n: number) => string
}

const mult = (k: number): Property => ({
  id: `mult${k}`,
  test: (n) => n % k === 0,
  text: `делятся на ${k}`,
  why: (n) => `${n} = ${k} × ${n / k}`,
})

const ALT_PROPS: Property[] = [
  mult(2),
  mult(3),
  mult(4),
  mult(5),
  mult(6),
  mult(7),
  mult(8),
  mult(9),
  mult(10),
  mult(11),
  mult(12),
  mult(13),
  { id: 'square', test: isSquare, text: 'являются квадратами целых чисел', why: (n) => `${n} = ${Math.sqrt(n)}²` },
  { id: 'prime', test: isPrime, text: 'простые (делятся только на 1 и на себя)', why: (n) => `${n}` },
  { id: 'cube', test: isCube, text: 'являются кубами целых чисел', why: (n) => `${n} = ${Math.round(Math.cbrt(n))}³` },
  { id: 'palindrome', test: isPalindrome, text: 'читаются одинаково слева направо и справа налево', why: (n) => `${n}` },
]

function oddOne(rng: Rng, level: Level, boost: number): TaskDraft | null {
  const hi = grow(level <= 2 ? 150 : 400, boost)
  let prop: Property
  let members: number[] = []
  let odd: number
  const pickMembers = (gen: () => number, count = 4) => {
    const s = new Set<number>()
    let guard = 0
    while (s.size < count && guard++ < 200) s.add(gen())
    return [...s]
  }
  switch (level) {
    case 1: {
      const k = rng.pick([5, 10, 2])
      prop = mult(k)
      members = pickMembers(() => k * rng.int(2, Math.floor(hi / k)))
      odd = k * rng.int(2, Math.floor(hi / k)) + rng.int(1, k - 1)
      break
    }
    case 2: {
      const k = rng.pick([3, 4, 6, 7, 8, 9])
      prop = mult(k)
      members = pickMembers(() => k * rng.int(2, Math.floor(hi / k)))
      odd = k * rng.int(2, Math.floor(hi / k)) + rng.int(1, k - 1)
      break
    }
    case 3: {
      if (rng.chance(0.5)) {
        prop = ALT_PROPS.find((p) => p.id === 'square')!
        members = pickMembers(() => rng.int(3, Math.floor(Math.sqrt(hi))) ** 2)
        const base = rng.int(4, Math.floor(Math.sqrt(hi)))
        odd = base * base + rng.pick([-2, -1, 1, 2, 3])
      } else {
        const s = rng.int(7, 14)
        prop = { id: `ds${s}`, test: (n) => digitSum(n) === s, text: `имеют сумму цифр ${s}`, why: (n) => `${[...String(n)].join(' + ')} = ${s}` }
        members = pickMembers(() => {
          for (;;) {
            const n = rng.int(10, hi)
            if (digitSum(n) === s) return n
          }
        })
        odd = (() => {
          for (;;) {
            const n = rng.int(10, hi)
            const d = digitSum(n)
            if (Math.abs(d - s) === 1) return n
          }
        })()
      }
      break
    }
    case 4: {
      if (rng.chance(0.5)) {
        prop = ALT_PROPS.find((p) => p.id === 'prime')!
        members = pickMembers(() => {
          for (;;) {
            const n = rng.int(20, hi)
            if (isPrime(n)) return n
          }
        })
        // Коварное составное число: нечётное, не делится на 3 и 5.
        odd = (() => {
          for (;;) {
            const n = rng.int(40, hi)
            if (!isPrime(n) && n % 2 && n % 3 && n % 5) return n
          }
        })()
      } else {
        const k = rng.pick([11, 12, 13, 15, 17])
        prop = mult(k)
        members = pickMembers(() => k * rng.int(3, Math.floor(hi / k)))
        odd = k * rng.int(3, Math.floor(hi / k)) + rng.pick([-1, 1, 2, -2])
      }
      break
    }
    default: {
      const which = rng.pick(['palindrome', 'cube', 'prime'])
      if (which === 'palindrome') {
        prop = ALT_PROPS.find((p) => p.id === 'palindrome')!
        members = pickMembers(() => {
          const a = rng.int(1, 9)
          const b = rng.int(0, 9)
          return rng.chance(0.5) ? a * 101 + b * 10 : a * 1001 + b * 110
        })
        const a = rng.int(1, 9)
        const b = rng.int(0, 9)
        odd = a * 100 + b * 10 + ((a + rng.int(1, 8)) % 10)
      } else if (which === 'cube') {
        prop = ALT_PROPS.find((p) => p.id === 'cube')!
        members = pickMembers(() => rng.int(2, 12 + boost * 4) ** 3)
        odd = rng.int(3, 12) ** 3 + rng.pick([-1, 1, 3, -3])
      } else {
        prop = ALT_PROPS.find((p) => p.id === 'prime')!
        members = pickMembers(() => {
          for (;;) {
            const n = rng.int(100, grow(600, boost))
            if (isPrime(n)) return n
          }
        })
        odd = (() => {
          for (;;) {
            const n = rng.int(100, grow(600, boost))
            if (!isPrime(n) && n % 2 && n % 3 && n % 5 && n % 7) return n
          }
        })()
      }
    }
  }
  if (members.length < 4 || members.includes(odd) || prop.test(odd) || odd < 2) return null
  if (!members.every(prop.test)) return null
  const all = [...members, odd]
  // Проверка на двусмысленность: никакое другое свойство не должно выделять другое число.
  for (const alt of ALT_PROPS) {
    if (alt.id === prop.id) continue
    const yes = all.filter(alt.test)
    const no = all.filter((n) => !alt.test(n))
    const single = yes.length === 1 ? yes[0] : no.length === 1 ? no[0] : null
    if (single !== null && single !== odd) return null
  }
  const { options, answer } = buildOptions(
    rng,
    odd,
    members,
    5,
    (v) => String(v),
    (v) => ({ type: 'text', value: formatNumber(v) }),
  )
  return {
    category: 'quant',
    kind: `qt-odd-${prop.id.replace(/\d+/g, '')}`,
    kindLabel: 'Лишнее число',
    level,
    prompt: 'Какое число лишнее?',
    options,
    answer,
    explanation: `Все числа, кроме ${odd}, ${prop.text}: ${members.map(prop.why).join('; ')}. Число ${odd} этим свойством не обладает.`,
    signature: `qt-odd|${prop.id}|${all.slice().sort((a, b) => a - b).join(',')}`,
  }
}

// ── Текстовые задачи ────────────────────────────────────────────────────

function wordProblem(rng: Rng, level: Level, boost: number): TaskDraft | null {
  const t =
    level <= 2
      ? rng.pick(['work', 'meet'])
      : level === 3
        ? rng.pick(['work', 'age', 'meet', 'shop'])
        : rng.pick(['age', 'percent', 'joint', 'shop'])
  let prompt = ''
  let x = 0
  let explanation = ''
  let wrongs: number[] = []
  let sig = ''
  switch (t) {
    case 'work': {
      const a = rng.int(2, grow(9, boost))
      const time = rng.pick([2, 3, 4, 5, 6, 10])
      const perUnit = rng.int(1, 6)
      const b = a * perUnit * time
      const m = rng.int(2, grow(15, boost))
      const s = time * rng.int(2, 6)
      x = perUnit * m * s
      prompt = `${a} ${plural(a, 'станок', 'станка', 'станков')} за ${time} мин изготавливают ${b} ${plural(b, 'деталь', 'детали', 'деталей')}. Сколько деталей изготовят ${m} ${plural(m, 'станок', 'станка', 'станков')} за ${s} мин, если работают с той же скоростью?`
      explanation = `Один станок за одну минуту делает ${b} : ${a} : ${time} = ${perUnit} ${plural(perUnit, 'деталь', 'детали', 'деталей')}. Тогда ${m} × ${s} × ${perUnit} = ${x}.`
      wrongs = [b * m / a, b * s / time, x + perUnit, x - perUnit * m, (b / a) * m, x * 2]
      sig = `work|${a}|${time}|${b}|${m}|${s}`
      break
    }
    case 'meet': {
      const v1 = rng.int(4, grow(18, boost)) * 5
      const v2 = rng.int(4, grow(18, boost)) * 5
      const h = rng.int(2, 7)
      const d = (v1 + v2) * h
      x = h
      prompt = `Из двух городов, расстояние между которыми ${d} км, одновременно навстречу друг другу выехали два автомобиля. Скорость первого — ${v1} км/ч, второго — ${v2} км/ч. Через сколько часов они встретятся?`
      explanation = `Каждый час расстояние между автомобилями сокращается на ${v1} + ${v2} = ${v1 + v2} км. ${d} : ${v1 + v2} = ${h} ч.`
      wrongs = [h + 1, h - 1, Math.round(d / Math.max(v1, v2)), Math.round(d / Math.abs(v1 - v2 || 1)), h * 2]
      sig = `meet|${d}|${v1}|${v2}`
      break
    }
    case 'age': {
      const k = rng.pick([2, 3, 4])
      const n = rng.int(1, grow(15, boost))
      const kidLater = rng.int(4, 20)
      const parentLater = k * kidLater
      const X = parentLater - n
      const Y = kidLater - n
      if (Y < 1 || X - Y < 17 || X > 90) return null
      const isF = rng.chance(0.5)
      const kid = rng.chance(0.5) ? 'сыну' : 'дочери'
      x = n
      prompt = `${isF ? 'Маме' : 'Папе'} сейчас ${X} ${plural(X, 'год', 'года', 'лет')}, а ${kid} — ${Y}. Через сколько лет ${isF ? 'мама' : 'папа'} будет старше ${kid === 'сыну' ? 'сына' : 'дочери'} ровно в ${k} раза?`
      explanation = `Через n лет: ${X} + n = ${k} × (${Y} + n). Отсюда n = (${X} − ${k * Y}) : ${k - 1} = ${n}. Проверка: ${X + n} = ${k} × ${Y + n}.`
      wrongs = [n + 1, n - 1, Math.round(X / k) - Y, n + k, X - k * Y]
      sig = `age|${X}|${Y}|${k}`
      break
    }
    case 'percent': {
      const PCTS = [5, 10, 15, 20, 25, 30, 40, 50]
      const p = rng.pick(PCTS)
      const q = rng.pick(PCTS.filter((v) => v !== p))
      const P0 = 100 * rng.int(2, grow(300, boost))
      const F = (P0 * (100 + p) * (100 - q)) / 10000
      if (!Number.isInteger(F)) return null
      x = P0
      const dec = (v: number) => String(v).replace('.', ',')
      const factor = ((100 + p) * (100 - q)) / 10000
      prompt = `Цену товара повысили на ${p}%, а затем новую цену снизили на ${q}%. Теперь товар стоит ${formatNumber(F)} ₽. Сколько он стоил изначально?`
      explanation = `Итоговая цена — это исходная × ${dec((100 + p) / 100)} × ${dec((100 - q) / 100)} = исходная × ${dec(factor)}. ${formatNumber(F)} : ${dec(factor)} = ${formatNumber(P0)} ₽.`
      wrongs = [Math.round((F * 100) / (100 + p - q)), F, Math.round(F / (1 + p / 100)), P0 + 100, P0 - 100, Math.round(F * (1 + (q - p) / 100))]
      sig = `pct|${p}|${q}|${P0}`
      break
    }
    case 'shop': {
      const items = rng.pick([
        ['тетрадь', 'тетради', 'ручка', 'ручки', 'ручек'],
        ['булочка', 'булочки', 'сок', 'сока', 'соков'],
        ['карандаш', 'карандаша', 'ластик', 'ластика', 'ластиков'],
        ['яблоко', 'яблока', 'груша', 'груши', 'груш'],
      ])
      const [u1, u1few, , u2few, u2many] = items
      const x1 = rng.int(3, grow(60, boost))
      const x2 = rng.int(3, grow(60, boost))
      if (x1 === x2) return null
      const a = rng.int(2, 5)
      const b = rng.int(1, 4)
      const c = rng.int(1, a - 1)
      const d = b
      // a·x1 + b·x2 = S1; c·x1 + b·x2 = S2 → разность даёт (a − c)·x1
      const S1 = a * x1 + b * x2
      const S2 = c * x1 + d * x2
      const ask = rng.chance(0.5) ? 'first' : 'second'
      x = ask === 'first' ? x1 : x2
      const n = (k: number, one: string, few: string, many: string) => `${k} ${plural(k, one, few, many)}`
      const firstMany = items[0] === 'тетрадь' ? 'тетрадей' : items[0] === 'булочка' ? 'булочек' : items[0] === 'карандаш' ? 'карандашей' : 'яблок'
      prompt = `${n(a, u1, u1few, firstMany)} и ${n(b, items[2], u2few, u2many)} стоят ${S1} ₽, а ${n(c, u1, u1few, firstMany)} и ${n(d, items[2], u2few, u2many)} — ${S2} ₽. Сколько стоит ${ask === 'first' ? u1 : items[2]}?`
      explanation = `Во второй покупке на ${a - c} ${plural(a - c, u1, u1few, firstMany)} меньше, а остальное совпадает, поэтому ${S1} − ${S2} = ${S1 - S2} ₽ — это ${a - c} × цена. Цена: ${x1} ₽ (${u1}), ${x2} ₽ (${items[2]}).`
      wrongs = [ask === 'first' ? x2 : x1, x + 1, x - 1, Math.round((S1 - S2) / Math.max(1, a - c + 1)), Math.round(S2 / (c + d)), x + b]
      sig = `shop|${a}|${b}|${c}|${x1}|${x2}|${ask}`
      break
    }
    case 'joint': {
      // 1/a + 1/b = 1/t при a = s·u·(u+v), b = s·v·(u+v), t = s·u·v
      const minutes = rng.chance(0.6)
      const combos: [number, number, number][] = []
      for (let u = 1; u <= 6; u++)
        for (let v = 1; v <= 6; v++)
          for (let sc = 1; sc <= grow(8, boost); sc++) {
            if (u === v || gcd(u, v) !== 1) continue
            const a = sc * u * (u + v)
            const b = sc * v * (u + v)
            if (minutes ? a <= 180 && b <= 180 && a >= 10 : a <= 30 && b <= 30) combos.push([a, b, sc * u * v])
          }
      const [a, b, tt] = rng.pick(combos)
      const unit = minutes ? 'мин' : 'ч'
      const w1 = rng.pick(NAMES_M)
      const w2 = rng.pick(NAMES_F)
      const askAlone = rng.chance(0.4)
      const intro = minutes ? `Первая труба наполняет бассейн за ${a} ${unit}` : `${w1} может покрасить забор за ${a} ${unit}`
      if (askAlone) {
        x = b
        prompt = minutes
          ? `${intro}, а вместе со второй трубой — за ${tt} ${unit}. За сколько минут наполнит бассейн одна вторая труба?`
          : `${intro}, а вместе с ${w2 === 'Ева' ? 'Евой' : 'напарницей'} — за ${tt} ${unit}. За сколько часов покрасит забор ${w2 === 'Ева' ? 'Ева' : 'напарница'} одна?`
        explanation = `За ${unit === 'мин' ? 'минуту' : 'час'} вместе выполняется 1/${tt} работы, первый — 1/${a}. На второго остаётся 1/${tt} − 1/${a} = 1/${b}, то есть ${b} ${unit}.`
        wrongs = [a - tt, a + tt, b + 1, b - 1, tt * 2, Math.round((a + tt) / 2)]
      } else {
        x = tt
        prompt = minutes
          ? `${intro}, а вторая — за ${b} ${unit}. За сколько минут они наполнят бассейн, работая вместе?`
          : `${intro}, а ${w2} — за ${b} ${unit}. За сколько часов они покрасят забор, работая вместе?`
        explanation = `За ${unit === 'мин' ? 'минуту' : 'час'} первый выполняет 1/${a} работы, второй — 1/${b}. Вместе — 1/${a} + 1/${b} = 1/${tt}. Значит, на всю работу уйдёт ${tt} ${unit}.`
        wrongs = [(a + b) / 2, Math.abs(a - b), tt + 1, tt - 1, Math.min(a, b) / 2, tt + 2]
      }
      sig = `joint|${minutes}|${askAlone}|${a}|${b}`
      break
    }
  }
  const { options, answer } = numberOptions(rng, x, wrongs.map(Math.round), 5)
  return {
    category: 'quant',
    kind: `qt-word-${t}`,
    kindLabel: 'Текстовая задача',
    level,
    prompt,
    options,
    answer,
    explanation,
    signature: `qt-word|${sig}`,
  }
}

export const quantGenerator: Generator = (rng, level, boost) => {
  // Сначала выбираем вид задания, потом ищем удачный вариант именно его —
  // иначе редко удающиеся виды (лишнее число) почти не встречались бы.
  const subs = level === 1 ? [numberGrid, symbolEquations, oddOne] : [numberGrid, symbolEquations, oddOne, wordProblem]
  return firstThatWorks(
    rng,
    subs.map((sub) => () => sub(rng, level, boost)),
  )
}
