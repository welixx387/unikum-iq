// Детерминированный ГПСЧ sfc32. Зерно — 128 бит из crypto.getRandomValues,
// поэтому у двух людей практически невозможно получить один и тот же поток.

export interface Rng {
  next(): number
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
  sample<T>(items: readonly T[], k: number): T[]
  chance(p: number): boolean
  sign(): 1 | -1
}

export function randomSeed(): number[] {
  const out = new Uint32Array(4)
  const c = globalThis.crypto
  if (c?.getRandomValues) c.getRandomValues(out)
  else for (let i = 0; i < 4; i++) out[i] = (Math.random() * 2 ** 32) >>> 0
  return Array.from(out)
}

export function createRng(seed: readonly number[]): Rng {
  let [a, b, c, d] = seed.map((x) => x >>> 0)
  const next = () => {
    a >>>= 0
    b >>>= 0
    c >>>= 0
    d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
  // Прогрев, чтобы первые значения не зависели от структуры зерна.
  for (let i = 0; i < 16; i++) next()

  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const arr = items.slice()
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    },
    sample: (items, k) => rng.shuffle(items).slice(0, k),
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
  }
  return rng
}
