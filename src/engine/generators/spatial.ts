import type { Cell, Dot, Generator, Level, OptionContent, TaskDraft } from '../types'
import type { Rng } from '../rng'
import { firstThatWorks } from '../util'

// ── Полимино ────────────────────────────────────────────────────────────

function normalize(cells: Cell[]): Cell[] {
  const minX = Math.min(...cells.map((c) => c.x))
  const minY = Math.min(...cells.map((c) => c.y))
  return cells
    .map((c) => ({ x: c.x - minX, y: c.y - minY, c: c.c }))
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

export const shapeKey = (cells: Cell[]) => normalize(cells).map((c) => `${c.x},${c.y},${c.c}`).join(';')
/** Поворот на 90° по часовой стрелке (ось y направлена вниз). */
const rot = (cells: Cell[], times = 1): Cell[] => {
  let out = cells
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) out = out.map((c) => ({ x: -c.y, y: c.x, c: c.c }))
  return normalize(out)
}
const mirrorX = (cells: Cell[]) => normalize(cells.map((c) => ({ x: -c.x, y: c.y, c: c.c })))
const mirrorY = (cells: Cell[]) => normalize(cells.map((c) => ({ x: c.x, y: -c.y, c: c.c })))

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

function growPolyomino(rng: Rng, n: number, box: number): Cell[] | null {
  const set = new Map<string, Cell>([['0,0', { x: 0, y: 0, c: 0 }]])
  let guard = 0
  while (set.size < n && guard++ < 500) {
    const base = rng.pick([...set.values()])
    const [dx, dy] = rng.pick(DIRS)
    const x = base.x + dx
    const y = base.y + dy
    const k = `${x},${y}`
    if (set.has(k)) continue
    const cells = [...set.values(), { x, y, c: 0 as const }]
    const w = Math.max(...cells.map((c) => c.x)) - Math.min(...cells.map((c) => c.x)) + 1
    const h = Math.max(...cells.map((c) => c.y)) - Math.min(...cells.map((c) => c.y)) + 1
    if (w > box || h > box) continue
    set.set(k, { x, y, c: 0 })
  }
  if (set.size < n) return null
  return normalize([...set.values()])
}

function paintAccent(rng: Rng, cells: Cell[], k: number): Cell[] {
  const idx = new Set(rng.sample(cells.map((_, i) => i), k))
  return cells.map((c, i) => ({ ...c, c: idx.has(i) ? 1 : 0 }))
}

function isConnected(cells: Cell[]): boolean {
  const keys = new Set(cells.map((c) => `${c.x},${c.y}`))
  const start = cells[0]
  const seen = new Set([`${start.x},${start.y}`])
  const stack = [start]
  while (stack.length) {
    const cur = stack.pop()!
    for (const [dx, dy] of DIRS) {
      const k = `${cur.x + dx},${cur.y + dy}`
      if (keys.has(k) && !seen.has(k)) {
        seen.add(k)
        stack.push({ x: cur.x + dx, y: cur.y + dy, c: 0 })
      }
    }
  }
  return seen.size === cells.length
}

/** Переставляет одну клетку фигуры так, чтобы она осталась связной. */
function moveOneCell(rng: Rng, cells: Cell[]): Cell[] | null {
  for (let t = 0; t < 40; t++) {
    const i = rng.int(0, cells.length - 1)
    const rest = cells.filter((_, j) => j !== i)
    const base = rng.pick(rest)
    const [dx, dy] = rng.pick(DIRS)
    const nx = base.x + dx
    const ny = base.y + dy
    if (cells.some((c) => c.x === nx && c.y === ny)) continue
    const next = [...rest, { x: nx, y: ny, c: cells[i].c }]
    if (isConnected(next)) return normalize(next)
  }
  return null
}

/** Перекрашивает одну акцентную клетку в другую позицию. */
function moveAccent(rng: Rng, cells: Cell[]): Cell[] | null {
  const accents = cells.map((c, i) => (c.c === 1 ? i : -1)).filter((i) => i >= 0)
  const plains = cells.map((c, i) => (c.c === 0 ? i : -1)).filter((i) => i >= 0)
  if (!accents.length || !plains.length) return null
  const from = rng.pick(accents)
  const to = rng.pick(plains)
  return cells.map((c, i) => (i === from ? { ...c, c: 0 } : i === to ? { ...c, c: 1 } : c))
}

const rotationsOf = (cells: Cell[]) => new Set([0, 1, 2, 3].map((k) => shapeKey(rot(cells, k))))

