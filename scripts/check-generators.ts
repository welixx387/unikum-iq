// Самопроверка генераторов: запускается `npm run check`.
// Генерирует тысячи заданий каждого типа и уровня и проверяет, что
// варианты ответов корректны, текст не содержит мусора, а отпечатки
// почти не совпадают даже внутри огромной выборки.
import { GENERATORS } from '../src/engine/generators'
import { fingerprint, planTest } from '../src/engine/test'
import { createRng, randomSeed } from '../src/engine/rng'
import { analyze } from '../src/engine/scoring'
import type { AnswerRecord, CategoryId, Level, OptionContent, Task } from '../src/engine/types'

const PER_LEVEL = Number(process.env.PER_LEVEL ?? 2000)
const rng = createRng(randomSeed())
let failures = 0

const optionKey = (o: OptionContent) => JSON.stringify(o)
const BAD = /undefined|NaN|null|\[object/

for (const [cat, gen] of Object.entries(GENERATORS) as [CategoryId, (typeof GENERATORS)[CategoryId]][]) {
  for (const level of [1, 2, 3, 4, 5] as Level[]) {
    const fps = new Set<string>()
    const kinds = new Map<string, number>()
    const answerPos = new Map<number, number>()
    let dup = 0
    const dupKinds = new Map<string, number>()
    const started = performance.now()
    for (let i = 0; i < PER_LEVEL; i++) {
      let d
      try {
        d = gen(rng, level, 0)
      } catch (e) {
        failures++
        console.error(`✗ ${cat} L${level}: исключение`, (e as Error).message)
        continue
      }
      kinds.set(d.kind, (kinds.get(d.kind) ?? 0) + 1)
      answerPos.set(d.answer, (answerPos.get(d.answer) ?? 0) + 1)
      const fp = fingerprint(d)
      if (fps.has(fp)) {
        dup++
        dupKinds.set(d.kind, (dupKinds.get(d.kind) ?? 0) + 1)
      }
      fps.add(fp)
      const problems: string[] = []
      if (d.options.length < 3) problems.push(`мало вариантов: ${d.options.length}`)
      if (d.answer < 0 || d.answer >= d.options.length) problems.push(`неверный индекс ответа ${d.answer}`)
      if (new Set(d.options.map(optionKey)).size !== d.options.length) problems.push('повторяющиеся варианты')
      const text = [d.prompt, d.explanation, JSON.stringify(d.visual ?? {}), JSON.stringify(d.options)].join(' ')
      if (BAD.test(d.prompt + d.explanation + JSON.stringify(d.options))) problems.push('мусор в тексте')
      if (/-?\d+\.\d{3,}/.test(text)) problems.push('длинная дробь в тексте')
      if (problems.length) {
        failures++
        if (failures < 30) console.error(`✗ ${cat} L${level} ${d.kind}: ${problems.join('; ')}\n  ${d.prompt}\n  ${JSON.stringify(d.options)}`)
      }
    }
    const ms = (performance.now() - started) / PER_LEVEL
    console.log(
      `${cat.padEnd(9)} L${level}  дубли ${String(dup).padStart(4)} / ${PER_LEVEL}  ${ms.toFixed(2)} мс/шт  ответы ${[...answerPos.entries()].sort().map(([k, v]) => `${k}:${v}`).join(' ')}  типы ${[...kinds.entries()].map(([k, v]) => `${k}×${v}`).join(', ')}${dupKinds.size ? `\n    дубли по типам: ${[...dupKinds.entries()].map(([k, v]) => `${k}:${v}`).join(', ')}` : ''}`,
    )
  }
}

// Шкала: всё верно / всё неверно / случайные ответы.
for (const n of [25, 35, 50]) {
  const plan = planTest(rng, n)
  const tasks = plan.map((s) => {
    const d = GENERATORS[s.category](rng, s.level, 0)
    return { ...d, uid: fingerprint(d), timeLimit: 60 } as Task
  })
  const mk = (f: (t: Task, i: number) => boolean): AnswerRecord[] =>
    tasks.map((t, i) => ({ choice: 0, status: f(t, i) ? 'correct' : 'wrong', timeMs: 20000 }))
  const all = analyze(tasks, mk(() => true))
  const none = analyze(tasks, mk(() => false))
  const guess = analyze(tasks, mk((t) => rng.next() < 1 / t.options.length))
  const easy = analyze(tasks, mk((t) => t.level <= 3))
  const half = analyze(tasks, mk((t) => t.level <= 2 || (t.level === 3 && rng.chance(0.6)) || (t.level === 4 && rng.chance(0.3))))
  console.log(
    `N=${n}: все верно ${all.iq}±${all.iqSe}; всё неверно ${none.iq}; угадывание ${guess.iq}; уровни 1–3 ${easy.iq}; «средний» ${half.iq}±${half.iqSe}`,
  )
  const levels = plan.map((s) => s.level).join('')
  console.log(`  план уровней: ${levels}`)
}

if (failures) {
  console.error(`\nПроблем: ${failures}`)
  process.exit(1)
}
console.log('\nВсе проверки пройдены')
