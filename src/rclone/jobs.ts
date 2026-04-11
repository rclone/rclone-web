import type { components } from 'rclone-openapi'
import { formatBytes, formatDuration } from '@/lib/format'
import rclone from '@/rclone/client'

type JobStatus = components['responses']['JobStatusResponse']['content']['application/json']

type JobGroupStats = components['responses']['CoreStatsResponse']['content']['application/json']

type TransferredItem =
    components['responses']['CoreTransferredResponse']['content']['application/json']['transferred'][number]

export type JobRow = {
    rowKey: string
    id: number
    status: 'running' | 'completed' | 'failed'
    startTime: string
    source: string
    destination: string
    bytes: number
    totalBytes: number
    progress: number
    speedLabel: string
    etaLabel: string
    errorText: string
    canStop: boolean
}

const httpStatusPattern = /^\d{3}\s/

function getText(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function getNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeJobGroupStats(stats: JobGroupStats | null | undefined) {
    return {
        bytes: getNumber(stats?.bytes),
        totalBytes: getNumber(stats?.totalBytes),
        speed: getNumber(stats?.speed),
        eta: typeof stats?.eta === 'number' && Number.isFinite(stats.eta) ? stats.eta : null,
        checks: getNumber(stats?.checks),
        totalChecks: getNumber(stats?.totalChecks),
        transfers: getNumber(stats?.transfers),
        totalTransfers: getNumber(stats?.totalTransfers),
        transferring: Array.isArray(stats?.transferring) ? stats.transferring : [],
        checking: Array.isArray(stats?.checking) ? stats.checking : [],
    }
}

function buildPathLabel(fs?: string, remote?: string, fallback?: string) {
    const normalizedFs = getText(fs)
    const normalizedRemote = getText(remote)
    const normalizedFallback = getText(fallback)

    if (normalizedFs && normalizedRemote) {
        if (
            normalizedFs.endsWith('/') ||
            normalizedFs.endsWith('\\') ||
            normalizedFs.endsWith(':') ||
            normalizedRemote.startsWith('/') ||
            normalizedRemote.startsWith('\\')
        ) {
            return `${normalizedFs}${normalizedRemote}`
        }

        return `${normalizedFs}/${normalizedRemote}`
    }

    if (normalizedFs && normalizedFallback) {
        if (
            normalizedFs.endsWith('/') ||
            normalizedFs.endsWith('\\') ||
            normalizedFs.endsWith(':') ||
            normalizedFallback.startsWith('/') ||
            normalizedFallback.startsWith('\\')
        ) {
            return `${normalizedFs}${normalizedFallback}`
        }

        return `${normalizedFs}/${normalizedFallback}`
    }

    if (normalizedRemote) {
        return normalizedRemote
    }

    if (normalizedFs) {
        return normalizedFs
    }

    if (normalizedFallback) {
        return normalizedFallback
    }

    return ''
}

function getJobErrorText(status: JobStatus) {
    const directError = getText(status.error)

    if (directError) {
        return directError
    }

    const output = status.output
    const results =
        output && typeof output === 'object' && 'results' in output && Array.isArray(output.results)
            ? output.results
            : []

    const nestedErrors = results
        .map((result) => {
            if (!result || typeof result !== 'object' || !('error' in result)) {
                return ''
            }

            const error = getText(result.error)
            if (!error) {
                return ''
            }

            const input =
                'input' in result && result.input && typeof result.input === 'object'
                    ? result.input
                    : null
            const inputRecord = input as Record<string, unknown> | null
            const path = input
                ? buildPathLabel(
                      typeof inputRecord?.srcFs === 'string' ? inputRecord.srcFs : undefined,
                      typeof inputRecord?.srcRemote === 'string'
                          ? inputRecord.srcRemote
                          : undefined,
                      typeof inputRecord?.dstRemote === 'string'
                          ? inputRecord.dstRemote
                          : typeof inputRecord?._path === 'string'
                            ? inputRecord._path
                            : undefined
                  )
                : ''

            return path ? `${path}: ${error}` : error
        })
        .filter((error) => error.length > 0)

    return nestedErrors.join('\n')
}

function getProgressPercent({
    bytes,
    totalBytes,
    percentage,
    isFinished,
    isFailed,
}: {
    bytes: number
    totalBytes: number
    percentage?: number
    isFinished: boolean
    isFailed: boolean
}) {
    if (totalBytes > 0) {
        const rawPercent = Math.round((bytes / totalBytes) * 100)
        if (isFinished && !isFailed) {
            return 100
        }
        return Math.max(0, Math.min(100, rawPercent))
    }

    if (typeof percentage === 'number' && Number.isFinite(percentage)) {
        return Math.max(0, Math.min(100, Math.round(percentage)))
    }

    return isFinished && !isFailed ? 100 : 0
}

async function fetchJobStatus(jobid: number) {
    try {
        return await rclone('/job/status', {
            params: { query: { jobid } },
        })
    } catch (error) {
        // The rclone wrapper throws when data.error is truthy, but /job/status
        // returns an error field for failed jobs (e.g. "directory not found").
        // Handle this by constructing a synthetic failed status from the error.
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        if (
            errorMessage.includes('job not found') ||
            errorMessage.includes('Failed to fetch') ||
            errorMessage.startsWith('{') ||
            httpStatusPattern.test(errorMessage)
        ) {
            return null
        }

        return {
            id: jobid,
            finished: true,
            success: false,
            error: errorMessage,
            duration: 0,
            endTime: '',
            startTime: '',
        } satisfies JobStatus
    }
}

export async function fetchJobsSnapshot() {
    const [globalStatsResponse, transferredResponse] = await Promise.all([
        rclone('/core/stats'),
        rclone('/core/transferred'),
    ])

    const globalStats = normalizeJobGroupStats(globalStatsResponse)
    const transferred: TransferredItem[] = Array.isArray(transferredResponse.transferred)
        ? transferredResponse.transferred
        : []

    const getEntries = <T extends { group?: string }>(items: T[]) =>
        items.flatMap((item, index) => {
            const match = /^job\/(\d+)$/.exec(getText(item.group))
            if (!match) {
                return []
            }

            const jobid = Number.parseInt(match[1], 10)
            return Number.isFinite(jobid) ? [{ jobid, item, index }] : []
        })

    const transferringEntries = getEntries(globalStats.transferring)
    const checkingEntries = getEntries(globalStats.checking)
    const transferredEntries = getEntries(transferred)
    const jobIds = new Set(
        [...transferringEntries, ...checkingEntries, ...transferredEntries].map(
            ({ jobid }) => jobid
        )
    )

    if (jobIds.size === 0) {
        return []
    }

    const statusMap = new Map(
        await Promise.all(
            Array.from(jobIds).map(async (jobid) => [jobid, await fetchJobStatus(jobid)] as const)
        )
    )

    const getStatus = (jobid: number, finished: boolean, success: boolean, error = ''): JobStatus =>
        statusMap.get(jobid) ?? {
            id: jobid,
            finished,
            success,
            error,
            duration: 0,
            endTime: '',
            startTime: '',
        }

    const normalizeTransferringRow = ({
        jobid,
        item,
        status,
        index,
    }: {
        jobid: number
        item: NonNullable<JobGroupStats['transferring']>[number]
        status: JobStatus
        index: number
    }): JobRow => {
        const source = buildPathLabel(item.srcFs, item.srcRemote, item.name)
        const destination = buildPathLabel(item.dstFs, item.dstRemote, item.name)
        const bytes = getNumber(item.bytes)
        const totalBytes = getNumber(item.size)

        return {
            rowKey: `${jobid}:transferring:${source || getText(item.name)}:${destination}:${index}`,
            id: jobid,
            status: 'running',
            startTime: status.startTime,
            source: source || '—',
            destination: destination || '—',
            bytes,
            totalBytes,
            progress: getProgressPercent({
                bytes,
                totalBytes,
                percentage: item.percentage,
                isFinished: false,
                isFailed: false,
            }),
            speedLabel: `${formatBytes(getNumber(item.speed))}/s`,
            etaLabel:
                typeof item.eta === 'number' && Number.isFinite(item.eta) && item.eta > 0
                    ? formatDuration(item.eta)
                    : '—',
            errorText: getJobErrorText(status),
            canStop: true,
        }
    }

    const normalizeCheckingRow = ({
        jobid,
        item,
        status,
        index,
    }: {
        jobid: number
        item: NonNullable<JobGroupStats['checking']>[number]
        status: JobStatus
        index: number
    }): JobRow => {
        const source = getText(item.name)

        return {
            rowKey: `${jobid}:checking:${source || 'checking'}::${index}`,
            id: jobid,
            status: 'running',
            startTime: status.startTime,
            source: source || '—',
            destination: '—',
            bytes: 0,
            totalBytes: getNumber(item.size),
            progress: 0,
            speedLabel: `${formatBytes(0)}/s`,
            etaLabel: 'Checking',
            errorText: getJobErrorText(status),
            canStop: true,
        }
    }

    const normalizeTransferredRow = ({
        jobid,
        item,
        status,
        index,
    }: {
        jobid: number
        item: TransferredItem
        status: JobStatus
        index: number
    }): JobRow => {
        const source = buildPathLabel(item.srcFs, item.srcRemote, item.name)
        const destination = buildPathLabel(item.dstFs, item.dstRemote, item.name)
        const bytes = getNumber(item.bytes)
        const totalBytes = getNumber(item.size)
        const itemError = getText(item.error)
        const isFailed = itemError.length > 0

        return {
            rowKey: `${jobid}:transferred:${source || getText(item.name)}:${destination}:${index}`,
            id: jobid,
            status: isFailed ? 'failed' : 'completed',
            startTime: status.startTime,
            source: source || '—',
            destination: destination || '—',
            bytes,
            totalBytes,
            progress: getProgressPercent({
                bytes,
                totalBytes,
                isFinished: true,
                isFailed,
            }),
            speedLabel: `${formatBytes(0)}/s`,
            etaLabel: isFailed ? 'Stopped' : 'Done',
            errorText: itemError || getJobErrorText(status),
            canStop: false,
        }
    }

    const runningRows = [
        ...transferringEntries.map(({ jobid, item, index }) =>
            normalizeTransferringRow({
                jobid,
                item,
                index,
                status: getStatus(jobid, false, false),
            })
        ),
        ...checkingEntries.map(({ jobid, item, index }) =>
            normalizeCheckingRow({
                jobid,
                item,
                index,
                status: getStatus(jobid, false, false),
            })
        ),
    ]
    const failedRows = transferredEntries
        .filter(({ item }) => getText(item.error).length > 0)
        .map(({ jobid, item, index }) =>
            normalizeTransferredRow({
                jobid,
                item,
                index,
                status: getStatus(jobid, true, false, getText(item.error)),
            })
        )
    const completedRows = transferredEntries
        .filter(({ item }) => getText(item.error).length === 0)
        .map(({ jobid, item, index }) =>
            normalizeTransferredRow({
                jobid,
                item,
                index,
                status: getStatus(jobid, true, true),
            })
        )

    // Sort: running first, then failed, then completed.
    const statusOrder = {
        running: 0,
        failed: 1,
        completed: 2,
    } satisfies Record<JobRow['status'], number>

    return [...runningRows, ...failedRows, ...completedRows].sort(
        (a, b) => statusOrder[a.status] - statusOrder[b.status]
    )
}

export async function stopJob(jobid: number) {
    await rclone('/job/stop', {
        params: { query: { jobid } },
    })
}