function sizeFor(rng: Rng, level: Level, boost: number) {
  const base = [7, 8, 9, 10, 11][level - 1] + rng.int(0, 1) + Math.min(boost, 3)
  return { n: base, box: level <= 2 ? 4 : 5, accents: level <= 2 ? 2 : 3 }
}

function finish(
  rng: Rng,
  correct: OptionContent,
  distractors: OptionContent[],
): { options: OptionContent[]; answer: number } {
  const all = rng.shuffle([correct, ...distractors])
  return { options: all, answer: all.indexOf(correct) }
}

function rotationTask(rng: Rng, level: Level, boost: number): TaskDraft | null {
  const { n, box, accents } = sizeFor(rng, level, boost)
  const plain = growPolyomino(rng, n, box)
  if (!plain) return null
  const ref = paintAccent(rng, plain, accents)
  const rots = rotationsOf(ref)
  const mir = mirrorX(ref)
  if (rots.has(shapeKey(mir))) return null
  const turn = rng.int(1, 3)
  const correct = rot(ref, turn)
  const total = level <= 2 ? 4 : 5
  const seen = new Set([shapeKey(correct)])
  const distractors: Cell[][] = []
  const push = (cells: Cell[] | null) => {
    if (!cells || distractors.length >= total - 1) return
    const k = shapeKey(cells)
    if (seen.has(k) || rots.has(k)) return
    seen.add(k)
    distractors.push(cells)
  }
  const mirTurns = rng.shuffle([0, 1, 2, 3])
  push(rot(mir, mirTurns[0]))
  if (level >= 3) {
    const moved = moveAccent(rng, ref)
    if (moved) push(rot(moved, rng.int(0, 3)))
  }
  push(rot(mir, mirTurns[1]))
  for (let t = 0; t < 30 && distractors.length < total - 1; t++) {
    const altered = rng.chance(0.5) ? moveOneCell(rng, ref) : moveAccent(rng, ref)
    if (altered) push(rot(altered, rng.int(0, 3)))
  }
  if (distractors.length < total - 1) return null
  const { options, answer } = finish(
    rng,
    { type: 'shape', cells: correct },
    distractors.map((cells) => ({ type: 'shape', cells })),
  )
  const angle = turn * 90
  return {
    category: 'spatial',
    kind: 'sp-rotate',
    kindLabel: 'Мысленное вращение',
    level,
    prompt: 'Какой из вариантов — эта же фигура, только повёрнутая? Переворачивать (отражать) фигуру нельзя.',
    visual: { type: 'shape', cells: ref },
    options,
    answer,
    explanation: `Правильная фигура — исходная, повёрнутая на ${angle === 270 ? '90° против часовой стрелки' : `${angle}° по часовой стрелке`}. Остальные варианты — зеркальные отражения или фигуры с другим расположением клеток: никаким поворотом их не совместить с исходной.`,
    signature: `sp-rot|${shapeKey(ref)}`,
  }
}

function mirrorTask(rng: Rng, level: Level, boost: number): TaskDraft | null {
  const { n, box, accents } = sizeFor(rng, level, boost)
  const plain = growPolyomino(rng, n, box)
  if (!plain) return null
  const ref = paintAccent(rng, plain, accents)
  const correct = mirrorX(ref)
  if (shapeKey(correct) === shapeKey(ref)) return null
  const total = level <= 2 ? 4 : 5
  const seen = new Set([shapeKey(correct)])
  const distractors: Cell[][] = []
  const push = (cells: Cell[] | null) => {
    if (!cells || distractors.length >= total - 1) return
    const k = shapeKey(cells)
    if (seen.has(k)) return
    seen.add(k)
    distractors.push(cells)
  }
  push(mirrorY(ref))
  push(rot(ref, 2))
  push(normalize(ref))
  push(rot(correct, 1))
  const moved = moveAccent(rng, correct)
  push(moved)
  for (let t = 0; t < 20 && distractors.length < total - 1; t++) push(moveOneCell(rng, correct))
  if (distractors.length < total - 1) return null
  const { options, answer } = finish(
    rng,
    { type: 'shape', cells: correct },
    distractors.map((cells) => ({ type: 'shape', cells })),
  )
  return {
    category: 'spatial',
    kind: 'sp-mirror',
    kindLabel: 'Зеркальное отражение',
    level,
    prompt: 'Справа от фигуры поставили зеркало. Какой вариант — её отражение в этом зеркале?',
    visual: { type: 'shape', cells: ref },
    options,
    answer,
    explanation:
      'При отражении в вертикальном зеркале левая и правая стороны меняются местами, а верх и низ остаются на своих местах. Цветные клетки тоже переходят на зеркальные позиции.',
    signature: `sp-mir|${shapeKey(ref)}`,
  }
}

