import { motion } from 'framer-motion'
import { ArrowRight, Fingerprint, ShieldCheck, Sigma, Sparkles } from 'lucide-react'
import { CATEGORIES } from '../engine/categories'
import { globalRegistryEnabled } from '../engine/registry'
import { TEST_LENGTHS } from '../engine/test'
import { useTest } from '../store'
import { LiveGenerator } from './LiveGenerator'
import { Button, CATEGORY_ICON, EASE } from './ui'

const STEPS = [
  {
    icon: Sparkles,
    title: 'Генерация',
    text: 'В момент старта алгоритм собирает задания из случайного 128‑битного зерна: числа, фигуры, слова и правила каждый раз новые.',
  },
  {
    icon: Fingerprint,
    title: 'Проверка отпечатка',
    text: 'У каждого задания есть цифровой отпечаток его содержания. Если такое задание уже кому‑то выдавалось, оно заменяется новым.',
  },
  {
    icon: Sigma,
    title: 'Оценка по IRT',
    text: 'Результат считается по модели Item Response Theory: трудные задания весят больше, угадывание учитывается. Итог — на шкале IQ со средним 100 и σ = 15.',
  },
]

export function Landing() {
  const { length, setLength, prepare, history } = useTest()
  return (
    <div className="mx-auto w-full max-w-6xl">
      <section className="grid items-center gap-10 pb-12 pt-6 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:pt-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          <p className="eyebrow">Тест интеллекта · 25–50 заданий · 6 способностей</p>
          <h1 className="mt-4 font-display text-[2.15rem] font-semibold leading-[1.06] tracking-[-0.02em] sm:text-5xl lg:text-[3.4rem]">
            Задания, которых <span className="text-cobalt">ещё никто</span> не видел
          </h1>
          <p className="mt-5 max-w-[34rem] text-[17px] text-muted">
            Каждый вопрос собирается алгоритмом в момент старта. У вас, у вашего друга и у тысячного участника — разные
            задачи, поэтому ответы нельзя подсмотреть или выучить.
          </p>

          <fieldset className="mt-8">
            <legend className="eyebrow mb-3">Длина теста</legend>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {TEST_LENGTHS.map((t) => {
                const active = t.count === length
                return (
                  <label
                    key={t.count}
                    className={`relative cursor-pointer rounded-xl border px-3 py-3 transition-colors sm:px-4 ${
                      active ? 'border-cobalt bg-cobalt-soft/70' : 'border-line bg-surface hover:border-cobalt/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="length"
                      id={`length-${t.count}`}
                      className="sr-only"
                      checked={active}
                      onChange={() => setLength(t.count)}
                    />
                    <span className="block font-display text-2xl font-semibold tabular">{t.count}</span>
                    <span className="mt-0.5 block text-[13px] font-medium">{t.title}</span>
                    <span className="block text-[12px] text-muted">≈ {t.minutes} мин</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button variant="primary" onClick={prepare} className="px-7 py-3.5 text-base">
              Начать тест <ArrowRight size={18} />
            </Button>
            <span className="flex items-center gap-2 text-[13px] text-muted">
              <ShieldCheck size={16} className={globalRegistryEnabled ? 'text-good' : 'text-cobalt'} />
              {globalRegistryEnabled
                ? 'Уникальность сверяется с общим реестром заданий'
                : 'Повторы на этом устройстве исключены'}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, rotate: 1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
        >
          <LiveGenerator />
        </motion.div>
      </section>

      <section className="border-t border-line py-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Шесть способностей</h2>
        <p className="mt-2 max-w-2xl text-muted">
          Задания поровну распределены между шестью видами мышления и идут от простых к трудным. В конце вы увидите, в чём
          сильны, а что стоит потренировать.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c, i) => {
            const Icon = CATEGORY_ICON[c.id]
            return (
              <motion.div
                key={c.id}
                initial={{ y: 12 }}
                animate={{ y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.45, ease: EASE }}
                className="rounded-xl border border-line bg-surface/80 p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cobalt-soft text-cobalt">
                    <Icon size={18} />
                  </span>
                  <h3 className="font-semibold">{c.title}</h3>
                </div>
                <p className="mt-3 text-[14.5px] text-muted">{c.measures}</p>
              </motion.div>
            )
          })}
        </div>
      </section>

      <section className="border-t border-line py-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Как это устроено</h2>
        <ol className="mt-7 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-3">
              <span className="flex items-center gap-3">
                <span className="font-mono text-[12px] text-faint">{i + 1} / 3</span>
                <s.icon size={18} className="text-saffron" />
              </span>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-[15px] text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {history.length > 0 && (
        <section className="border-t border-line py-12">
          <h2 className="font-display text-xl font-semibold tracking-tight">Ваши прошлые попытки</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[14px]">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-medium">Дата</th>
                  <th className="py-2 pr-4 font-medium">IQ</th>
                  <th className="py-2 font-medium">Верных ответов</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {history.map((h) => (
                  <tr key={h.at} className="border-b border-line/60">
                    <td className="py-2 pr-4">{new Date(h.at).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className="py-2 pr-4 font-semibold">{h.iq}</td>
                    <td className="py-2">
                      {h.correct} из {h.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="border-t border-line py-8 text-[13px] text-faint">
        Уникум IQ — развлекательный онлайн-тест, а не клиническая диагностика. Результат ориентировочный: он зависит от
        усталости, спешки и привычки к таким задачам.
      </footer>
    </div>
  )
}
