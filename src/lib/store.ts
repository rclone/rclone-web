import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Language } from '@/lib/i18n'
import { clearPersistedQueryCache } from '@/lib/query'

type Store = {
    url: string
    user: string
    pass: string
    bannerDismissed: boolean
    language: Language | undefined
    hasHydrated: boolean
}

type PersistedStore = Pick<
    Store,
    'url' | 'user' | 'pass' | 'bannerDismissed' | 'language'
>

export const useStore = create<Store>()(
    persist(
        (): Store => ({
            url: '',
            user: '',
            pass: '',
            bannerDismissed: false,
            language: undefined, 
            hasHydrated: false,
        }),
        {
            name: 'lite-auth-store',
            storage: createJSONStorage<PersistedStore>(() => localStorage),
            partialize: ({ url, user, pass, bannerDismissed, language }): PersistedStore => ({
                url,
                user,
                pass,
                bannerDismissed,
                language,
            }),
        }
    )
)

if (useStore.persist.hasHydrated()) {
    useStore.setState({ hasHydrated: true })
}
useStore.persist.onFinishHydration(() => {
    useStore.setState({ hasHydrated: true })
})

export function clearAuthSession() {
    useStore.setState({ user: '', pass: '' })
    clearPersistedQueryCache()
}
