import { motion } from 'framer-motion'
import { CATEGORY_BY_ID } from '../../engine/categories'
import type { CategoryStat, LevelStat } from '../../engine/scoring'
import type { CategoryId } from '../../engine/types'
import { CATEGORY_ICON } from '../ui'

/** Точность по способностям: одна серия, подписи значений у конца полосы. */
export function CategoryBars({
  stats,
  strengths,
  weaknesses,
}: {
  stats: CategoryStat[]
  strengths: CategoryId[]
  weaknesses: CategoryId[]
}) {
  return (
    <div className="flex flex-col gap-4">
      {stats.map((s, i) => {
        const Icon = CATEGORY_ICON[s.id]
        const pct = Math.round(s.accuracy * 100)
        const tag = strengths.includes(s.id) ? 'strong' : weaknesses.includes(s.id) ? 'weak' : null
        return (
          <div key={s.id} className="group" title={`${CATEGORY_BY_ID[s.id].title}: ${s.correct} из ${s.total}, среднее время ${Math.round(s.avgTimeMs / 1000)} с`}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
              <Icon size={15} className="text-muted" />
              <span className="font-medium">{CATEGORY_BY_ID[s.id].title}</span>
              {tag && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    tag === 'strong' ? 'bg-good-soft text-good' : 'bg-saffron-soft text-saffron'
                  }`}
                >
                  {tag === 'strong' ? '▲ сильная сторона' : '● зона роста'}
                </span>
              )}
              <span className="ml-auto font-mono text-[13px] text-muted tabular">
                {s.correct} из {s.total}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="h-3.5 flex-1 overflow-hidden rounded-r-[4px] bg-line/60">
                <motion.div
                  className="h-full rounded-r-[4px] bg-cobalt group-hover:bg-cobalt/80"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(pct, 1)}%` }}
                  transition={{ delay: 0.2 + i * 0.08, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className="w-11 text-right font-mono text-[14px] font-medium tabular">{pct}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Точность по уровням сложности — столбцы от 1 до 5. */
export function LevelColumns({ levels }: { levels: LevelStat[] }) {
  const H = 132
  return (
    <div>
      <div className="relative flex items-end gap-3 border-b border-faint/60 sm:gap-5" style={{ height: H + 28 }}>
        {[0.5, 1].map((g) => (
          <div key={g} className="pointer-events-none absolute left-0 right-0 border-t border-line" style={{ bottom: H * g }}>
            <span className="absolute -top-[9px] right-0 bg-surface pl-1 font-mono text-[10px] text-faint">{g * 100}%</span>
          </div>
        ))}
        {levels.map((l, i) => {
          const acc = l.total ? l.correct / l.total : 0
          return (
            <div key={l.level} className="relative z-10 flex flex-1 flex-col items-center justify-end" title={`Уровень ${l.level}: ${l.correct} из ${l.total}`}>
              <span className="mb-1 font-mono text-[12px] text-muted tabular">{l.total ? `${Math.round(acc * 100)}%` : '—'}</span>
              <motion.div
                className="w-full max-w-[24px] rounded-t-[4px] bg-cobalt"
                initial={{ height: 0 }}
                animate={{ height: Math.max(2, acc * H) }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-3 sm:gap-5">
        {levels.map((l) => (
          <div key={l.level} className="flex-1 text-center">
            <div className="font-mono text-[12px] text-ink">ур. {l.level}</div>
            <div className="text-[11px] text-faint tabular">
              {l.correct}/{l.total}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
