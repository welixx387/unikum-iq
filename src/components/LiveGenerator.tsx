import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Fingerprint } from 'lucide-react'
import { createRng, randomSeed } from '../engine/rng'
import { sampleTask } from '../engine/test'
import { shortId } from '../engine/hash'
import { CATEGORY_BY_ID } from '../engine/categories'
import type { CategoryId, Level, Task } from '../engine/types'
import { VisualView, OptionView } from './visuals/Visuals'
import { CATEGORY_ICON, LevelDots } from './ui'

const DEMO: [CategoryId, Level][] = [
  ['matrix', 3],
  ['sequence', 3],
  ['spatial', 2],
  ['quant', 3],
  ['matrix', 4],
  ['verbal', 3],
  ['spatial', 4],
  ['logic', 3],
]

/** Витрина на главной: каждые несколько секунд собирает новое задание. */
export function LiveGenerator() {
  const rng = useMemo(() => createRng(randomSeed()), [])
  const [step, setStep] = useState(0)
  const [count, setCount] = useState(1)
  const task: Task = useMemo(() => {
    const [cat, level] = DEMO[step % DEMO.length]
    return sampleTask(rng, cat, level)
  }, [rng, step])
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      setStep((s) => s + 1)
      setCount((c) => c + 1)
    }, 4200)
    return () => window.clearInterval(id)
  }, [])
  const Icon = CATEGORY_ICON[task.category]
  const showOptions = task.visual?.type === 'matrix' || !task.visual
  return (
    <div className="relative rounded-2xl border border-line bg-surface/90 p-5 backdrop-blur-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-good" />
          </span>
          Генератор в работе
        </span>
        <span className="font-mono text-[11px] text-faint tabular">собрано: {count}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={task.uid}
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
          transition={{ duration: 0.45 }}
          className="mt-4"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Icon size={15} className="text-cobalt" />
              {CATEGORY_BY_ID[task.category].title}
            </span>
            <LevelDots level={task.level} />
          </div>
          <p className="mt-2 text-[15px] text-muted">{task.prompt}</p>
          <div className="mt-4 flex min-h-[210px] items-center justify-center">
            {task.visual ? (
              <VisualView visual={task.visual} compact />
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                {task.options.map((o, i) => (
                  <span key={i} className="rounded-xl border border-line bg-raised px-3 py-2">
                    <OptionView option={o} small />
                  </span>
                ))}
              </div>
            )}
          </div>
          {showOptions && task.visual && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {task.options.slice(0, 6).map((o, i) => (
                <span key={i} className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-raised p-1">
                  <OptionView option={o} small />
                </span>
              ))}
            </div>
          )}
          <div className="mt-5 flex items-center gap-2 border-t border-line pt-4 font-mono text-[12px] text-muted">
            <Fingerprint size={15} className="text-saffron" />
            <span>отпечаток</span>
            <span className="text-ink tabular">{shortId(task.uid)}</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
