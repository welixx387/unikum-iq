export type CategoryId = 'sequence' | 'matrix' | 'spatial' | 'logic' | 'verbal' | 'quant'
export type Level = 1 | 2 | 3 | 4 | 5

// ── Фигуры для матриц ───────────────────────────────────────────────────
export type ShapeKind =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'cross'
  | 'arrow'
export type FillKind = 'outline' | 'solid' | 'striped'
/** 0 — основной цвет текста, 1 — кобальт, 2 — шафран */
export type PaintIndex = 0 | 1 | 2

export interface Figure {
  shape: ShapeKind
  count: number
  size: 0 | 1 | 2
  fill: FillKind
  color: PaintIndex
  rotation: number
}

// ── Клетчатые фигуры и узоры ────────────────────────────────────────────
/** Клетка полимино: x, y и цвет (0 — основной, 1 — акцентный) */
export interface Cell {
  x: number
  y: number
  c: 0 | 1
}

/** Точка узора в сетке size×size: индекс клетки и цвет */
export interface Dot {
  i: number
  c: 0 | 1
}

export type EqToken =
  | { t: 'sym'; s: number }
  | { t: 'op'; v: string }
  | { t: 'num'; v: number }
  | { t: 'q' }

export type Visual =
  | { type: 'sequence'; items: (string | null)[] }
  | { type: 'matrix'; cells: (Figure | null)[] }
  | { type: 'numberGrid'; cells: (number | null)[] }
  | { type: 'shape'; cells: Cell[] }
  | { type: 'pattern'; size: number; dots: Dot[]; caption?: string }
  | { type: 'overlay'; size: number; a: Dot[]; b: Dot[] }
  | { type: 'equations'; lines: EqToken[][] }
  | { type: 'premises'; lines: string[] }
  | { type: 'cipher'; examples: [string, string][]; query: string }

export type OptionContent =
  | { type: 'text'; value: string }
  | { type: 'figure'; figure: Figure }
  | { type: 'shape'; cells: Cell[] }
  | { type: 'pattern'; size: number; dots: Dot[] }

/** Задание до присвоения отпечатка — то, что возвращает генератор. */
export interface TaskDraft {
  category: CategoryId
  kind: string
  kindLabel: string
  level: Level
  prompt: string
  /** Короткое пояснение к условию, показывается под вопросом */
  hint?: string
  visual?: Visual
  showAlphabet?: boolean
  options: OptionContent[]
  answer: number
  explanation: string
  /** Каноническая суть задачи — из неё строится отпечаток. */
  signature: string
}

export interface Task extends Omit<TaskDraft, 'signature'> {
  uid: string
  timeLimit: number
}

export type Generator = (rng: import('./rng').Rng, level: Level, boost: number) => TaskDraft

export type AnswerStatus = 'correct' | 'wrong' | 'skipped' | 'timeout'

export interface AnswerRecord {
  choice: number | null
  status: AnswerStatus
  timeMs: number
}
