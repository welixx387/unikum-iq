// Реестр выданных заданий.
//
// Локально (всегда): отпечатки всех заданий, показанных на этом устройстве,
// хранятся в localStorage — одному человеку задание не повторится никогда.
//
// Глобально (если заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY):
// отпечатки атомарно «занимаются» в таблице Supabase с первичным ключом,
// поэтому одно и то же задание не может достаться двум разным людям.

const LOCAL_KEY = 'iq-unikum:seen'
const MAX_LOCAL = 20000

export function loadLocalSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function saveLocalSeen(seen: Set<string>) {
  try {
    const arr = [...seen]
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr.slice(-MAX_LOCAL)))
  } catch {
    // Хранилище недоступно (приватный режим) — работаем без локальной истории.
  }
}

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}
const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY

export const globalRegistryEnabled = Boolean(
  SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('your-project'),
)

/**
 * Пытается занять отпечатки в глобальном реестре.
 * Возвращает те, что уже были заняты кем-то раньше (их нужно заменить),
 * или null, если реестр недоступен.
 */
export async function claimGlobally(fingerprints: string[]): Promise<string[] | null> {
  if (!globalRegistryEnabled || fingerprints.length === 0) return globalRegistryEnabled ? [] : null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_iq_tasks`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fingerprints }),
    })
    if (!res.ok) return null
    const taken = (await res.json()) as string[] | null
    return Array.isArray(taken) ? taken : []
  } catch {
    return null
  }
}
