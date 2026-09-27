import type { Rng } from './rng'

// Выдуманные слова для задач на логику: так ответ нельзя «угадать» по
// жизненному опыту — только вывести из условий.
const ONSETS = ['б', 'в', 'г', 'д', 'з', 'к', 'л', 'м', 'н', 'п', 'р', 'с', 'т', 'ф', 'бр', 'гл', 'др', 'кл', 'кр', 'пл', 'пр', 'св', 'ст', 'тр', 'зл', 'шм', 'хл', 'цв']
const VOWELS = ['а', 'о', 'у', 'и', 'е', 'ы']
// Только твёрдые согласные в конце — чтобы склонять по одному образцу.
const CODAS = ['б', 'д', 'л', 'м', 'н', 'п', 'р', 'с', 'т', 'ф', 'з', 'в']

export interface PseudoNoun {
  sg: string
  pl: string
  /** творительный падеж, ед. ч. — «является зорбом» */
  instr: string
  /** творительный падеж, мн. ч. — «являются зорбами» */
  instrPl: string
}

export function pseudoNoun(rng: Rng, avoid: Set<string>): PseudoNoun {
  for (;;) {
    const syll = rng.int(1, 2)
    let stem = ''
    for (let i = 0; i < syll; i++) stem += rng.pick(ONSETS) + rng.pick(VOWELS)
    stem += rng.pick(CODAS)
    if (avoid.has(stem) || stem.length < 3 || stem.length > 8) continue
    avoid.add(stem)
    return { sg: stem, pl: `${stem}ы`, instr: `${stem}ом`, instrPl: `${stem}ами` }
  }
}

export const NAMES_F = ['Аня', 'Вера', 'Галя', 'Даша', 'Ева', 'Жанна', 'Зоя', 'Ира', 'Катя', 'Лена', 'Маша', 'Нина', 'Оля', 'Полина', 'Рита', 'Соня', 'Таня', 'Ульяна', 'Фаина', 'Юля', 'Яна', 'Алиса', 'Вика', 'Диана', 'Кира', 'Лиза', 'Мила', 'Нелли', 'Ника', 'Света']
export const NAMES_M = ['Антон', 'Борис', 'Вадим', 'Глеб', 'Денис', 'Егор', 'Захар', 'Игорь', 'Кирилл', 'Лев', 'Марк', 'Никита', 'Олег', 'Павел', 'Роман', 'Семён', 'Тимур', 'Фёдор', 'Юрий', 'Ян', 'Артём', 'Богдан', 'Гриша', 'Давид', 'Женя', 'Илья', 'Костя', 'Миша', 'Петя', 'Стас']

export function names(rng: Rng, k: number): string[] {
  const all = [...NAMES_F, ...NAMES_M]
  // Разные первые буквы — легче держать в голове и не путать.
  const byLetter = new Map<string, string[]>()
  for (const n of all) byLetter.set(n[0], [...(byLetter.get(n[0]) ?? []), n])
  const letters = rng.sample([...byLetter.keys()], k)
  return letters.map((l) => rng.pick(byLetter.get(l)!))
}
