import type { Generator, Level, TaskDraft } from '../types'
import type { Rng } from '../rng'
import { buildOptions, firstThatWorks } from '../util'
import { names, pseudoNoun, type PseudoNoun } from '../words'

// ── Силлогизмы ──────────────────────────────────────────────────────────
// Вывод проверяется перебором всех «миров» (какие области диаграммы Венна
// непусты), поэтому правильный ответ гарантированно верен.

type SType = 'all' | 'no' | 'some' | 'somenot'
interface Statement {
  type: SType
  a: number
  b: number
}

function regionMask(n: number, pred: (r: number) => boolean): number {
  let m = 0
  for (let r = 0; r < 1 << n; r++) if (pred(r)) m |= 1 << r
  return m
}

/** Утверждение сводится к маске областей: они должны быть пусты (all/no) или хоть одна непуста (some/somenot). */
function compile(s: Statement, n: number): { mask: number; empty: boolean } {
  const A = 1 << s.a
  const B = 1 << s.b
  const inB = s.type === 'no' || s.type === 'some'
  const mask = regionMask(n, (r) => (r & A) !== 0 && ((r & B) !== 0) === inB)
  return { mask, empty: s.type === 'all' || s.type === 'no' }
}

const holds = (c: { mask: number; empty: boolean }, model: number) => ((model & c.mask) === 0) === c.empty

type Verdict = 'true' | 'false' | 'unknown'

function judge(premises: Statement[], conclusion: Statement, n: number): Verdict | null {
  const regions = 1 << n
  const termMasks = Array.from({ length: n }, (_, t) => regionMask(n, (r) => (r & (1 << t)) !== 0))
  const ps = premises.map((p) => compile(p, n))
  const cc = compile(conclusion, n)
  let canTrue = false
  let canFalse = false
  for (let model = 1; model < 1 << regions; model++) {
    // Каждое понятие непусто: «все зорбы» подразумевает, что зорбы существуют.
    if (termMasks.some((tm) => (model & tm) === 0)) continue
    if (!ps.every((p) => holds(p, model))) continue
    if (holds(cc, model)) canTrue = true
    else canFalse = true
    if (canTrue && canFalse) return 'unknown'
  }
  if (!canTrue && !canFalse) return null
  return canTrue ? 'true' : 'false'
}

