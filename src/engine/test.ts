import { GENERATORS } from './generators'
import { hash128 } from './hash'
import { claimGlobally, loadLocalSeen, saveLocalSeen } from './registry'
import { createRng, randomSeed, type Rng } from './rng'
import type { CategoryId, Level, Task, TaskDraft } from './types'
import { CATEGORIES } from './categories'

export const TEST_LENGTHS = [
  { count: 25, title: 'Быстрый', minutes: 20 },
  { count: 35, title: 'Стандартный', minutes: 30 },
  { count: 50, title: 'Полный', minutes: 45 },
] as const

export type UniquenessMode = 'global' | 'local'

export interface BuiltTest {
  seed: string
  tasks: Task[]
  mode: UniquenessMode
  /** Сколько заданий пришлось пересоздать, потому что такие уже кому-то встречались */
  replaced: number
  createdAt: number
}

interface Slot {
  category: CategoryId
  level: Level
}

/** Распределяет задания поровну по категориям и выстраивает от лёгких к трудным. */
export function planTest(rng: Rng, n: number): Slot[] {
  const cats = CATEGORIES.map((c) => c.id)
  const counts = new Map(cats.map((c) => [c, Math.floor(n / cats.length)]))
  for (const c of rng.sample(cats, n % cats.length)) counts.set(c, counts.get(c)! + 1)
  const items: (Slot & { key: number })[] = []
  for (const [category, m] of counts) {
    for (let i = 0; i < m; i++) {
      const level = (m === 1 ? 3 : 1 + Math.round((i * 4) / (m - 1))) as Level
      items.push({ category, level, key: level + (rng.next() - 0.5) * 1.2 })
    }
  }
  items.sort((a, b) => a.key - b.key)
  // Разводим подряд идущие задания одной категории.
  for (let i = 1; i < items.length; i++) {
    if (items[i].category !== items[i - 1].category) continue
    const j = items.findIndex((x, k) => k > i && x.category !== items[i - 1].category && Math.abs(x.level - items[i].level) <= 1)
    if (j > 0) [items[i], items[j]] = [items[j], items[i]]
  }
  return items.map(({ category, level }) => ({ category, level }))
}

const BASE_TIME: Record<CategoryId, number> = {
  sequence: 45,
  matrix: 60,
  spatial: 45,
  logic: 70,
  verbal: 50,
  quant: 55,
}

function timeLimitFor(d: TaskDraft): number {
  let t = BASE_TIME[d.category] + (d.level - 1) * 15
  if (d.kind.startsWith('qt-word') || d.kind === 'lg-knights') t += 30
  if (d.kind.startsWith('lg-syllogism-4') || d.kind.startsWith('vb-cipher')) t += 15
  return t
}

function toTask(d: TaskDraft, uid: string): Task {
  const { signature: _omit, ...rest } = d
  return { ...rest, uid, timeLimit: timeLimitFor(d) }
}

export function fingerprint(d: TaskDraft): string {
  return hash128(`${d.category}|${d.signature}`)
}

export async function buildTest(
  n: number,
  onProgress?: (done: number, total: number, uid: string) => void,
): Promise<BuiltTest> {
  const seedWords = randomSeed()
  const rng = createRng(seedWords)
  const plan = planTest(rng, n)
  const seen = loadLocalSeen()
  const used = new Set<string>()

  const make = (slot: Slot, boost: number): Task => {
    for (let tryNo = 0; tryNo < 80; tryNo++) {
      const b = boost + Math.floor(tryNo / 20)
      let draft: TaskDraft
      try {
        draft = GENERATORS[slot.category](rng, slot.level, b)
      } catch {
        continue
      }
      const uid = fingerprint(draft)
      if (seen.has(uid) || used.has(uid)) continue
      used.add(uid)
      return toTask(draft, uid)
    }
    throw new Error(`Не удалось создать уникальное задание (${slot.category}, уровень ${slot.level})`)
  }

  const tasks = plan.map((slot, i) => {
    const t = make(slot, 0)
    onProgress?.(i + 1, plan.length, t.uid)
    return t
  })

  let mode: UniquenessMode = 'local'
  let replaced = 0
  let pending = tasks.map((_, i) => i)
  for (let round = 1; round <= 8 && pending.length; round++) {
    const taken = await claimGlobally(pending.map((i) => tasks[i].uid))
    if (taken === null) break
    mode = 'global'
    const takenSet = new Set(taken)
    const next: number[] = []
    for (const i of pending) {
      if (!takenSet.has(tasks[i].uid)) continue
      tasks[i] = make(plan[i], round)
      replaced++
      next.push(i)
    }
    pending = next
  }

  for (const t of tasks) seen.add(t.uid)
  saveLocalSeen(seen)

  return {
    seed: seedWords.map((w) => w.toString(16).padStart(8, '0')).join(''),
    tasks,
    mode,
    replaced,
    createdAt: Date.now(),
  }
}

/** Одно случайное задание — для живой демонстрации на главной. */
export function sampleTask(rng: Rng, category: CategoryId, level: Level): Task {
  const draft = GENERATORS[category](rng, level, 0)
  return toTask(draft, fingerprint(draft))
}
