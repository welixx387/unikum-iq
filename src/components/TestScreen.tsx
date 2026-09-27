import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Fingerprint, LogOut, SkipForward } from 'lucide-react'
import { CATEGORY_BY_ID } from '../engine/categories'
import { shortId } from '../engine/hash'
import type { Task } from '../engine/types'
import { useTest } from '../store'
import { AlphabetStrip, OptionView, VisualView } from './visuals/Visuals'
import { Button, CATEGORY_ICON, EASE, LevelDots } from './ui'

export const OPTION_LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З']

function useRemaining(task: Task | undefined, startedAt: number | null) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [])
  if (!task || !startedAt) return { left: 0, frac: 1 }
  const left = Math.max(0, task.timeLimit - (now - startedAt) / 1000)
  return { left, frac: Math.min(1, left / task.timeLimit) }
}

function TimerRing({ left, frac }: { left: number; frac: number }) {
  const R = 17
  const C = 2 * Math.PI * R
  const urgent = left <= 10
  const s = Math.ceil(left)
  return (
    <div className="relative flex h-12 w-12 items-center justify-center" role="timer" aria-label={`Осталось ${s} секунд`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={R} fill="none" strokeWidth="3" style={{ stroke: 'rgb(var(--line))' }} />
        <circle
          cx="20"
          cy="20"
          r={R}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          style={{ stroke: urgent ? 'rgb(var(--bad))' : 'rgb(var(--cobalt))', transition: 'stroke-dashoffset 0.2s linear' }}
        />
      </svg>
      <span className={`font-mono text-[13px] font-medium tabular ${urgent ? 'text-bad' : 'text-ink'}`}>
        {s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : s}
      </span>
    </div>
  )
}

function optionGridClass(task: Task) {
  const t = task.options[0]?.type
  const n = task.options.length
  if (t === 'figure') return n > 6 ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-6'
  if (t === 'shape' || t === 'pattern') return n > 4 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'
  const long = task.options.some((o) => o.type === 'text' && o.value.length > 14)
  if (long) return 'grid-cols-1 sm:grid-cols-2'
  return n > 4 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'
}

export function TestScreen() {
  const { test, index, selected, startedAt, select, commit, quit } = useTest()
  const task = test?.tasks[index]
  const { left, frac } = useRemaining(task, startedAt)
  const [confirmExit, setConfirmExit] = useState(false)

  useEffect(() => {
    if (task && startedAt && left <= 0) commit('timeout')
  }, [left, task, startedAt, commit])

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (!task || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const n = Number(e.key)
      if (n >= 1 && n <= task.options.length) {
        select(n - 1)
        e.preventDefault()
      } else if (e.key === 'Enter' && selected !== null) {
        commit()
        e.preventDefault()
      }
    },
    [task, selected, select, commit],
  )
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  if (!test || !task) return null
  const Icon = CATEGORY_ICON[task.category]
  const total = test.tasks.length
  const isFigure = task.options[0]?.type === 'figure'

  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-4 mb-5 bg-bg/85 px-4 pb-3 pt-3 backdrop-blur-md sm:mx-0 sm:rounded-b-2xl sm:px-0">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[13px] text-muted tabular">
                Задание <span className="text-ink">{index + 1}</span> из {total}
              </span>
              <span className="hidden font-mono text-[12px] text-faint sm:inline">
                клавиши 1–{task.options.length} и Enter
              </span>
            </div>
            <div className="mt-2 flex gap-[3px]">
              {test.tasks.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${i < index ? 'bg-cobalt' : i === index ? 'bg-saffron' : 'bg-line'}`}
                />
              ))}
            </div>
          </div>
          <TimerRing left={left} frac={frac} />
          <button
            type="button"
            onClick={() => setConfirmExit(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-raised hover:text-ink"
            aria-label="Прервать тест"
          >
            <LogOut size={18} />
          </button>
        </div>
        <AnimatePresence>
          {confirmExit && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-[14px]">
                <span className="flex-1">Прервать тест? Ответы не сохранятся, а эти задания больше не встретятся.</span>
                <Button variant="ghost" className="px-3 py-2" onClick={() => setConfirmExit(false)}>
                  Продолжить
                </Button>
                <Button variant="primary" className="px-3 py-2" onClick={quit}>
                  Прервать
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.article
          key={task.uid}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="rounded-2xl border border-line bg-surface/95 p-5 sm:p-8"
        >
          <header className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cobalt-soft px-3 py-1 font-medium text-cobalt">
              <Icon size={14} />
              {CATEGORY_BY_ID[task.category].title}
            </span>
            <span className="inline-flex items-center gap-2 text-muted">
              Сложность <LevelDots level={task.level} />
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[12px] text-faint" title="Цифровой отпечаток задания">
              <Fingerprint size={13} />
              {shortId(task.uid)}
            </span>
          </header>

          <h2
            className={`mt-5 ${
              task.prompt.length > 110 ? 'text-[17px] font-medium leading-relaxed sm:text-[18px]' : 'text-[19px] font-semibold leading-snug sm:text-[21px]'
            }`}
          >
            {task.prompt}
          </h2>
          {task.hint && <p className="mt-1.5 text-[14px] text-muted">{task.hint}</p>}

          {task.visual && (
            <div className="mt-6">
              <VisualView visual={task.visual} />
            </div>
          )}
          {task.showAlphabet && (
            <div className="mt-5">
              <AlphabetStrip />
            </div>
          )}

          <div role="radiogroup" aria-label="Варианты ответа" className={`mt-7 grid gap-2.5 ${optionGridClass(task)}`}>
            {task.options.map((o, i) => {
              const active = selected === i
              return (
                <motion.button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => select(i)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.04, duration: 0.3 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className={`relative flex items-center justify-center rounded-xl border-2 px-3 text-center transition-colors ${
                    isFigure ? 'aspect-square p-1.5' : 'min-h-[64px] py-3'
                  } ${active ? 'border-cobalt bg-cobalt-soft' : 'border-line bg-raised hover:border-cobalt/40'}`}
                >
                  <span
                    className={`absolute left-2 top-1.5 font-mono text-[11px] ${active ? 'text-cobalt' : 'text-faint'}`}
                    aria-hidden="true"
                  >
                    {OPTION_LETTERS[i]}
                  </span>
                  <OptionView option={o} />
                </motion.button>
              )
            })}
          </div>

          <footer className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <Button variant="ghost" onClick={() => commit('skipped')}>
              <SkipForward size={16} /> Не знаю, пропустить
            </Button>
            <Button variant="primary" disabled={selected === null} onClick={() => commit()} className="w-full px-7 sm:w-auto">
              {index + 1 === total ? 'Завершить' : 'Далее'} <ArrowRight size={17} />
            </Button>
          </footer>
        </motion.article>
      </AnimatePresence>
    </div>
  )
}
