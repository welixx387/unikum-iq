import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, SkipForward, Timer, X } from 'lucide-react'
import { CATEGORY_BY_ID } from '../engine/categories'
import { shortId } from '../engine/hash'
import type { AnswerRecord, AnswerStatus, Task } from '../engine/types'
import { AlphabetStrip, OptionView, VisualView } from './visuals/Visuals'
import { LevelDots } from './ui'
import { OPTION_LETTERS } from './TestScreen'

type Filter = 'all' | 'wrong' | 'correct' | 'skipped'

const STATUS: Record<AnswerStatus, { icon: typeof Check; label: string; cls: string }> = {
  correct: { icon: Check, label: 'Верно', cls: 'bg-good-soft text-good' },
  wrong: { icon: X, label: 'Ошибка', cls: 'bg-bad-soft text-bad' },
  skipped: { icon: SkipForward, label: 'Пропущено', cls: 'bg-raised text-muted' },
  timeout: { icon: Timer, label: 'Время вышло', cls: 'bg-raised text-muted' },
}

function ReviewItem({ task, answer, n, defaultOpen }: { task: Task; answer: AnswerRecord; n: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const st = STATUS[answer.status]
  const isFigure = task.options[0]?.type === 'figure'
  return (
    <li className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left"
      >
        <span className="w-7 font-mono text-[13px] text-faint tabular">{n}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${st.cls}`}>
          <st.icon size={13} /> {st.label}
        </span>
        <span className="text-[14px] font-medium">{CATEGORY_BY_ID[task.category].short}</span>
        <span className="hidden text-[13px] text-muted sm:inline">{task.kindLabel}</span>
        <span className="ml-auto flex items-center gap-3">
          <LevelDots level={task.level} />
          <span className="w-10 text-right font-mono text-[12px] text-muted tabular">{Math.round(answer.timeMs / 1000)} с</span>
          <ChevronDown size={16} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-4 pb-5 pt-4">
              <p className="font-medium">{task.prompt}</p>
              {task.hint && <p className="mt-1 text-[13px] text-muted">{task.hint}</p>}
              {task.visual && (
                <div className="mt-4">
                  <VisualView visual={task.visual} compact />
                </div>
              )}
              {task.showAlphabet && (
                <div className="mt-3">
                  <AlphabetStrip />
                </div>
              )}
              <div className={`mt-4 grid gap-2 ${isFigure ? 'grid-cols-4 sm:grid-cols-8' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
                {task.options.map((o, i) => {
                  const right = i === task.answer
                  const mine = i === answer.choice
                  return (
                    <div
                      key={i}
                      className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 pb-2 pt-4 text-center ${
                        right ? 'border-good bg-good-soft/60' : mine ? 'border-bad bg-bad-soft/60' : 'border-line bg-raised'
                      }`}
                    >
                      <span className="absolute left-1.5 top-1 font-mono text-[10px] text-faint">{OPTION_LETTERS[i]}</span>
                      <OptionView option={o} small />
                      {(right || mine) && (
                        <span className={`text-[10.5px] font-semibold ${right ? 'text-good' : 'text-bad'}`}>
                          {right && mine ? 'ваш ответ ✓' : right ? 'верный' : 'ваш ответ'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 rounded-lg bg-cobalt-soft/60 px-4 py-3 text-[14.5px]">
                <span className="font-semibold text-cobalt">Разбор. </span>
                {task.explanation}
              </div>
              <p className="mt-3 font-mono text-[11px] text-faint">отпечаток {shortId(task.uid)} · {task.uid}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

export function Review({ tasks, answers }: { tasks: Task[]; answers: AnswerRecord[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const counts = useMemo(
    () => ({
      all: tasks.length,
      wrong: answers.filter((a) => a?.status === 'wrong').length,
      correct: answers.filter((a) => a?.status === 'correct').length,
      skipped: answers.filter((a) => a?.status === 'skipped' || a?.status === 'timeout').length,
    }),
    [tasks, answers],
  )
  const firstWrong = answers.findIndex((a) => a?.status === 'wrong')
  const items = tasks
    .map((t, i) => ({ t, a: answers[i], i }))
    .filter(({ a }) => a)
    .filter(({ a }) =>
      filter === 'all' ? true : filter === 'skipped' ? a.status === 'skipped' || a.status === 'timeout' : a.status === filter,
    )
  const TABS: [Filter, string][] = [
    ['all', 'Все'],
    ['wrong', 'Ошибки'],
    ['correct', 'Верные'],
    ['skipped', 'Без ответа'],
  ]
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Фильтр заданий">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              filter === id ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-muted hover:text-ink'
            }`}
          >
            {label} <span className="font-mono opacity-70">{counts[id]}</span>
          </button>
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {items.map(({ t, a, i }) => (
          <ReviewItem key={t.uid} task={t} answer={a} n={i + 1} defaultOpen={i === firstWrong && filter !== 'correct'} />
        ))}
        {items.length === 0 && <li className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-muted">Здесь пусто.</li>}
      </ul>
    </div>
  )
}
