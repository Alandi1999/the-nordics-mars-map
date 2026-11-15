import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'es';
/** A bilingual string for data that lives outside React components. */
export type Bi = { en: string; es: string };
/** A string that may be bilingual. Plain strings are shown as they are in both languages. */
export type Text = string | Bi;

export const DEFAULT_LANG: Lang = 'en';
const KEY = 'ares-map.lang.v1';

export const resolve = (lang: Lang, x: Text): string => (typeof x === 'string' ? x : x[lang]);

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Inline bilingual literal: t('English text', 'Texto en español'). */
  t: (en: string, es: string) => string;
  /** Resolves a possibly bilingual value coming from data modules. */
  l: (x: Text) => string;
}

const Ctx = createContext<I18n>({
  lang: DEFAULT_LANG,
  setLang: () => undefined,
  t: (en) => en,
  l: (x) => resolve(DEFAULT_LANG, x),
});

function readStored(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'es' || v === 'en' ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG; // storage can be blocked (private mode)
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStored);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* the choice then lasts for this visit only */
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const value = useMemo<I18n>(
    () => ({ lang, setLang, t: (en, es) => (lang === 'es' ? es : en), l: (x) => resolve(lang, x) }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
