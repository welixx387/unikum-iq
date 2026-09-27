import type { Generator, Level, TaskDraft } from '../types'
import type { Rng } from '../rng'
import { attempt, buildOptions, signed } from '../util'

/** Алфавит без Ё — его показываем подсказкой под заданием. */
export const ALPHABET = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
const N = ALPHABET.length
const letter = (i: number) => ALPHABET[i]
const idx = (ch: string) => ALPHABET.indexOf(ch)
const inRange = (i: number) => i >= 0 && i < N

// ── Буквенные ряды ──────────────────────────────────────────────────────

interface LetterRule {
  kind: string
  label: string
  items: string[]
  explain: string
  wrongs: (i: number) => string[]
  /** С какой позиции можно прятать элемент */
  hideFrom: number
}

function steps(start: number, deltas: number[]): number[] | null {
  const out = [start]
  for (const d of deltas) out.push(out[out.length - 1] + d)
  return out.every(inRange) ? out : null
}

const L = (i: number) => (inRange(i) ? letter(i) : null)
const clean = (xs: (string | null)[]) => xs.filter((x): x is string => Boolean(x) && !x!.includes('null'))

function letterRule(rng: Rng, level: Level): LetterRule | null {
  // Веса: у «узких» правил (мало вариантов в алфавите из 32 букв) вес меньше.
  const kinds: Record<Level, [string, number][]> = {
    1: [['step', 0.5], ['back', 0.3], ['pair', 2]],
    2: [['back', 0.3], ['alt', 0.6], ['pair', 2]],
    3: [['grow', 0.2], ['interleave', 0.7], ['pair', 1.5], ['pairs-num', 1]],
    4: [['pairs-num', 2], ['pairs-pos', 0.4], ['interleave', 0.7], ['pair', 1]],
    5: [['pairs-indep', 0.5], ['alt-grow', 0.15], ['pairs-num', 1.5], ['pair', 1]],
  }
  const table = kinds[level]
  let roll = rng.next() * table.reduce((s, [, w]) => s + w, 0)
  let kind = table[0][0]
  for (const [k, w] of table) {
    roll -= w
    if (roll <= 0) {
      kind = k
      break
    }
  }
  switch (kind) {
    case 'step':
    case 'back': {
      const k = kind === 'step' ? rng.int(1, 4) : -rng.int(1, 5)
      const len = rng.int(5, 7)
      const seq = steps(rng.int(0, N - 1), Array(len - 1).fill(k))
      if (!seq) return null
      return {
        kind: `vb-${kind}`,
        label: kind === 'step' ? 'Шаг по алфавиту' : 'Обратный шаг',
        items: seq.map(letter),
        explain: `Каждая следующая буква стоит в алфавите на ${Math.abs(k)} ${k > 0 ? 'позже' : 'раньше'} предыдущей.`,
        wrongs: (i) => clean([L(seq[i] + 1), L(seq[i] - 1), L(seq[i] + k), L(seq[i] - k), L(seq[i] + 2)]),
        hideFrom: 2,
      }
    }
    case 'alt': {
      const dir = rng.sign()
      const a = rng.int(1, 4)
      let b = rng.int(1, 5)
      if (b === a) b = a + 1
      const len = rng.int(6, 7)
      const deltas = Array.from({ length: len - 1 }, (_, i) => dir * (i % 2 === 0 ? a : b))
      const seq = steps(rng.int(0, N - 1), deltas)
      if (!seq) return null
      return {
        kind: 'vb-alt',
        label: 'Чередующийся шаг',
        items: seq.map(letter),
        explain: `Шаги по алфавиту чередуются: ${dir > 0 ? '+' : '−'}${a}, ${dir > 0 ? '+' : '−'}${b}, ${dir > 0 ? '+' : '−'}${a}, ${dir > 0 ? '+' : '−'}${b}…`,
        wrongs: (i) => clean([L(seq[i - 1] + dir * (i % 2 ? b : a)), L(seq[i - 1] + dir * (a + b)), L(seq[i] + 1), L(seq[i] - 1), L(seq[i - 1] + dir)]),
        hideFrom: 3,
      }
    }
    case 'pair': {
      const k1 = rng.int(1, level === 1 ? 2 : 3)
      const k2 = level === 1 ? rng.pick([-1, 1, 2]) : rng.pick([-3, -2, -1, 1, 2, 3])
      const len = rng.int(5, 6)
      const a = steps(rng.int(0, N - 1), Array(len - 1).fill(k1))
      const b = steps(rng.int(0, N - 1), Array(len - 1).fill(k2))
      if (!a || !b) return null
      const items = a.map((x, i) => letter(x) + letter(b[i]))
      return {
        kind: 'vb-pair',
        label: 'Пары букв',
        items,
        explain: `Первые буквы пар идут вперёд с шагом ${k1}, вторые — ${k2 > 0 ? 'вперёд' : 'назад'} с шагом ${Math.abs(k2)}.`,
        wrongs: (i) =>
          clean([
            (L(a[i]) ?? '') + (L(b[i] - k2) ?? ''),
            (L(a[i] + 1) ?? '') + (L(b[i]) ?? ''),
            (L(a[i]) ?? '') + (L(b[i] + 1) ?? ''),
            (L(b[i]) ?? '') + (L(a[i]) ?? ''),
            (L(a[i] - 1) ?? '') + (L(b[i] - 1) ?? ''),
          ]).filter((w) => w.length === 2),
        hideFrom: 2,
      }
    }
    case 'grow': {
      const d0 = rng.int(1, 2)
      const seq = steps(rng.int(0, 10), [d0, d0 + 1, d0 + 2, d0 + 3, d0 + 4])
      if (!seq) return null
      return {
        kind: 'vb-grow',
        label: 'Растущий шаг',
        items: seq.map(letter),
        explain: `Шаг по алфавиту каждый раз растёт на 1: +${d0}, +${d0 + 1}, +${d0 + 2}, +${d0 + 3}, +${d0 + 4}.`,
        wrongs: (i) => clean([L(seq[i - 1] + (seq[i - 1] - seq[i - 2])), L(seq[i] + 1), L(seq[i] - 1), L(seq[i] + 2), L(seq[i - 1] + 1)]),
        hideFrom: 3,
      }
    }
    case 'interleave': {
      const k1 = rng.int(1, 3)
      const k2 = -rng.int(1, 3)
      const a = steps(rng.int(0, 14), [k1, k1, k1])
      const b = steps(rng.int(N - 14, N - 1), [k2, k2, k2])
      if (!a || !b) return null
      const seq = [a[0], b[0], a[1], b[1], a[2], b[2], a[3], b[3]]
      return {
        kind: 'vb-interleave',
        label: 'Два буквенных ряда',
        items: seq.map(letter),
        explain: `Два ряда вперемешку: на нечётных местах буквы идут вперёд с шагом ${k1}, на чётных — назад с шагом ${-k2}.`,
        wrongs: (i) => clean([L(seq[i - 1] + (i % 2 ? k1 : k2)), L(seq[i] + 1), L(seq[i] - 1), L(seq[i - 2] - (i % 2 ? k2 : k1)), L(seq[i] + 2)]),
        hideFrom: 4,
      }
    }
    case 'pairs-pos': {
      const k = rng.int(1, 5)
      const len = rng.int(5, 6)
      const seq = steps(rng.int(0, N - 1), Array(len - 1).fill(k))
      if (!seq) return null
      const items = seq.map((i) => `${letter(i)}${i + 1}`)
      return {
        kind: 'vb-pairs-pos',
        label: 'Буквы и номера',
        items,
        explain: `Число рядом с буквой — её номер в алфавите (без Ё), а буквы идут с шагом ${k}.`,
        wrongs: (i) => {
          const x = seq[i]
          return clean([L(x) && `${L(x)}${x}`, L(x) && `${L(x)}${x + 2}`, L(x + 1) && `${L(x + 1)}${x + 1}`, L(x - 1) && `${L(x - 1)}${x + 1}`, L(x) && `${L(x)}${x + 1 + k}`])
        },
        hideFrom: 2,
      }
    }
    case 'pairs-num': {
      const k = rng.pick([-3, -2, -1, 1, 2, 3, 4])
      const len = rng.int(5, 6)
      const seq = steps(rng.int(0, N - 1), Array(len - 1).fill(k))
      if (!seq) return null
      const a0 = rng.int(1, 60)
      let d = rng.int(-9, 12)
      if (d === 0) d = 5
      const nums = seq.map((_, i) => a0 + i * d)
      if (nums.some((v) => v < 0)) return null
      const items = seq.map((x, i) => `${letter(x)}${nums[i]}`)
      return {
        kind: 'vb-pairs-num',
        label: 'Буквы и числа',
        items,
        explain: `Буквы идут ${k > 0 ? 'вперёд' : 'назад'} по алфавиту с шагом ${Math.abs(k)}, а числа каждый раз меняются на ${signed(d)}.`,
        wrongs: (i) => {
          const x = seq[i]
          const n = nums[i]
          return clean([L(x) && `${L(x)}${n + 1}`, L(x + 1) && `${L(x + 1)}${n}`, L(x - 1) && `${L(x - 1)}${n}`, L(x) && `${L(x)}${n - d * 2}`, L(x - k) && `${L(x - k)}${n}`])
        },
        hideFrom: 2,
      }
    }
    case 'pairs-indep': {
      const k = -rng.int(1, 3)
      const letters = steps(rng.int(N - 14, N - 1), [k, k, k, k])
      if (!letters) return null
      const squaresMode = rng.chance(0.4)
      const r = rng.pick([2, 3])
      const n0 = rng.int(1, squaresMode ? 12 : 9)
      const nums = [0, 1, 2, 3, 4].map((i) => (squaresMode ? (n0 + i) ** 2 : n0 * r ** i))
      const items = letters.map((l, i) => `${letter(l)}${nums[i]}`)
      return {
        kind: 'vb-pairs-indep',
        label: 'Буквы и числа',
        items,
        explain: `Буквы идут назад по алфавиту с шагом ${-k}, а числа — ${squaresMode ? `квадраты чисел ${n0}, ${n0 + 1}, ${n0 + 2}…` : `каждый раз умножаются на ${r}`}.`,
        wrongs: (i) => {
          const x = letters[i]
          return clean([
            L(x) && `${L(x)}${nums[i - 1] + (nums[i - 1] - nums[i - 2])}`,
            L(x - 1) && `${L(x - 1)}${nums[i]}`,
            L(x + 1) && `${L(x + 1)}${nums[i]}`,
            L(x - k) && `${L(x - k)}${nums[i]}`,
            L(x) && `${L(x)}${nums[i] + 1}`,
          ])
        },
        hideFrom: 2,
      }
    }
    case 'alt-grow': {
      const a = rng.int(1, 2)
      const seq = steps(rng.int(0, 8), [a, a + 2, a + 1, a + 3, a + 2])
      if (!seq) return null
      return {
        kind: 'vb-alt-grow',
        label: 'Две чередующиеся прогрессии шагов',
        items: seq.map(letter),
        explain: `Шаги такие: +${a}, +${a + 2}, +${a + 1}, +${a + 3}, +${a + 2} — нечётные шаги растут на 1 (${a}, ${a + 1}, ${a + 2}), чётные тоже (${a + 2}, ${a + 3}).`,
        wrongs: (i) => clean([L(seq[i - 1] + (seq[i - 1] - seq[i - 2]) + 1), L(seq[i - 1] + (seq[i - 1] - seq[i - 2])), L(seq[i] + 1), L(seq[i] - 1), L(seq[i - 1] + a)]),
        hideFrom: 5,
      }
    }
  }
  return null
}

