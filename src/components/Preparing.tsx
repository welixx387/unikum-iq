import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Clock, Fingerprint, ShieldCheck, SkipForward, Timer } from 'lucide-react'
import { buildTest } from '../engine/test'
import { shortId } from '../engine/hash'
import { CATEGORY_BY_ID } from '../engine/categories'
import { useTest } from '../store'
import { Button, CATEGORY_ICON, EASE } from './ui'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Экран сборки теста: показывает, как появляются и проверяются отпечатки. */
export function Preparing() {
  const { length, ready, quit } = useTest()
  const [ids, setIds] = useState<string[]>([])
  const [stage, setStage] = useState<'gen' | 'check' | 'error'>('gen')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ;(async () => {
      try {
        const collected: string[] = []
        const test = await buildTest(length, (_, __, uid) => collected.push(uid))
        // Сборка занимает миллисекунды — показываем её в человеческом темпе.
        const pace = reduce ? 0 : Math.max(18, 1400 / collected.length)
        for (let i = 0; i < collected.length; i++) {
          setIds(collected.slice(0, i + 1))
          if (pace) await sleep(pace)
        }
        setStage('check')
        await sleep(reduce ? 0 : 700)
        ready(test)
      } catch (e) {
        console.error(e)
        setStage('error')
      }
    })()
  }, [length, ready])

  const progress = ids.length / length
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center py-16 text-center">
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }, (_, i) => (
          <motion.span
            key={i}
            className="h-9 w-9 rounded-lg"
            style={{ background: i === 8 ? 'rgb(var(--saffron))' : 'rgb(var(--cobalt))' }}
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.9, 1, 0.9] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: ((i % 3) + Math.floor(i / 3)) * 0.12 }}
          />
        ))}
      </div>
      <h1 className="mt-8 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {stage === 'error' ? 'Не получилось собрать тест' : stage === 'check' ? 'Сверяем отпечатки' : 'Собираем ваши задания'}
      </h1>
      <p className="mt-2 text-muted">
        {stage === 'error'
          ? 'Попробуйте ещё раз — зерно генератора будет другим.'
          : stage === 'check'
            ? 'Ни одно из заданий раньше не выдавалось.'
            : `${ids.length} из ${length}`}
      </p>
      <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <motion.div className="h-full rounded-full bg-cobalt" animate={{ width: `${progress * 100}%` }} transition={{ ease: 'linear', duration: 0.1 }} />
      </div>
      <div className="mt-6 h-40 w-full overflow-hidden rounded-xl border border-line bg-surface/80 p-3 text-left font-mono text-[12px] text-muted [mask-image:linear-gradient(to_bottom,transparent,black_30%)]">
        <div className="flex flex-col-reverse gap-1">
          <AnimatePresence initial={false}>
            {ids.slice(-9).map((id, i, arr) => (
              <motion.div key={id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
                <Fingerprint size={13} className="text-saffron" />
                <span className="text-ink tabular">{shortId(id)}</span>
                <span className="text-faint">{id.slice(12, 24)}</span>
                <span className="ml-auto text-good">{i === arr.length - 1 && stage === 'gen' ? '…' : 'новое'}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      {stage === 'error' && (
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={quit}>
            На главную
          </Button>
        </div>
      )}
    </div>
  )
}

export function Briefing() {
  const { test, begin, quit } = useTest()
  if (!test) return null
  const counts = new Map<string, number>()
  for (const t of test.tasks) counts.set(t.category, (counts.get(t.category) ?? 0) + 1)
  const totalMin = Math.round(test.tasks.reduce((s, t) => s + t.timeLimit, 0) / 60)
  const rules = [
    { icon: Timer, text: 'У каждого задания свой таймер — от 45 секунд до 2,5 минуты. Когда время выходит, задание засчитывается как нерешённое.' },
    { icon: Check, text: 'Выбранный ответ можно менять, пока не нажата кнопка «Далее». Вернуться к прошлым заданиям нельзя.' },
    { icon: SkipForward, text: 'Если не знаете ответ, пропустите задание — наугад отвечать не обязательно.' },
    { icon: Clock, text: `Полный запас времени — около ${totalMin} мин, но обычно тест проходят быстрее. Прогресс сохраняется, если закрыть вкладку.` },
  ]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="mx-auto w-full max-w-2xl py-10"
    >
      <p className="eyebrow flex items-center gap-2">
        <ShieldCheck size={14} className="text-good" />
        {test.mode === 'global' ? 'Проверено по общему реестру' : 'Проверено по истории этого устройства'}
        {test.replaced > 0 && ` · заменено повторов: ${test.replaced}`}
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {test.tasks.length} новых заданий готовы
      </h1>
      <div className="mt-6 flex flex-wrap gap-2">
        {[...counts.entries()].map(([cat, n]) => {
          const Icon = CATEGORY_ICON[cat as keyof typeof CATEGORY_ICON]
          return (
            <span key={cat} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px]">
              <Icon size={14} className="text-cobalt" />
              {CATEGORY_BY_ID[cat as keyof typeof CATEGORY_BY_ID].title}
              <span className="font-mono text-faint">{n}</span>
            </span>
          )
        })}
      </div>
      <ul className="mt-8 flex flex-col gap-4">
        {rules.map((r, i) => (
          <li key={i} className="flex gap-3">
            <r.icon size={19} className="mt-0.5 shrink-0 text-saffron" />
            <span className="text-[15.5px]">{r.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-9 flex flex-wrap gap-3">
        <Button variant="primary" onClick={begin} className="px-7 py-3.5 text-base">
          Приступить <ArrowRight size={18} />
        </Button>
        <Button variant="ghost" onClick={quit}>
          Отмена
        </Button>
      </div>
      <p className="mt-6 font-mono text-[11px] text-faint break-all">зерно генератора: {test.seed}</p>
    </motion.div>
  )
}