// ── Узоры в сетке ───────────────────────────────────────────────────────

type Transform = 'cw' | 'ccw' | 'half' | 'mirror' | 'flip' | 'cw+mirror' | 'ccw+mirror' | 'id'

function applyTransform(dots: Dot[], size: number, t: Transform): Dot[] {
  const map = (i: number): number => {
    let x = i % size
    let y = Math.floor(i / size)
    const steps = t.split('+')
    for (const s of steps) {
      if (s === 'cw') [x, y] = [size - 1 - y, x]
      else if (s === 'ccw') [x, y] = [y, size - 1 - x]
      else if (s === 'half') [x, y] = [size - 1 - x, size - 1 - y]
      else if (s === 'mirror') x = size - 1 - x
      else if (s === 'flip') y = size - 1 - y
    }
    return y * size + x
  }
  return dots.map((d) => ({ i: map(d.i), c: d.c })).sort((a, b) => a.i - b.i)
}

const patternKey = (dots: Dot[]) =>
  dots
    .slice()
    .sort((a, b) => a.i - b.i)
    .map((d) => `${d.i}${d.c ? '*' : ''}`)
    .join(',')

const ALL_T: Transform[] = ['id', 'cw', 'ccw', 'half', 'mirror', 'flip', 'cw+mirror', 'ccw+mirror']

const T_TEXT: Record<Transform, string> = {
  id: 'остался без изменений',
  cw: 'повернули на 90° по часовой стрелке',
  ccw: 'повернули на 90° против часовой стрелки',
  half: 'повернули на 180°',
  mirror: 'отразили слева направо (как в зеркале)',
  flip: 'отразили сверху вниз',
  'cw+mirror': 'повернули на 90° по часовой стрелке, а затем отразили слева направо',
  'ccw+mirror': 'повернули на 90° против часовой стрелки, а затем отразили слева направо',
}

function randomDots(rng: Rng, size: number, k: number, twoColor: boolean): Dot[] {
  const idx = rng.sample(
    Array.from({ length: size * size }, (_, i) => i),
    k,
  )
  const accent = twoColor ? new Set(rng.sample(idx, Math.max(1, Math.floor(k / 3)))) : new Set<number>()
  return idx.map((i) => ({ i, c: accent.has(i) ? 1 : 0 } as Dot)).sort((a, b) => a.i - b.i)
}

function patternTask(rng: Rng, level: Level, boost: number): TaskDraft | null {
  const size = level >= 4 || boost > 1 ? 5 : 4
  const k = [5, 5, 6, 7, 8][level - 1] + rng.int(0, 1) + Math.min(boost, 2)
  const dots = randomDots(rng, size, k, level >= 2 || boost > 0 || rng.chance(0.5))
  const images = ALL_T.map((t) => patternKey(applyTransform(dots, size, t)))
  if (new Set(images).size < 8) return null
  const t: Transform =
    level === 1
      ? rng.pick(['cw', 'ccw'])
      : level === 2
        ? rng.pick(['cw', 'ccw', 'half'])
        : level === 3
          ? rng.pick(['cw', 'ccw', 'half', 'mirror'])
          : level === 4
            ? rng.pick(['cw', 'ccw', 'mirror', 'flip'])
            : rng.pick(['cw+mirror', 'ccw+mirror'])
  const correct = applyTransform(dots, size, t)
  const total = level <= 2 ? 4 : 5
  const confusers: Transform[] = rng.shuffle(ALL_T.filter((x) => x !== t && x !== 'id'))
  // Самые коварные ошибки — поворот не в ту сторону и отражение правильного ответа.
  const priority: Transform[] = t === 'cw' ? ['ccw', 'cw+mirror'] : t === 'ccw' ? ['cw', 'ccw+mirror'] : []
  const picked = [...new Set([...priority, ...confusers])].slice(0, total - 1)
  const { options, answer } = finish(
    rng,
    { type: 'pattern', size, dots: correct },
    picked.map((x) => ({ type: 'pattern', size, dots: applyTransform(dots, size, x) })),
  )
  return {
    category: 'spatial',
    kind: 'sp-pattern',
    kindLabel: 'Поворот узора',
    level,
    prompt: `Узор ${T_TEXT[t]}. Как он выглядит теперь?`,
    visual: { type: 'pattern', size, dots },
    options,
    answer,
    explanation: `Узор ${T_TEXT[t]}. Удобно следить за одной-двумя приметными точками (например, угловой или цветной) и проверить, куда они переходят.`,
    signature: `sp-pat|${size}|${t}|${patternKey(dots)}`,
  }
}