/** Случайная «соседняя» ошибка: одна буква или цифра сдвинута. */
function mutate(rng: Rng, s: string): string {
  const chars = [...s]
  const p = rng.int(0, chars.length - 1)
  const c = chars[p]
  if (/\d/.test(c)) chars[p] = String((Number(c) + rng.int(1, 8)) % 10)
  else {
    const i = idx(c) + rng.sign() * rng.int(1, 2)
    if (inRange(i)) chars[p] = letter(i)
  }
  return chars.join('')
}

function letterSequence(rng: Rng, level: Level): TaskDraft | null {
  const rule = letterRule(rng, level)
  if (!rule) return null
  const last = rule.items.length - 1
  const hidden = level >= 2 && rng.chance(0.3) && rule.hideFrom < last ? rng.int(rule.hideFrom, last - 1) : last
  const correct = rule.items[hidden]
  const { options, answer } = buildOptions(
    rng,
    correct,
    rule.wrongs(hidden),
    5,
    (v) => v,
    (v) => ({ type: 'text', value: v }),
    () => mutate(rng, correct),
  )
  if (options.length < 4) return null
  const shown = rule.items.map((x, i) => (i === hidden ? null : x))
  return {
    category: 'verbal',
    kind: rule.kind,
    kindLabel: rule.label,
    level,
    prompt: hidden === last ? 'Что продолжает ряд?' : 'Что пропущено в ряду?',
    visual: { type: 'sequence', items: shown },
    showAlphabet: true,
    options,
    answer,
    explanation: `${rule.explain} Ответ: ${correct}.`,
    signature: `vb-seq|${rule.kind}|${rule.items.join(',')}|${hidden}`,
  }
}