function sayStatement(s: Statement, w: PseudoNoun[]): string {
  const A = w[s.a]
  const B = w[s.b]
  switch (s.type) {
    case 'all':
      return `все ${A.pl} — ${B.pl}`
    case 'no':
      return `ни один ${A.sg} не является ${B.instr}`
    case 'some':
      return `некоторые ${A.pl} — ${B.pl}`
    case 'somenot':
      return `некоторые ${A.pl} не являются ${B.instrPl}`
  }
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

const VERDICT_OPTIONS = ['Да, это обязательно верно', 'Нет, это обязательно неверно', 'Нельзя определить']

function syllogism(rng: Rng, level: Level, target: Verdict): TaskDraft | null {
  const n = level >= 4 ? 4 : 3
  const types: SType[] = level <= 2 ? ['all', 'no'] : level === 3 ? ['all', 'no', 'some'] : ['all', 'no', 'some', 'somenot']
  const order = rng.shuffle(Array.from({ length: n }, (_, i) => i))
  const premises: Statement[] = []
  for (let i = 0; i < n - 1; i++) {
    const [x, y] = rng.chance(0.5) ? [order[i], order[i + 1]] : [order[i + 1], order[i]]
    premises.push({ type: rng.pick(types), a: x, b: y })
  }
  // Не больше одной «частной» посылки — иначе почти всё становится «нельзя определить».
  if (premises.filter((p) => p.type === 'some' || p.type === 'somenot').length > 1) return null
  const [ca, cb] = rng.chance(0.5) ? [order[0], order[n - 1]] : [order[n - 1], order[0]]
  const conclusion: Statement = { type: rng.pick(['all', 'no', 'some', 'somenot'] as SType[]), a: ca, b: cb }
  const verdict = judge(premises, conclusion, n)
  // Ответ выбирается заранее, чтобы «нельзя определить» не выпадало чаще других.
  if (verdict !== target) return null
  const avoid = new Set<string>()
  const words = Array.from({ length: n }, () => pseudoNoun(rng, avoid))
  const lines = rng.shuffle(premises).map((p) => `${cap(sayStatement(p, words))}.`)
  const concl = sayStatement(conclusion, words)
  const answer = verdict === 'true' ? 0 : verdict === 'false' ? 1 : 2
  const explain: Record<Verdict, string> = {
    true: `Вывод следует из условий обязательно: нельзя придумать ситуацию, в которой все условия выполнены, а утверждение «${concl}» — нет.`,
    false: `Условия исключают такую ситуацию: если все условия выполнены, утверждение «${concl}» всегда оказывается ложным.`,
    unknown: `Условия допускают оба варианта: можно представить мир, где «${concl}», и мир, где это не так. Частая ошибка — «перевернуть» условие (из «все A — B» не следует, что все B — A) или додумать то, чего в условии нет.`,
  }
  return {
    category: 'logic',
    kind: `lg-syllogism-${n}`,
    kindLabel: n === 3 ? 'Силлогизм' : 'Цепочка суждений',
    level,
    prompt: `Верно ли, что ${concl}?`,
    hint: 'Слова выдуманы — опирайтесь только на условия.',
    visual: { type: 'premises', lines },
    options: VERDICT_OPTIONS.map((value) => ({ type: 'text', value })),
    answer,
    explanation: explain[verdict],
    signature: `lg-syl|${lines.join('|')}|${concl}`,
  }
}

// ── Упорядочивание ──────────────────────────────────────────────────────

interface Scale {
  more: string
  less: string
  mostQ: string
  leastQ: string
  axis: string
  from: string
  premise: string
}

const SCALES: Scale[] = [
  { more: 'выше', less: 'ниже', mostQ: 'Кто выше всех?', leastQ: 'Кто ниже всех?', axis: 'по росту', from: 'от самого высокого', premise: 'Все они разного роста.' },
  { more: 'старше', less: 'младше', mostQ: 'Кто старше всех?', leastQ: 'Кто младше всех?', axis: 'по возрасту', from: 'от самого старшего', premise: 'Все они разного возраста.' },
  { more: 'тяжелее', less: 'легче', mostQ: 'Кто тяжелее всех?', leastQ: 'Кто легче всех?', axis: 'по весу', from: 'от самого тяжёлого', premise: 'Все они разного веса.' },
  { more: 'бегает быстрее', less: 'бегает медленнее', mostQ: 'Кто бегает быстрее всех?', leastQ: 'Кто бегает медленнее всех?', axis: 'по скорости', from: 'от самого быстрого', premise: 'Все бегают с разной скоростью.' },
  { more: 'живёт выше', less: 'живёт ниже', mostQ: 'Кто живёт выше всех?', leastQ: 'Кто живёт ниже всех?', axis: 'по этажу', from: 'от самого верхнего этажа', premise: 'Все живут в одном доме на разных этажах.' },
]

const ORDINALS = ['первым', 'вторым', 'третьим', 'четвёртым', 'пятым', 'шестым']

function permutations(n: number): number[][] {
  if (n === 1) return [[0]]
  const out: number[][] = []
  for (const p of permutations(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)])
  return out
}

