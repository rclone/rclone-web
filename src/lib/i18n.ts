import { useCallback } from 'react'
import en from '@/languages/en.json'
import es from '@/languages/es.json'
import fr from '@/languages/fr.json'
import ja from '@/languages/ja.json'
import zh from '@/languages/zh.json'
import { useStore } from '@/lib/store'

export const LANGUAGES = [
    { code: 'fr', label: 'French', emoji: '\u{1F1EB}\u{1F1F7}' },
    { code: 'ja', label: 'Japanese', emoji: '\u{1F1EF}\u{1F1F5}' },
    { code: 'zh', label: 'Chinese', emoji: '\u{1F1E8}\u{1F1F3}' },
    { code: 'es', label: 'Spanish', emoji: '\u{1F1EA}\u{1F1F8}' },
] as const

export type Language = (typeof LANGUAGES)[number]['code']

export type TranslationKey = keyof typeof en

const messages: Record<Language, Partial<Record<TranslationKey, string>>> = {
    fr,
    ja,
    zh,
    es,
}

function format(template: string, params?: Record<string, string | number>) {
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`))
}

function resolve(key: TranslationKey, language: Language | undefined): string {
    if (language) {
        const localized = messages[language]?.[key]
        if (localized) return localized
    }
    return en[key]
}

/** Reactive hook — re-renders when language changes. Use in components. */
export function useT() {
    const language = useStore((s) => s.language)
    return useCallback(
        (key: TranslationKey, params?: Record<string, string | number>) =>
            format(resolve(key, language), params),
        [language]
    )
}

/** Standalone — reads current language from store. Use outside components (toasts, mutations). */
export function t(key: TranslationKey, params?: Record<string, string | number>) {
    const language = useStore.getState().language
    return format(resolve(key, language), params)
}
