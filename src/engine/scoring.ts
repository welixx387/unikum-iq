import { CATEGORIES } from './categories'
import type { AnswerRecord, CategoryId, Level, Task } from './types'

// Оценка способности по модели IRT (трёхпараметрическая логистическая):
// каждое задание имеет трудность b (по уровню), дискриминацию a и шанс
// угадать c = 1 / число вариантов. Способность θ оценивается как среднее
// апостериорного распределения (EAP) с априорным N(0, 1) и переводится
// в шкалу IQ: 100 + 15·θ.

const DIFFICULTY: Record<Level, number> = { 1: -2, 2: -1, 3: 0, 4: 1.1, 5: 2.2 }
const DISCRIMINATION = 1.4
const D = 1.7
const PRIOR_VAR = 1.15 ** 2

function pCorrect(theta: number, task: Task): number {
  const c = 1 / task.options.length
  const b = DIFFICULTY[task.level]
  return c + (1 - c) / (1 + Math.exp(-D * DISCRIMINATION * (theta - b)))
}

export interface Estimate {
  theta: number
  se: number
}

export function estimateAbility(tasks: Task[], answers: AnswerRecord[]): Estimate {
  const grid: number[] = []
  for (let t = -4.5; t <= 4.5001; t += 0.02) grid.push(t)
  const logPost = grid.map((theta) => {
    let lp = (-0.5 * theta * theta) / PRIOR_VAR
    tasks.forEach((task, i) => {
      const p = pCorrect(theta, task)
      lp += answers[i]?.status === 'correct' ? Math.log(p) : Math.log(1 - p)
    })
    return lp
  })
  const max = Math.max(...logPost)
  const w = logPost.map((lp) => Math.exp(lp - max))
  const sum = w.reduce((a, b) => a + b, 0)
  const mean = grid.reduce((acc, t, i) => acc + t * w[i], 0) / sum
  const variance = grid.reduce((acc, t, i) => acc + (t - mean) ** 2 * w[i], 0) / sum
  return { theta: mean, se: Math.sqrt(variance) }
}

export function normalCdf(z: number): number {
  // Абрамовиц–Стиган 26.2.17
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

export interface Band {
  min: number
  label: string
  note: string
}

export const BANDS: Band[] = [
  { min: 145, label: 'Исключительно высокий', note: 'Такой результат встречается реже, чем у одного человека из тысячи.' },
  { min: 130, label: 'Очень высокий', note: 'Результат выше, чем примерно у 98% людей.' },
  { min: 115, label: 'Выше среднего', note: 'Результат заметно выше среднего — примерно у каждого шестого.' },
  { min: 85, label: 'Средний', note: 'Диапазон, в который попадают около двух третей людей.' },
  { min: 70, label: 'Ниже среднего', note: 'Результат ниже среднего. Короткий онлайн-тест чувствителен к усталости и спешке.' },
  { min: 0, label: 'Низкий', note: 'Возможно, мешали спешка, усталость или непривычный формат заданий.' },
]

export const bandFor = (iq: number) => BANDS.find((b) => iq >= b.min)!

export interface CategoryStat {
  id: CategoryId
  total: number
  correct: number
  accuracy: number
  /** Доля «весов» трудности, набранная в категории (трудные задания весят больше) */
  weighted: number
  avgTimeMs: number
}

export interface LevelStat {
  level: Level
  total: number
  correct: number
}

export interface Analysis {
  iq: number
  iqSe: number
  percentile: number
  band: Band
  correct: number
  total: number
  skipped: number
  timeouts: number
  totalTimeMs: number
  avgTimeMs: number
  categories: CategoryStat[]
  levels: LevelStat[]
  strengths: CategoryId[]
  weaknesses: CategoryId[]
  pace: 'fast' | 'balanced' | 'slow'
}

const LEVEL_WEIGHT: Record<Level, number> = { 1: 1, 2: 1.5, 3: 2, 4: 2.5, 5: 3 }

export function analyze(tasks: Task[], answers: AnswerRecord[]): Analysis {
  const est = estimateAbility(tasks, answers)
  const iq = Math.round(Math.min(160, Math.max(55, 100 + 15 * est.theta)))
  const iqSe = Math.max(3, Math.round(15 * est.se))
  const isCorrect = (i: number) => answers[i]?.status === 'correct'
  const categories: CategoryStat[] = CATEGORIES.map(({ id }) => {
    const idx = tasks.map((t, i) => (t.category === id ? i : -1)).filter((i) => i >= 0)
    const correct = idx.filter(isCorrect).length
    const wTotal = idx.reduce((s, i) => s + LEVEL_WEIGHT[tasks[i].level], 0)
    const wGot = idx.filter(isCorrect).reduce((s, i) => s + LEVEL_WEIGHT[tasks[i].level], 0)
    const time = idx.reduce((s, i) => s + (answers[i]?.timeMs ?? 0), 0)
    return {
      id,
      total: idx.length,
      correct,
      accuracy: idx.length ? correct / idx.length : 0,
      weighted: wTotal ? wGot / wTotal : 0,
      avgTimeMs: idx.length ? time / idx.length : 0,
    }
  }).filter((c) => c.total > 0)
  const levels: LevelStat[] = ([1, 2, 3, 4, 5] as Level[]).map((level) => {
    const idx = tasks.map((t, i) => (t.level === level ? i : -1)).filter((i) => i >= 0)
    return { level, total: idx.length, correct: idx.filter(isCorrect).length }
  })
  const ranked = categories.slice().sort((a, b) => b.weighted - a.weighted)
  const strengths = ranked.filter((c) => c.weighted >= 0.6).slice(0, 2).map((c) => c.id)
  const weaknesses = ranked
    .slice()
    .reverse()
    .filter((c) => c.weighted < 0.75 && !strengths.includes(c.id))
    .slice(0, 2)
    .map((c) => c.id)
  const totalTimeMs = answers.reduce((s, a) => s + (a?.timeMs ?? 0), 0)
  const limitMs = tasks.reduce((s, t) => s + t.timeLimit * 1000, 0)
  const ratio = totalTimeMs / limitMs
  return {
    iq,
    iqSe,
    percentile: normalCdf((iq - 100) / 15) * 100,
    band: bandFor(iq),
    correct: tasks.filter((_, i) => isCorrect(i)).length,
    total: tasks.length,
    skipped: answers.filter((a) => a?.status === 'skipped').length,
    timeouts: answers.filter((a) => a?.status === 'timeout').length,
    totalTimeMs,
    avgTimeMs: tasks.length ? totalTimeMs / tasks.length : 0,
    categories,
    levels,
    strengths,
    weaknesses,
    pace: ratio < 0.35 ? 'fast' : ratio > 0.7 ? 'slow' : 'balanced',
  }
}
