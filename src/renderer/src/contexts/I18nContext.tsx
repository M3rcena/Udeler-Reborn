import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  availableLocales,
  defaultLocaleCode,
  dictionaries,
  LocaleMeta,
  TranslationSchema
} from '../i18n'
import { NestedKeyOf, TranslationParamValue, TypedTFunction } from '../i18n/types'

interface I18nContextType {
  currentLocale: string
  setLocale: (code: string) => Promise<void>
  t: TypedTFunction
  availableLocales: LocaleMeta[]
  dir: 'ltr' | 'rtl'
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

function resolvePath(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  return typeof current === 'string' ? current : undefined
}

function interpolate(
  text: string,
  params?: Record<string, TranslationParamValue>
): React.ReactNode {
  if (!params) return text

  const tokens = text.split(/({{\s*\w+\s*}}|{{{\s*\w+\s*}}})/g)

  let containsReactElements = false
  for (const val of Object.values(params)) {
    if (React.isValidElement(val)) {
      containsReactElements = true
      break
    }
  }

  // Fast path: if no JSX elements are involved, return plain string
  if (!containsReactElements) {
    return text.replace(/{{\s*(\w+)\s*}}|{{{\s*(\w+)\s*}}}/g, (_, k1, k2) => {
      const key = k1 || k2
      return key in params ? String(params[key]) : `{{${key}}}`
    })
  }

  // Tokenized path: map placeholders to React nodes
  return tokens.map((token, index) => {
    const match = token.match(/^{{\s*(\w+)\s*}}$/) || token.match(/^{{{\s*(\w+)\s*}}}$/)
    if (match) {
      const key = match[1]
      if (key in params) {
        const value = params[key]
        return React.isValidElement(value) ? (
          <React.Fragment key={index}>{value}</React.Fragment>
        ) : (
          value
        )
      }
    }
    return token
  })
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLocale, setCurrentLocale] = useState<string>(defaultLocaleCode)

  useEffect(() => {
    const loadSavedLang = async (): Promise<void> => {
      try {
        const saved = (await window.api.invoke('store-get', 'app_language')) as string | undefined
        if (saved && dictionaries[saved]) {
          setCurrentLocale(saved)
        }
      } catch (err) {
        console.error('Failed to load saved language:', err)
      }
    }
    loadSavedLang()
  }, [])

  const setLocale = async (code: string): Promise<void> => {
    if (dictionaries[code]) {
      setCurrentLocale(code)
      await window.api.invoke('store-set', 'app_language', code)
    }
  }

  const activeDict = (dictionaries[currentLocale] || dictionaries[defaultLocaleCode]) as Record<
    string,
    unknown
  >
  const defaultDict = dictionaries[defaultLocaleCode] as Record<string, unknown>
  const dir = ((activeDict._meta as Record<string, string>)?.dir as 'ltr' | 'rtl') || 'ltr'

  useEffect(() => {
    document.documentElement.setAttribute('dir', dir)
  }, [dir])

  const tFunc = (
    path: NestedKeyOf<TranslationSchema>,
    params?: Record<string, TranslationParamValue>
  ): React.ReactNode => {
    let rawString = resolvePath(activeDict, path)
    if (rawString === undefined) {
      rawString = resolvePath(defaultDict, path)
    }
    if (rawString === undefined) {
      return path
    }
    return interpolate(rawString, params)
  }

  const t = Object.assign(tFunc, activeDict) as unknown as TypedTFunction

  return (
    <I18nContext.Provider
      value={{
        currentLocale,
        setLocale,
        t,
        availableLocales,
        dir
      }}
    >
      {children}
    </I18nContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
