import { useEffect, useMemo, useState } from 'react'
import { animate, motion } from 'framer-motion'
import { Copy, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react'
import { CATEGORY_BY_ID } from '../engine/categories'
import { analyze } from '../engine/scoring'
import { useTest } from '../store'
import { BellCurve } from './charts/BellCurve'
import { CategoryBars, LevelColumns } from './charts/Bars'
import { Review } from './Review'
import { Button, EASE, formatDuration } from './ui'

function useCountUp(target: number, duration = 1.6) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target)
      return
    }
    const c = animate(0, target, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => setV(Math.round(x)) })
    return () => c.stop()
  }, [target, duration])
  return v
}

function percentileText(p: number) {
  if (p >= 99.5) return 'выше, чем у 99,5% людей'
  if (p < 1) return 'ниже, чем у 99% людей'
  return `выше, чем у ${Math.round(p)}% людей`
}

export function Results() {
  const { test, answers, prepare, quit, saveResult } = useTest()
  const a = useMemo(() => (test ? analyze(test.tasks, answers) : null), [test, answers])
  const shown = useCountUp(a?.iq ?? 0)
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    if (test && a) saveResult({ at: test.createdAt, iq: a.iq, correct: a.correct, total: a.total })
  }, [test, a, saveResult])

  if (!test || !a) return null

  const summary = `Мой результат в тесте «Уникум IQ»: ${a.iq} ± ${a.iqSe} (${a.band.label.toLowerCase()}, ${percentileText(a.percentile)}). Верно ${a.correct} из ${a.total}, задания были уникальными.`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
    window.setTimeout(() => setCopied('idle'), 2500)
  }

  const paceText =
    a.pace === 'fast'
      ? `Вы отвечали быстро — в среднем ${formatDuration(a.avgTimeMs)} на задание. Если ошибки пришлись на трудные задания, дайте себе на них чуть больше времени: запас был.`
      : a.pace === 'slow'
        ? `Вы работали вдумчиво — в среднем ${formatDuration(a.avgTimeMs)} на задание, используя большую часть отведённого времени.`
        : `Темп ровный: в среднем ${formatDuration(a.avgTimeMs)} на задание.`

  return (
    <div className="mx-auto w-full max-w-5xl pb-20">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="rounded-2xl border border-line bg-surface/95 p-5 sm:p-8"
      >
        <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-end md:gap-10">
          <div>
            <p className="eyebrow">Ваш IQ</p>
            <div className="mt-2 flex items-end gap-3">
              <span className="font-display text-[5.5rem] font-semibold leading-[0.9] tracking-[-0.04em] sm:text-[7rem]">{shown}</span>
              <span className="mb-2 font-mono text-lg text-muted">± {a.iqSe}</span>
            </div>
          </div>
          <div className="md:pb-2">
            <span className="inline-flex rounded-full bg-saffron-soft px-3 py-1 text-[13px] font-semibold text-saffron">{a.band.label}</span>
            <p className="mt-3 text-[17px]">
              Результат <strong>{percentileText(a.percentile)}</strong>. {a.band.note}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <BellCurve iq={a.iq} se={a.iqSe} />
        </div>
      </motion.section>

      <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Верных ответов', `${a.correct} из ${a.total}`],
          ['Точность', `${Math.round((a.correct / a.total) * 100)}%`],
          ['В среднем на задание', formatDuration(a.avgTimeMs)],
          ['Время теста', formatDuration(a.totalTimeMs)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface/90 px-4 py-4">
            <div className="text-[13px] text-muted">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="rounded-2xl border border-line bg-surface/95 p-5 sm:p-7">
          <h2 className="font-display text-xl font-semibold tracking-tight">Профиль способностей</h2>
          <p className="mt-1 text-[14px] text-muted">Доля верных ответов в каждой из шести категорий.</p>
          <div className="mt-6">
            <CategoryBars stats={a.categories} strengths={a.strengths} weaknesses={a.weaknesses} />
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface/95 p-5 sm:p-7">
          <h2 className="font-display text-xl font-semibold tracking-tight">По сложности</h2>
          <p className="mt-1 text-[14px] text-muted">Доля верных ответов на каждом уровне — от 1 (простые) до 5.</p>
          <div className="mt-6">
            <LevelColumns levels={a.levels} />
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface/95 p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold tracking-tight">Разбор результата</h2>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-good">
              <TrendingUp size={18} /> Получилось хорошо
            </h3>
            {a.strengths.length ? (
              <ul className="mt-3 flex flex-col gap-3">
                {a.strengths.map((id) => {
                  const s = a.categories.find((c) => c.id === id)!
                  return (
                    <li key={id} className="text-[15px]">
                      <span className="font-semibold">{CATEGORY_BY_ID[id].title}</span>{' '}
                      <span className="text-muted">({s.correct} из {s.total}).</span> {CATEGORY_BY_ID[id].strong}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-3 text-[15px] text-muted">
                Ярко выраженных сильных сторон в этот раз нет — результаты по категориям близки друг к другу.
              </p>
            )}
          </div>
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-saffron">
              <TrendingDown size={18} /> Над чем поработать
            </h3>
            {a.weaknesses.length ? (
              <ul className="mt-3 flex flex-col gap-3">
                {a.weaknesses.map((id) => {
                  const s = a.categories.find((c) => c.id === id)!
                  return (
                    <li key={id} className="text-[15px]">
                      <span className="font-semibold">{CATEGORY_BY_ID[id].title}</span>{' '}
                      <span className="text-muted">({s.correct} из {s.total}).</span> {CATEGORY_BY_ID[id].weak}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-3 text-[15px] text-muted">Слабых мест не обнаружено: во всех категориях вы решили большую часть заданий.</p>
            )}
          </div>
        </div>
        <p className="mt-6 border-t border-line pt-5 text-[15px] text-muted">
          {paceText}
          {a.timeouts > 0 && ` Время вышло в ${a.timeouts} ${a.timeouts === 1 ? 'задании' : 'заданиях'}.`}
          {a.skipped > 0 && ` Пропущено: ${a.skipped}.`}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Все задания с ответами</h2>
        <p className="mt-1 mb-5 text-[14px] text-muted">
          Нажмите на задание, чтобы увидеть условие, ваш ответ, верный ответ и объяснение.
        </p>
        <Review tasks={test.tasks} answers={answers} />
      </section>

      <section className="mt-10 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={prepare} className="px-6">
          <RotateCcw size={17} /> Пройти с новыми заданиями
        </Button>
        <Button variant="secondary" onClick={copy}>
          <Copy size={16} /> {copied === 'ok' ? 'Скопировано' : 'Скопировать результат'}
        </Button>
        <Button variant="ghost" onClick={quit}>
          На главную
        </Button>
        {copied === 'fail' && (
          <textarea
            id="result-text"
            readOnly
            value={summary}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-2 w-full rounded-xl border border-line bg-raised p-3 text-[14px]"
            rows={3}
            autoFocus
          />
        )}
      </section>
      <p className="mt-8 text-[13px] text-faint">
        Оценка ориентировочная: это онлайн-тест из {a.total} заданий, а не клиническое обследование. Погрешность ±{a.iqSe} —
        стандартная ошибка оценки по модели IRT.
      </p>
    </div>
  )
}