type OverlayMode = 'union' | 'mirror-union' | 'xor' | 'rotate-union'

function overlayTask(rng: Rng, level: Level, boost: number): TaskDraft | null {
  const size = 4
  const mode: OverlayMode = level <= 2 ? 'union' : level === 3 ? 'mirror-union' : level === 4 ? 'xor' : 'rotate-union'
  const k = [3, 4, 4, 5, 5][level - 1] + Math.min(boost, 2)
  const a = randomDots(rng, size, k, false)
  const b = randomDots(rng, size, k, false)
  const ia = new Set(a.map((d) => d.i))
  const combine = (m: OverlayMode): Dot[] => {
    const bb =
      m === 'mirror-union' ? applyTransform(b, size, 'mirror') : m === 'rotate-union' ? applyTransform(b, size, 'cw') : b
    const ib = new Set(bb.map((d) => d.i))
    const res = new Set<number>()
    for (const i of ia) if (m !== 'xor' || !ib.has(i)) res.add(i)
    for (const i of ib) if (m !== 'xor' || !ia.has(i)) res.add(i)
    return [...res].sort((x, y) => x - y).map((i) => ({ i, c: 0 }))
  }
  const correct = combine(mode)
  const overlapPlain = b.filter((d) => ia.has(d.i)).length
  if (mode === 'xor' && overlapPlain < 1) return null
  if (mode === 'union' && overlapPlain < 1) return null
  const total = level <= 2 ? 4 : 5
  const seen = new Set([patternKey(correct)])
  const distractors: Dot[][] = []
  const push = (d: Dot[]) => {
    const key = patternKey(d)
    if (seen.has(key) || distractors.length >= total - 1 || d.length === 0) return
    seen.add(key)
    distractors.push(d)
  }
  for (const m of rng.shuffle<OverlayMode>(['union', 'mirror-union', 'xor', 'rotate-union'])) push(combine(m))
  for (let t = 0; t < 30 && distractors.length < total - 1; t++) {
    const d = correct.slice()
    const drop = rng.int(0, d.length - 1)
    const free = Array.from({ length: size * size }, (_, i) => i).filter((i) => !d.some((x) => x.i === i))
    d.splice(drop, 1, { i: rng.pick(free), c: 0 })
    push(d.sort((x, y) => x.i - y.i))
  }
  if (distractors.length < total - 1) return null
  const { options, answer } = finish(
    rng,
    { type: 'pattern', size, dots: correct },
    distractors.map((dots) => ({ type: 'pattern', size, dots })),
  )
  const prompts: Record<OverlayMode, string> = {
    union: 'Две прозрачные карточки положили одна на другую. Что получится?',
    'mirror-union':
      'Правую прозрачную карточку перевернули как страницу книги (отразили слева направо) и положили на левую. Что получится?',
    xor: 'Две прозрачные карточки наложили друг на друга. Точки, которые совпали, исчезают. Что получится?',
    'rotate-union':
      'Правую прозрачную карточку повернули на 90° по часовой стрелке и положили на левую. Что получится?',
  }
  const explain: Record<OverlayMode, string> = {
    union: 'При наложении видны все точки обеих карточек; совпавшие точки сливаются в одну.',
    'mirror-union': 'Сначала правая карточка отражается слева направо, затем видны все точки обеих карточек.',
    xor: 'Остаются только точки, которые есть ровно на одной из карточек: совпавшие взаимно исчезают.',
    'rotate-union': 'Сначала правая карточка поворачивается на 90° по часовой стрелке, затем видны все точки обеих карточек.',
  }
  return {
    category: 'spatial',
    kind: `sp-overlay-${mode}`,
    kindLabel: 'Наложение карточек',
    level,
    prompt: prompts[mode],
    visual: { type: 'overlay', size, a, b },
    options,
    answer,
    explanation: explain[mode],
    signature: `sp-ov|${mode}|${patternKey(a)}|${patternKey(b)}`,
  }
}

export const spatialGenerator: Generator = (rng, level, boost) => {
  const subs =
    level === 1
      ? [rotationTask, patternTask, overlayTask]
      : level <= 3
        ? [rotationTask, mirrorTask, patternTask, overlayTask]
        : [rotationTask, patternTask, overlayTask]
  return firstThatWorks(
    rng,
    subs.map((sub) => () => sub(rng, level, boost)),
  )
}
