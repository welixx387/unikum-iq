import { useEffect, useRef } from 'react'

// Медленно дрейфующие контуры фигур из матриц — атмосфера «лаборатории».
// Рисуется на canvas; при prefers-reduced-motion — один статичный кадр.

type Glyph = { x: number; y: number; r: number; a: number; va: number; vx: number; vy: number; kind: number; hue: number }

function readColor(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v ? `rgb(${v.split(' ').join(',')}` : 'rgb(120,130,160'
}

export function Background() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let raf = 0
    let colors = [readColor('--cobalt'), readColor('--saffron'), readColor('--ink')]
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const glyphs: Glyph[] = []
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const target = Math.round((w * h) / 42000) + 8
      while (glyphs.length < target)
        glyphs.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 8 + Math.random() * 22,
          a: Math.random() * Math.PI * 2,
          va: (Math.random() - 0.5) * 0.003,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          kind: Math.floor(Math.random() * 5),
          hue: Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2,
        })
      glyphs.length = target
    }
    const shape = (g: Glyph) => {
      ctx.beginPath()
      const sides = [0, 3, 4, 6, 5][g.kind]
      if (sides === 0) ctx.arc(0, 0, g.r, 0, Math.PI * 2)
      else
        for (let i = 0; i <= sides; i++) {
          const a = (i / sides) * Math.PI * 2 - Math.PI / 2
          const x = Math.cos(a) * g.r
          const y = Math.sin(a) * g.r
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
    }
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const g of glyphs) {
        if (!reduce) {
          g.x += g.vx
          g.y += g.vy
          g.a += g.va
          if (g.x < -40) g.x = w + 40
          if (g.x > w + 40) g.x = -40
          if (g.y < -40) g.y = h + 40
          if (g.y > h + 40) g.y = -40
        }
        ctx.save()
        ctx.translate(g.x, g.y)
        ctx.rotate(g.a)
        shape(g)
        ctx.strokeStyle = `${colors[g.hue]},${g.hue === 2 ? 0.07 : 0.16})`
        ctx.lineWidth = 1.3
        ctx.stroke()
        ctx.restore()
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    const onTheme = () => {
      colors = [readColor('--cobalt'), readColor('--saffron'), readColor('--ink')]
      if (reduce) draw()
    }
    resize()
    draw()
    const obs = new MutationObserver(onTheme)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', onTheme)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      obs.disconnect()
      mq.removeEventListener('change', onTheme)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="sheet absolute inset-0" />
      <div
        className="absolute -left-[20%] -top-[25%] h-[70vmax] w-[70vmax] rounded-full opacity-[0.16] blur-3xl"
        style={{ background: 'radial-gradient(circle, rgb(var(--glow-a)) 0%, transparent 65%)' }}
      />
      <div
        className="absolute -bottom-[30%] -right-[15%] h-[60vmax] w-[60vmax] rounded-full opacity-[0.12] blur-3xl"
        style={{ background: 'radial-gradient(circle, rgb(var(--glow-b)) 0%, transparent 65%)' }}
      />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
