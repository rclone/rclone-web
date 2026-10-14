import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STATIC_RC_URL } from '@/lib/connection'
import type { Language } from '@/lib/i18n'
import { clearPersistedQueryCache } from '@/lib/query'

type Store = {
    url: string
    user: string
    pass: string
    bannerDismissed: boolean
    language: Language | undefined
    hasHydrated: boolean
    authenticated: boolean
}

type PersistedStore = Pick<Store, 'url' | 'user' | 'pass' | 'bannerDismissed' | 'language'>

export const useStore = create<Store>()(
    persist(
        (): Store => ({
            url: STATIC_RC_URL ?? '',
            user: '',
            pass: '',
            bannerDismissed: false,
            language: undefined,
            hasHydrated: false,
            authenticated: false,
        }),
        {
            name: 'lite-auth-store',
            storage: createJSONStorage<PersistedStore>(() => localStorage),
            merge: (persisted, current) => ({
                ...current,
                ...(persisted as Partial<PersistedStore>),
                url: STATIC_RC_URL ?? (persisted as Partial<PersistedStore>)?.url ?? current.url,
            }),
            partialize: ({ url, user, pass, bannerDismissed, language }): PersistedStore => ({
                url: STATIC_RC_URL ? '' : url,
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
    useStore.setState({ user: '', pass: '', authenticated: false })
    clearPersistedQueryCache()
}