// ── Шифры ───────────────────────────────────────────────────────────────

type CipherKind = 'shift' | 'shift-back' | 'reverse' | 'alt' | 'position' | 'reverse-shift' | 'swap-shift'

const VOWELS = 'АЕИОУЫЭЮЯ'
const CONS = 'БВГДЖЗКЛМНПРСТФХЦЧШ'

function pseudoWord(rng: Rng, len: number): string {
  let w = ''
  let vowel = rng.chance(0.35)
  for (let i = 0; i < len; i++) {
    w += vowel ? rng.pick([...VOWELS]) : rng.pick([...CONS])
    vowel = !vowel
  }
  return w
}

function encode(word: string, kind: CipherKind, k: number): string | null {
  const ch = [...word].map(idx)
  let out: number[]
  switch (kind) {
    case 'shift':
      out = ch.map((c) => c + k)
      break
    case 'shift-back':
      out = ch.map((c) => c - k)
      break
    case 'reverse':
      out = ch.slice().reverse()
      break
    case 'alt':
      out = ch.map((c, i) => (i % 2 === 0 ? c + k : c - k))
      break
    case 'position':
      out = ch.map((c, i) => c + i + 1)
      break
    case 'reverse-shift':
      out = ch
        .slice()
        .reverse()
        .map((c) => c + k)
      break
    case 'swap-shift': {
      out = ch.slice()
      for (let i = 0; i + 1 < out.length; i += 2) [out[i], out[i + 1]] = [out[i + 1], out[i]]
      out = out.map((c) => c + k)
      break
    }
  }
  return out.every(inRange) ? out.map(letter).join('') : null
}

