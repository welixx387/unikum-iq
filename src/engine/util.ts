import type { Rng } from './rng'
import type { OptionContent } from './types'

/** Собирает варианты ответа: правильный + уникальные дистракторы, перемешивает. */
export function buildOptions<T>(
  rng: Rng,
  correct: T,
  candidates: T[],
  total: number,
  key: (v: T) => string,
  toContent: (v: T) => OptionContent,
  filler?: () => T,
): { options: OptionContent[]; answer: number } {
  const seen = new Set([key(correct)])
  const picked: T[] = []
  for (const c of rng.shuffle(candidates)) {
    if (picked.length >= total - 1) break
    const k = key(c)
    if (seen.has(k)) continue
    seen.add(k)
    picked.push(c)
  }
  let guard = 0
  while (filler && picked.length < total - 1 && guard++ < 200) {
    const c = filler()
    const k = key(c)
    if (seen.has(k)) continue
    seen.add(k)
    picked.push(c)
  }
  const all = rng.shuffle([correct, ...picked])
  const answer = all.findIndex((v) => key(v) === key(correct))
  return { options: all.map(toContent), answer }
}

/** Числовые варианты ответа с правдоподобными ошибками. */
export function numberOptions(
  rng: Rng,
  correct: number,
  wrongs: number[],
  total: number,
  allowNegative = false,
) {
  const spread = Math.max(2, Math.round(Math.abs(correct) * 0.08))
  const filtered = wrongs.filter((w) => Number.isFinite(w) && Number.isInteger(w) && (allowNegative || w >= 0))
  return buildOptions(
    rng,
    correct,
    filtered,
    total,
    (v) => String(v),
    (v) => ({ type: 'text', value: formatNumber(v) }),
    () => {
      const v = correct + rng.sign() * rng.int(1, spread)
      return allowNegative || v >= 0 ? v : correct + rng.int(1, spread)
    },
  )
}

export function formatNumber(n: number): string {
  const abs = Math.abs(n)
  const s = abs >= 10000 ? abs.toLocaleString('ru-RU').replace(/ /g, ' ') : String(abs)
  return n < 0 ? `−${s}` : s
}

export function signed(n: number): string {
  return n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export class Retry extends Error {}

/** Повторяет генерацию, пока builder не вернёт результат (или не кончатся попытки). */
export function attempt<T>(fn: () => T | null, tries = 400): T {
  for (let i = 0; i < tries; i++) {
    try {
      const r = fn()
      if (r !== null) return r
    } catch (e) {
      if (!(e instanceof Retry)) throw e
    }
  }
  throw new Error('generator exhausted')
}

/** Выбирает вид задания, затем ищет удачный вариант именно этого вида. */
export function firstThatWorks<T>(rng: Rng, pool: (() => T | null)[], tries = 600): T {
  for (const sub of rng.shuffle(pool)) {
    try {
      return attempt(sub, tries)
    } catch {
      // этот вид не удался — пробуем следующий
    }
  }
  throw new Error('generator exhausted')
}
