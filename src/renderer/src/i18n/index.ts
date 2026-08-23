import { EnglishUS } from '../locales/EnglishUS'

export type TranslationSchema = typeof EnglishUS

export interface LocaleMeta {
  code: string
  name: string
  countryCode: string
  dir: 'ltr' | 'rtl'
}

function mergeDeep<T extends Record<string, unknown>>(base: T, target: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...base }
  for (const key of Object.keys(base)) {
    if (key === '_meta') {
      result[key] = target[key] || base[key]
      continue
    }
    if (typeof base[key] === 'object' && base[key] !== null) {
      result[key] = mergeDeep(
        base[key] as Record<string, unknown>,
        (target[key] as Record<string, unknown>) || {}
      )
    } else {
      result[key] = typeof target[key] === 'string' ? target[key] : base[key]
    }
  }
  return result as T
}

// Dynamically discover all JSON locale files in ../locales
const localeModules = import.meta.glob('../locales/*.json', { eager: true })

const loadedTranslations: Record<string, TranslationSchema> = {
  EnglishUS: EnglishUS
}

const availableLocalesList: LocaleMeta[] = [
  {
    code: 'EnglishUS',
    name: EnglishUS._meta.name,
    countryCode: EnglishUS._meta.countryCode,
    dir: EnglishUS._meta.dir
  }
]

for (const path in localeModules) {
  const mod = localeModules[path] as Record<string, unknown>
  const fileNameMatch = path.match(/\/([^/]+)\.json$/)
  if (!fileNameMatch) continue

  const code = fileNameMatch[1]
  if (code === 'EnglishUS') continue

  const meta = (mod._meta as Record<string, string>) || {}
  const merged = mergeDeep(EnglishUS as unknown as Record<string, unknown>, mod)
  loadedTranslations[code] = merged as TranslationSchema

  availableLocalesList.push({
    code,
    name: meta.name || code,
    countryCode: (meta.countryCode || 'us').toLowerCase(),
    dir: (meta.dir as 'ltr' | 'rtl') || 'ltr'
  })
}

export const availableLocales = availableLocalesList
export const dictionaries = loadedTranslations
export const defaultLocaleCode = 'EnglishUS'