const CIPHER_TEXT: Record<CipherKind, (k: number) => string> = {
  shift: (k) => `Каждая буква заменяется на букву, стоящую в алфавите на ${k} позже.`,
  'shift-back': (k) => `Каждая буква заменяется на букву, стоящую в алфавите на ${k} раньше.`,
  reverse: () => 'Буквы слова записываются в обратном порядке.',
  alt: (k) => `Буквы на нечётных местах сдвигаются на ${k} вперёд по алфавиту, на чётных — на ${k} назад.`,
  position: () => 'Каждая буква сдвигается вперёд по алфавиту на свой номер в слове: первая на 1, вторая на 2 и так далее.',
  'reverse-shift': (k) => `Слово записывается задом наперёд, и каждая буква сдвигается на ${k} вперёд по алфавиту.`,
  'swap-shift': (k) => `Соседние буквы меняются местами попарно (1↔2, 3↔4…), затем каждая сдвигается на ${k} вперёд.`,
}

function cipher(rng: Rng, level: Level, boost: number): TaskDraft | null {
  const kinds: CipherKind[] =
    level === 1 ? ['shift'] : level === 2 ? ['shift', 'shift-back'] : level === 3 ? ['shift-back', 'shift', 'reverse'] : level === 4 ? ['alt', 'position', 'reverse-shift'] : ['swap-shift', 'reverse-shift', 'alt', 'position']
  const kind = rng.pick(kinds)
  const k = kind === 'reverse' || kind === 'position' ? 0 : rng.int(1, level === 1 ? 2 : 3)
  const len = rng.int(4, 5) + (level >= 4 ? 1 : 0) + Math.min(boost, 1)
  const exampleCount = level >= 4 ? 2 : 1
  const examples: [string, string][] = []
  for (let i = 0; i < exampleCount; i++) {
    const w = pseudoWord(rng, len)
    const e = encode(w, kind, k)
    if (!e || e === w) return null
    examples.push([w, e])
  }
  const query = pseudoWord(rng, len)
  const correct = encode(query, kind, k)
  if (!correct) return null
  const near: string[] = []
  const add = (s: string | null) => s && near.push(s)
  add(encode(query, kind, k + 1))
  if (k > 1) add(encode(query, kind, k - 1))
  add(encode(query, 'shift', k || 1))
  add(encode(query, 'shift-back', k || 1))
  add(encode(query, 'reverse', 0))
  if (kind === 'alt') add(encode(query, 'alt', -k))
  if (kind === 'reverse-shift') add(encode(query, 'shift', k))
  if (kind === 'swap-shift') add(encode(query, 'shift', k))
  if (kind === 'position') add([...query].map((c, i) => letter(idx(c) + i)).join(''))
  // Ошибка в одной букве — самый частый промах при внимательной работе.
  const oneOff = [...correct]
  const p = rng.int(0, oneOff.length - 1)
  const shifted = idx(oneOff[p]) + rng.sign()
  if (inRange(shifted)) {
    oneOff[p] = letter(shifted)
    add(oneOff.join(''))
  }
  const { options, answer } = buildOptions(
    rng,
    correct,
    near.filter((s) => !s.includes('undefined')),
    5,
    (v) => v,
    (v) => ({ type: 'text', value: v }),
    () => mutate(rng, correct),
  )
  if (options.length < 4) return null
  return {
    category: 'verbal',
    kind: `vb-cipher-${kind}`,
    kindLabel: 'Шифр',
    level,
    prompt: `Слова зашифрованы по одному правилу. Как будет зашифровано ${query}?`,
    visual: { type: 'cipher', examples, query },
    showAlphabet: true,
    options,
    answer,
    explanation: `${CIPHER_TEXT[kind](k)} ${query} → ${correct}.`,
    signature: `vb-ci|${kind}|${k}|${examples.map((e) => e.join('>')).join(',')}|${query}`,
  }
}

export const verbalGenerator: Generator = (rng, level, boost) =>
  attempt(() => {
    // Буквенные ряды ограничены алфавитом, шифры — практически нет:
    // при нехватке уникальных вариантов (boost > 0) переходим на шифры.
    const letterShare = boost > 0 ? 0 : 0.4
    return rng.chance(letterShare) ? letterSequence(rng, level) : cipher(rng, level, boost)
  }, 2000)
