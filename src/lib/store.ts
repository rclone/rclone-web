import { clearPersistedQueryCache } from '@/lib/query'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type AuthStore = {
    url: string
    user: string
    pass: string
    hasHydrated: boolean
}

type PersistedAuthStore = Pick<AuthStore, 'url' | 'user' | 'pass'>

export const useAuthStore = create<AuthStore>()(
    persist(
        (): AuthStore => ({
            url: '',
            user: '',
            pass: '',
            hasHydrated: false,
        }),
        {
            name: 'lite-auth-store',
            storage: createJSONStorage<PersistedAuthStore>(() => localStorage),
            partialize: ({ url, user, pass }): PersistedAuthStore => ({ url, user, pass }),
        }
    )
)

if (useAuthStore.persist.hasHydrated()) {
    useAuthStore.setState({ hasHydrated: true })
}
useAuthStore.persist.onFinishHydration(() => {
    useAuthStore.setState({ hasHydrated: true })
})

export function clearAuthSession() {
    useAuthStore.setState({ user: '', pass: '' })
    clearPersistedQueryCache()
}