function ordering(rng: Rng, level: Level, boost: number): TaskDraft | null {
  const n = Math.min(6, [4, 4, 5, 5, 6][level - 1] + (boost > 1 ? 1 : 0))
  const scale = rng.pick(SCALES)
  const people = names(rng, n)
  // truth[pos] = индекс человека; pos 0 — «больше всех»
  const truth = rng.shuffle(people.map((_, i) => i))
  const qType = level <= 2 ? rng.pick(['top', 'bottom'] as const) : rng.pick(['top', 'bottom', 'kth', 'kth'] as const)
  const k = qType === 'top' ? 0 : qType === 'bottom' ? n - 1 : rng.int(1, n - 2)
  const target = truth[k]
  const perms = permutations(n)
  type Clue = [number, number]
  const determined = (clues: Clue[]) => {
    let found: number | null = null
    for (const p of perms) {
      if (!clues.every(([hi, lo]) => p.indexOf(hi) < p.indexOf(lo))) continue
      if (found === null) found = p[k]
      else if (found !== p[k]) return false
    }
    return found === target
  }
  let clues: Clue[] = []
  if (level === 1) {
    for (let i = 0; i < n - 1; i++) clues.push([truth[i], truth[i + 1]])
  } else {
    const pairs: Clue[] = []
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([truth[i], truth[j]])
    for (const pr of rng.shuffle(pairs)) {
      clues.push(pr)
      if (determined(clues)) break
    }
    if (!determined(clues)) return null
    for (const c of rng.shuffle(clues)) {
      const rest = clues.filter((x) => x !== c)
      if (determined(rest)) clues = rest
    }
  }
  if (!determined(clues)) return null
  const lines = [scale.premise]
  for (const [hi, lo] of rng.shuffle(clues)) {
    const negate = level >= 4 && rng.chance(0.35)
    if (negate) {
      // «A не ниже, чем B» при различающихся значениях означает «A выше B».
      lines.push(rng.chance(0.5) ? `${people[hi]} не ${scale.less}, чем ${people[lo]}.` : `${people[lo]} не ${scale.more}, чем ${people[hi]}.`)
    } else {
      lines.push(rng.chance(0.5) ? `${people[hi]} ${scale.more}, чем ${people[lo]}.` : `${people[lo]} ${scale.less}, чем ${people[hi]}.`)
    }
  }
  const question =
    qType === 'top' ? scale.mostQ : qType === 'bottom' ? scale.leastQ : `Кто окажется ${ORDINALS[k]}, если выстроить всех ${scale.axis} ${scale.from}?`
  const fullyKnown = (() => {
    let count = 0
    for (const p of perms) if (clues.every(([hi, lo]) => p.indexOf(hi) < p.indexOf(lo))) count++
    return count === 1
  })()
  const { options, answer } = buildOptions(
    rng,
    target,
    people.map((_, i) => i),
    Math.min(n, 5),
    (v) => String(v),
    (v) => ({ type: 'text', value: people[v] }),
  )
  return {
    category: 'logic',
    kind: 'lg-order',
    kindLabel: 'Упорядочивание',
    level,
    prompt: question,
    visual: { type: 'premises', lines },
    options,
    answer,
    explanation: `${fullyKnown ? 'Из условий однозначно восстанавливается порядок' : 'Один из порядков, согласных с условиями'} (${scale.from}): ${truth.map((i) => people[i]).join(' → ')}. ${fullyKnown ? '' : 'Порядок некоторых других участников может меняться, но на нужном месте всегда оказывается один и тот же человек. '}Ответ: ${people[target]}.${lines.some((l) => l.includes(' не ')) ? ' Помните: раз значения у всех разные, «не ниже» означает «выше».' : ''}`,
    signature: `lg-ord|${lines.join('|')}|${question}`,
  }
}

// ── Рыцари и лжецы ──────────────────────────────────────────────────────

type KStatement =
  | { t: 'knight'; x: number }
  | { t: 'knave'; x: number }
  | { t: 'same'; x: number; y: number }
  | { t: 'diff'; x: number; y: number }
  | { t: 'count'; k: number }
  | { t: 'someKnave' }

function evalK(s: KStatement, world: boolean[]): boolean {
  switch (s.t) {
    case 'knight':
      return world[s.x]
    case 'knave':
      return !world[s.x]
    case 'same':
      return world[s.x] === world[s.y]
    case 'diff':
      return world[s.x] !== world[s.y]
    case 'count':
      return world.filter(Boolean).length === s.k
    case 'someKnave':
      return world.some((v) => !v)
  }
}

const COUNT_WORDS = ['нет ни одного рыцаря', 'ровно один рыцарь', 'ровно два рыцаря', 'все трое — рыцари']

