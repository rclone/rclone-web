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

export type RemoteWithUsage = {
    name: string
    type: string
    usage: RemoteUsage | null
}

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

export async function fetchRemotesWithUsage() {
    const [listResponse, dumpResponse] = await Promise.all([
        rclone('/config/listremotes'),
        rclone('/config/dump'),
    ])

    const names = [...(listResponse.remotes ?? [])].sort((a, b) => a.localeCompare(b))
    const configs = (dumpResponse ?? {}) as Record<string, Record<string, string>>

    return Promise.all(
        names.map(async (name): Promise<RemoteWithUsage> => {
            let usage: RemoteUsage | null = null

            try {
                const aboutResponse = await rclone('/operations/about', {
                    params: { query: { fs: `${name}:` } },
                })
                usage = parseRemoteUsage(
                    aboutResponse as { used?: number; total?: number; free?: number }
                )
            } catch {
                usage = null
            }

            return {
                name,
                type: configs[name]?.type ?? 'unknown',
                usage,
            }
        })
    )
}
