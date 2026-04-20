import { queryOptions } from '@tanstack/react-query'
import rclone from '@/rclone/client'

const yoursRe = /yours:\s+(\S+)/
const latestRe = /latest:\s+(\S+)/

function parseVersion(v: string) {
    const match = v.match(/^v?(\d+)\.(\d+)\.(\d+)/)
    if (!match) return null
    return [Number(match[1]), Number(match[2]), Number(match[3])] as const
}

function parseUpdateCheck(result: string) {
    const yours = result.match(yoursRe)?.[1]
    const latest = result.match(latestRe)?.[1]
    if (!yours || !latest) return null
    const y = parseVersion(yours)
    const l = parseVersion(latest)
    if (!y || !l) return null
    for (let i = 0; i < 3; i++) {
        if (l[i] > y[i]) return latest
        if (l[i] < y[i]) return null
    }
    return null
}

export function updateCheckQueryOptions() {
    return queryOptions({
        queryKey: ['core', 'updateCheck'],
        queryFn: async () => {
            const data = await rclone('/core/command', {
                body: { command: 'selfupdate', arg: ['--check'] },
            })

            return parseUpdateCheck(data.result ?? '')
        },
        staleTime: 1000 * 60 * 60,
        refetchInterval: 1000 * 60 * 60,
        retry: false,
    })
}