function sayK(s: KStatement, speaker: number, who: string[]): string {
  const nm = (i: number) => (i === speaker ? 'я' : who[i])
  switch (s.t) {
    case 'knight':
      return `${cap(nm(s.x))} — рыцарь`
    case 'knave':
      return `${cap(nm(s.x))} — лжец`
    case 'same':
      return `${cap(nm(s.x))} и ${nm(s.y)} — одного типа`
    case 'diff':
      return `${cap(nm(s.x))} и ${nm(s.y)} — разного типа`
    case 'count':
      return s.k === 3 ? 'Мы все трое — рыцари' : `Среди нас ${COUNT_WORDS[s.k]}`
    case 'someKnave':
      return 'Среди нас есть хотя бы один лжец'
  }
}

function knights(rng: Rng, level: Level): TaskDraft | null {
  const who = names(rng, 3)
  const stmts: KStatement[] = [0, 1, 2].map((sp) => {
    const others = [0, 1, 2].filter((i) => i !== sp)
    const x = rng.pick(others)
    const pool: KStatement[] = [
      { t: 'knight', x },
      { t: 'knave', x },
      { t: 'same', x: sp, y: rng.pick(others) },
      { t: 'diff', x: others[0], y: others[1] },
    ]
    if (level >= 5) pool.push({ t: 'count', k: rng.int(0, 2) }, { t: 'someKnave' })
    return rng.pick(pool)
  })
  const worlds: boolean[][] = []
  for (let m = 0; m < 8; m++) {
    const world = [0, 1, 2].map((i) => (m & (1 << i)) !== 0)
    if (stmts.every((s, sp) => evalK(s, world) === world[sp])) worlds.push(world)
  }
  if (worlds.length !== 1) return null
  const world = worlds[0]
  const setLabel = (w: boolean[]) => {
    const ks = who.filter((_, i) => w[i])
    if (ks.length === 0) return 'Никто — все лжецы'
    if (ks.length === 3) return 'Все трое'
    if (ks.length === 1) return `Только ${ks[0]}`
    return `${ks[0]} и ${ks[1]}`
  }
  const allWorlds = Array.from({ length: 8 }, (_, m) => [0, 1, 2].map((i) => (m & (1 << i)) !== 0))
  const { options, answer } = buildOptions(
    rng,
    world,
    allWorlds,
    5,
    (w) => w.map(Number).join(''),
    (w) => ({ type: 'text', value: setLabel(w) }),
  )
  const lines = stmts.map((s, sp) => `${who[sp]}: «${sayK(s, sp, who)}».`)
  const check = stmts
    .map((s, sp) => {
      const truth = evalK(s, world)
      return `${who[sp]} — ${world[sp] ? 'рыцарь' : 'лжец'}, и ${world[sp] ? 'говорит правду' : 'лжёт'}: «${sayK(s, sp, who)}» — ${truth ? 'правда' : 'ложь'}.`
    })
    .join(' ')
  return {
    category: 'logic',
    kind: 'lg-knights',
    kindLabel: 'Рыцари и лжецы',
    level,
    prompt: 'На острове живут рыцари, которые всегда говорят правду, и лжецы, которые всегда лгут. Каждый из троих сказал одну фразу. Кто из них рыцарь?',
    visual: { type: 'premises', lines },
    options,
    answer,
    explanation: `Из восьми возможных раскладов условиям не противоречит только один. ${check}`,
    signature: `lg-kn|${lines.join('|')}`,
  }
}

export const logicGenerator: Generator = (rng, level, boost) => {
  const target = rng.pick<Verdict>(['true', 'false', 'unknown'])
  const subs =
    level <= 1
      ? [() => ordering(rng, level, boost)]
      : level <= 3
        ? [() => syllogism(rng, level, target), () => ordering(rng, level, boost)]
        : [() => syllogism(rng, level, target), () => ordering(rng, level, boost), () => knights(rng, level)]
  return firstThatWorks(rng, subs, 2000)
}
