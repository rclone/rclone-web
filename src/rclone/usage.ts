import { formatBytes } from '@/lib/format'
import rclone from '@/rclone/client'

export type RemoteUsage = {
    used: number
    total: number
    free: number
    usedLabel: string
    totalLabel: string
    percentLabel: string
    barPercent: number
}

export type UsageStatus =
    | { state: 'idle' }
    | { state: 'loading' }
    | { state: 'success'; usage: RemoteUsage }
    | { state: 'unsupported' }
    | { state: 'auth_error'; message: string }
    | { state: 'error'; message: string }

export type RemoteInfo = {
    name: string
    type: string
}

export type RemoteWithUsage = {
    name: string
    type: string
    usage: RemoteUsage | null
    reachable: boolean
}

const SUPPORTS_ABOUT = [
    'box',
    'dropbox',
    'gofile',
    'drive',
    'filen',
    'hdfs',
    'internetarchive',
    'jottacloud',
    'koofr',
    'mailru',
    'mega',
    'azurefiles',
    'onedrive',
    'opendrive',
    'swift',
    'pcloud',
    'pikpak',
    'pixeldrain',
    'premiumizeme',
    'putio',
    'protondrive',
    'quatrix',
    'seafile',
    'sftp',
    'webdav',
    'yandex',
    'zoho',
    'local',
] as const

function parseRemoteUsage(data: {
    used?: number
    total?: number
    free?: number
}): RemoteUsage | null {
    const used = data.used
    const total = data.total

    if (used === undefined || total === undefined || total === 0) {
        return null
    }

    const free = data.free ?? total - used
    const percent = Math.round((used / total) * 100)

    return {
        used,
        total,
        free,
        usedLabel: formatBytes(used),
        totalLabel: formatBytes(total),
        percentLabel: `${percent}%`,
        barPercent: Math.min(percent, 100),
    }
}

function supportsAbout(type: string): boolean {
    return (SUPPORTS_ABOUT as readonly string[]).includes(type)
}

function isAuthError(message: string): boolean {
    return (
        message.includes('token expired') ||
        message.includes('invalid_grant') ||
        message.includes('401') ||
        message.includes('403') ||
        message.includes('Unauthorized') ||
        message.includes('Forbidden') ||
        message.includes('empty token found')
    )
}

const aboutLimit = (() => {
    const max = 6
    let active = 0
    const queue: Array<() => void> = []

    function next() {
        if (queue.length > 0 && active < max) {
            active++
            queue.shift()!()
        }
    }

    return <T>(fn: () => Promise<T>): Promise<T> =>
        new Promise<T>((resolve, reject) => {
            queue.push(() => {
                fn()
                    .then(resolve, reject)
                    .finally(() => {
                        active--
                        next()
                    })
            })
            next()
        })
})()

export async function fetchRemotesList(): Promise<RemoteInfo[]> {
    const [listResponse, dumpResponse] = await Promise.all([
        rclone('/config/listremotes'),
        rclone('/config/dump'),
    ])

    const names = [...(listResponse.remotes ?? [])].sort((a, b) => a.localeCompare(b))
    const configs = (dumpResponse ?? {}) as Record<string, Record<string, string>>

    return names.map((name) => ({
        name,
        type: configs[name]?.type ?? 'unknown',
    }))
}

export function fetchRemoteUsage(name: string, type: string): Promise<UsageStatus> {
    if (!supportsAbout(type)) {
        return Promise.resolve({ state: 'unsupported' as const })
    }

    return aboutLimit(async () => {
        try {
            const response = await Promise.race([
                rclone('/operations/about', {
                    params: { query: { fs: `${name}:` } },
                }),
            ])
            const usage = parseRemoteUsage(
                response as { used?: number; total?: number; free?: number }
            )
            return usage ? { state: 'success' as const, usage } : { state: 'unsupported' as const }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            if (isAuthError(message)) return { state: 'auth_error' as const, message }
            return { state: 'error' as const, message }
        }
    })
}

export async function fetchRemotesWithUsage(): Promise<RemoteWithUsage[]> {
    const remotes = await fetchRemotesList()

    return Promise.all(
        remotes.map(async (remote): Promise<RemoteWithUsage> => {
            const status = await fetchRemoteUsage(remote.name, remote.type)
            return {
                ...remote,
                usage: status.state === 'success' ? status.usage : null,
                reachable: status.state !== 'auth_error' && status.state !== 'error',
            }
        })
    )
}
