import { useEffect, useState } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { Calculator, CaseSensitive, Grid3x3, Moon, Rotate3d, Sun, TrendingUp, Workflow, type LucideIcon } from 'lucide-react'
import type { CategoryId, Level } from '../engine/types'

export const EASE = [0.22, 1, 0.36, 1] as const

export const CATEGORY_ICON: Record<CategoryId, LucideIcon> = {
  sequence: TrendingUp,
  matrix: Grid3x3,
  spatial: Rotate3d,
  logic: Workflow,
  verbal: CaseSensitive,
  quant: Calculator,
}

type Variant = 'primary' | 'secondary' | 'ghost'

export function Button({ variant = 'secondary', className = '', ...props }: HTMLMotionProps<'button'> & { variant?: Variant }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none select-none'
  const variants: Record<Variant, string> = {
    primary: 'bg-ink text-bg hover:bg-cobalt',
    secondary: 'border border-line bg-surface text-ink hover:border-cobalt/50',
    ghost: 'text-muted hover:text-ink hover:bg-raised',
  }
  return (
    <motion.button whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }} className={`${base} ${variants[variant]} ${className}`} {...props} />
  )
}

/** Знак: матрица 3×3, где последняя клетка — вопрос. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect width="32" height="32" rx="8" style={{ fill: 'rgb(var(--ink))' }} />
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}${c}`}
            x={6 + c * 7.5}
            y={6 + r * 7.5}
            width="5"
            height="5"
            rx="1.2"
            style={{ fill: r === 2 && c === 2 ? 'rgb(var(--saffron))' : 'rgb(var(--bg))', opacity: r === 2 && c === 2 ? 1 : 0.85 }}
          />
        )),
      )}
    </svg>
  )
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2.5 rounded-lg" aria-label="Уникум IQ — на главную">
      <LogoMark />
      <span className="font-display text-[17px] font-semibold tracking-tight">
        Уникум<span className="text-saffron"> IQ</span>
      </span>
    </button>
  )
}

const THEME_KEY = 'iq-unikum:theme'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const read = () => {
      const attr = document.documentElement.getAttribute('data-theme')
      setDark(attr ? attr === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
    read()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', read)
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      mq.removeEventListener('change', read)
      obs.disconnect()
    }
  }, [])
  const toggle = () => {
    const next = dark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // без сохранения темы
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:text-ink"
      aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

export function LevelDots({ level, className = '' }: { level: Level; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label={`Сложность ${level} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-3 rounded-full ${i <= level ? 'bg-saffron' : 'bg-line'}`} />
      ))}
    </span>
  )
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  const rest = s % 60
  return m ? `${m} мин ${rest.toString().padStart(2, '0')} с` : `${rest} с`
}
