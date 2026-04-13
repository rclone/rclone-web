import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { hashKey, QueryClient } from '@tanstack/react-query'

export const persistedQueryCacheKey = 'lite-ui-persisted-query-cache'

function getConnectionKey(): string {
    try {
        const raw = localStorage.getItem('lite-auth-store')
        if (raw) {
            const parsed = JSON.parse(raw) as { state?: { url?: string; user?: string } }
            const { url = '', user = '' } = parsed.state ?? {}
            return `${url}\0${user}`
        }
    } catch {}
    return '\0'
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            queryKeyHashFn: (queryKey) => hashKey([getConnectionKey(), ...queryKey]),
        },
    },
})

const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: persistedQueryCacheKey,
    throttleTime: 1000,
})

persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
})

export function clearPersistedQueryCache() {
    queryClient.clear()
    window.localStorage.removeItem(persistedQueryCacheKey)
}

export default queryClient
