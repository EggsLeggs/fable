"use client";

import { I18nProvider } from "@lingui/react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Locale } from "@/locales";
import { defaultLocale, locales } from "@/locales";
import { activateLocale, i18n, initializeI18n } from "@/lib/i18n";

interface LinguiContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  availableLocales: readonly Locale[];
}

const LinguiContext = createContext<LinguiContextValue | undefined>(undefined);

export function useLingui() {
  const ctx = useContext(LinguiContext);
  if (!ctx) throw new Error("useLingui must be used within LinguiProvider");
  return ctx;
}

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return defaultLocale;
  for (const lang of navigator.languages ?? [navigator.language]) {
    const code = lang.split("-")[0]?.toLowerCase();
    if (code && (locales as readonly string[]).includes(code)) {
      return code as Locale;
    }
    if (lang && (locales as readonly string[]).includes(lang)) {
      return lang as Locale;
    }
  }
  return defaultLocale;
}

export function LinguiProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [hydrated, setHydrated] = useState(false);

  initializeI18n();

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved && (locales as readonly string[]).includes(saved)) {
      setLocaleState(saved);
    } else {
      setLocaleState(detectBrowserLocale());
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    activateLocale(locale).then(() => {
      localStorage.setItem("locale", locale);
    });
  }, [locale, hydrated]);

  function setLocale(next: Locale) {
    setLocaleState(next);
  }

  return (
    <LinguiContext.Provider value={{ locale, setLocale, availableLocales: locales }}>
      <I18nProvider i18n={i18n} key={locale}>
        {children}
      </I18nProvider>
    </LinguiContext.Provider>
  );
}
