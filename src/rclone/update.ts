import rclone from '@/rclone/client'
import { queryOptions } from '@tanstack/react-query'

const yoursRe = /yours:\s+(\S+)/
const latestRe = /latest:\s+(\S+)/

function parseUpdateCheck(result: string) {
    const yours = result.match(yoursRe)?.[1]
    const latest = result.match(latestRe)?.[1]
    if (!yours || !latest) return null
    return yours !== latest ? latest : null
}

export function updateCheckQueryOptions() {
    return queryOptions({
        queryKey: ['core', 'updateCheck'],
        queryFn: async () => {
            const data = (await rclone('/core/command', {
                // @ts-ignore
                body: {
                    command: 'selfupdate',
                    arg: ['--check'],
                },
            })) as { result?: string }

            return parseUpdateCheck(data.result ?? '')
        },
        staleTime: 1000 * 60 * 60,
        refetchInterval: 1000 * 60 * 60,
        retry: false,
    })
}
