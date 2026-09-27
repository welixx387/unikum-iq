import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { BuiltTest } from './engine/test'
import type { AnswerRecord, AnswerStatus } from './engine/types'

export type Phase = 'landing' | 'preparing' | 'briefing' | 'test' | 'results'

export interface HistoryEntry {
  at: number
  iq: number
  correct: number
  total: number
}

interface State {
  phase: Phase
  length: number
  test: BuiltTest | null
  index: number
  answers: AnswerRecord[]
  selected: number | null
  startedAt: number | null
  history: HistoryEntry[]
  setLength: (n: number) => void
  prepare: () => void
  ready: (test: BuiltTest) => void
  begin: () => void
  select: (i: number) => void
  commit: (status?: Exclude<AnswerStatus, 'correct' | 'wrong'>) => void
  saveResult: (entry: HistoryEntry) => void
  quit: () => void
}

const safeStorage = createJSONStorage(() => {
  try {
    const k = '__iq_probe__'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return localStorage
  } catch {
    const mem = new Map<string, string>()
    return {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, v: string) => void mem.set(key, v),
      removeItem: (key: string) => void mem.delete(key),
    }
  }
})

export const useTest = create<State>()(
  persist(
    (set, get) => ({
      phase: 'landing',
      length: 35,
      test: null,
      index: 0,
      answers: [],
      selected: null,
      startedAt: null,
      history: [],
      setLength: (length) => set({ length }),
      prepare: () => set({ phase: 'preparing', test: null, answers: [], index: 0, selected: null, startedAt: null }),
      ready: (test) => set((s) => (s.phase === 'preparing' ? { phase: 'briefing', test } : {})),
      begin: () => set({ phase: 'test', index: 0, answers: [], selected: null, startedAt: Date.now() }),
      select: (i) => set({ selected: i }),
      commit: (forced) => {
        const { test, index, selected, answers, startedAt } = get()
        if (!test) return
        const task = test.tasks[index]
        const timeMs = Math.min(task.timeLimit * 1000, Date.now() - (startedAt ?? Date.now()))
        const choice = forced === 'skipped' ? null : selected
        const status: AnswerStatus =
          forced === 'skipped'
            ? 'skipped'
            : forced === 'timeout' && choice === null
              ? 'timeout'
              : choice === task.answer
                ? 'correct'
                : 'wrong'
        const next = [...answers]
        next[index] = { choice, status, timeMs }
        const done = index + 1 >= test.tasks.length
        set({
          answers: next,
          index: done ? index : index + 1,
          selected: null,
          startedAt: done ? null : Date.now(),
          phase: done ? 'results' : 'test',
        })
      },
      saveResult: (entry) => {
        const { history } = get()
        if (history.some((h) => h.at === entry.at)) return
        set({ history: [entry, ...history].slice(0, 12) })
      },
      quit: () => set({ phase: 'landing', test: null, answers: [], index: 0, selected: null, startedAt: null }),
    }),
    {
      name: 'iq-unikum:state',
      storage: safeStorage,
      version: 1,
      // Экран подготовки не сохраняем: после перезагрузки начнём заново.
      partialize: (s) => ({
        phase: s.phase === 'preparing' ? 'landing' : s.phase,
        length: s.length,
        test: s.phase === 'preparing' ? null : s.test,
        index: s.index,
        answers: s.answers,
        selected: s.selected,
        startedAt: s.startedAt,
        history: s.history,
      }),
    },
  ),
)
