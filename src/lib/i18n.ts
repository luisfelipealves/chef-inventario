import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptPT from "@/locales/pt-PT.json";
import en from "@/locales/en.json";

/**
 * Internacionalização. Idiomas: pt-PT (original) e en.
 * Sem escolha guardada, segue o idioma do sistema. A escolha vive em
 * localStorage e muda a app inteira em tempo real (react-i18next).
 */

export type Idioma = "pt-PT" | "en";

export const IDIOMAS: { id: Idioma; nome: string }[] = [
  { id: "pt-PT", nome: "Português" },
  { id: "en", nome: "English" },
];

const IDIOMA_KEY = "chefgestao:idioma";

function idiomaGuardado(): Idioma | null {
  if (typeof localStorage === "undefined") return null;
  const v = localStorage.getItem(IDIOMA_KEY);
  return v === "pt-PT" || v === "en" ? v : null;
}

function idiomaDoSistema(): Idioma {
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("pt")) {
    return "pt-PT";
  }
  return "en";
}

export function idiomaAtual(): Idioma {
  return (i18n.language as Idioma) || idiomaGuardado() || idiomaDoSistema();
}

/** Locale BCP-47 para Intl (datas/números) coerente com o idioma da UI. */
export function localeAtual(): string {
  return idiomaAtual() === "en" ? "en-GB" : "pt-PT";
}

export function definirIdioma(idioma: Idioma): void {
  try {
    localStorage.setItem(IDIOMA_KEY, idioma);
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(idioma);
}

void i18n.use(initReactI18next).init({
  resources: {
    "pt-PT": { translation: ptPT },
    en: { translation: en },
  },
  lng: idiomaGuardado() ?? idiomaDoSistema(),
  fallbackLng: "pt-PT",
  interpolation: { escapeValue: false },
});

export default i18n;
