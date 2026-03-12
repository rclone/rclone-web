import { Changelog } from '@/components/Changelog'
import { toRecord } from '@/components/OptionField'
import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { RefreshButton } from '@/components/RefreshButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatBytes, formatDuration, formatTime } from '@/lib/format'
import { cn } from '@/lib/ui'
import rclone from '@/rclone/client'
import { type JobRow, fetchJobsSnapshot } from '@/rclone/jobs'
import { type RemoteWithUsage, fetchRemotesWithUsage } from '@/rclone/usage'
import { getRemoteName, getServeAuthLabel } from '@/rclone/utils'
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    ActivityIcon,
    AlertTriangleIcon,
    ArrowRightIcon,
    CheckCircle2Icon,
    CloudIcon,
    ExternalLinkIcon,
    GlobeIcon,
    HardDriveIcon,
    type LucideIcon,
} from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'

const LINKS = [
    { label: 'Docs', href: 'https://rclone.org/docs/' },
    { label: 'Forum', href: 'https://forum.rclone.org/' },
    { label: 'GitHub', href: 'https://github.com/rclone/rclone' },
    { label: 'Business', href: 'https://rclone.com/' },
] as const

export function DashboardPage() {
    const queryClient = useQueryClient()
    const remotesQuery = useQuery({
        queryKey: ['dashboard', 'remotes'],
        queryFn: fetchRemotesWithUsage,
    })
    const mountsQuery = useQuery({
        queryKey: ['dashboard', 'mounts'],
        queryFn: async () => {
            const response = await rclone('/mount/listmounts')
            return response.mountPoints ?? []
        },
    })
    const servesQuery = useQuery({
        queryKey: ['dashboard', 'serves'],
        queryFn: async () => {
            const response = await rclone('/serve/list')
            const list = response.list ?? []

            return list.map((serve): ServeSummary => {
                const params = toRecord(serve.params)
                const fs = typeof params.fs === 'string' ? params.fs : ''

                return {
                    id: serve.id,
                    address: serve.addr,
                    protocol: typeof params.type === 'string' ? params.type : 'unknown',
                    remoteName: fs ? getRemoteName(fs) : 'Unknown',
                    source: fs,
                    auth: getServeAuthLabel(params),
                }
            })
        },
    })
    const jobsQuery = useQuery({
        queryKey: ['dashboard', 'jobs'],
        queryFn: fetchJobsSnapshot,
        refetchInterval: 3000,
    })
    const globalStatsQuery = useQuery({
        queryKey: ['dashboard', 'core', 'stats'],
        queryFn: async () => await rclone('/core/stats'),
        refetchInterval: 3000,
    })
    const versionQuery = useQuery({
        queryKey: ['dashboard', 'core', 'version'],
        queryFn: async () => await rclone('/core/version'),
        staleTime: 1000 * 60 * 5,
    })

    const remotes = useMemo(() => remotesQuery.data ?? [], [remotesQuery.data])
    const mounts = useMemo(() => mountsQuery.data ?? [], [mountsQuery.data])
    const serves = useMemo(() => servesQuery.data ?? [], [servesQuery.data])
    const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data])
    const globalStats = useMemo(() => globalStatsQuery.data, [globalStatsQuery.data])
    const lastError = typeof globalStats?.lastError === 'string' ? globalStats.lastError.trim() : ''
    const lastErrorJob = useMemo(() => getLastErrorJob(jobs, lastError), [jobs, lastError])
    const lastErrorLocation = useMemo(() => getJobLocationLabel(lastErrorJob), [lastErrorJob])
    const runningJobsCount = new Set(
        jobs.filter((job) => job.status === 'running').map((job) => job.id)
    ).size
    const recentFailedJobs = useMemo(() => getJobAttention(jobs), [jobs])
    const remoteAttention = useMemo(() => getRemoteAttention(remotes), [remotes])
    const serveAttention = useMemo(() => getServeAttention(serves), [serves])
    const isFetchingAny = useIsFetching({ queryKey: ['dashboard'] }) > 0

    const handleRefresh = useCallback(async () => {
        queryClient.refetchQueries({
            queryKey: ['dashboard'],
            type: 'active',
        })
    }, [queryClient])

    return (
        <PageWrapper>
            <PageHeader
                title="Dashboard"
                description="Monitor active resources, runtime status, and the current release notes."
                actions={<RefreshButton isFetching={isFetchingAny} refetch={handleRefresh} />}
            />

            <PageContent>
                <div className="space-y-6">
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <DashboardMetricCard
                            title="Remotes"
                            value={String(remotes.length)}
                            icon={CloudIcon}
                            attention={
                                remoteAttention.length > 0
                                    ? {
                                          heading: 'Remotes nearing full usage',
                                          items: remoteAttention,
                                      }
                                    : undefined
                            }
                            isPending={remotesQuery.isPending}
                            isError={remotesQuery.isError}
                        />

                        <DashboardMetricCard
                            title="Mounts"
                            value={String(mounts.length)}
                            icon={HardDriveIcon}
                            isPending={mountsQuery.isPending}
                            isError={mountsQuery.isError}
                        />

                        <DashboardMetricCard
                            title="Serves"
                            value={String(serves.length)}
                            icon={GlobeIcon}
                            attention={
                                serveAttention.length > 0
                                    ? {
                                          heading: 'Serves without authentication',
                                          items: serveAttention,
                                      }
                                    : undefined
                            }
                            isPending={servesQuery.isPending}
                            isError={servesQuery.isError}
                        />

                        <DashboardMetricCard
                            title="Operations"
                            value={String(runningJobsCount)}
                            icon={ActivityIcon}
                            attention={
                                recentFailedJobs.length > 0
                                    ? {
                                          heading: 'Recent failed jobs',
                                          items: recentFailedJobs,
                                      }
                                    : undefined
                            }
                            isPending={jobsQuery.isPending}
                            isError={jobsQuery.isError}
                        />
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>Stats</CardTitle>
                                <CardDescription>Global transfer counters.</CardDescription>
                            </CardHeader>

                            <CardContent className="flex flex-1">
                                {globalStatsQuery.isPending && !globalStats ? (
                                    <div className="flex items-center justify-center flex-1 py-12">
                                        <Spinner className="size-7" />
                                    </div>
                                ) : globalStatsQuery.isError ? (
                                    <p className="self-center text-sm text-muted-foreground">
                                        Unable to load global stats.
                                    </p>
                                ) : (
                                    <dl className="grid flex-1 h-full gap-x-6 gap-y-4 md:auto-rows-fr md:grid-cols-2">
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                Bytes Transferred
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {formatBytes(globalStats?.bytes ?? 0)}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                Average Speed
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {`${formatBytes(globalStats?.speed ?? 0)}PS`}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                Checks
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {globalStats?.checks ?? 0}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                Deletes
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {globalStats?.deletes ?? 0}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                Running Since
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {formatDuration(globalStats?.elapsedTime ?? 0)}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                Errors
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {globalStats?.errors ?? 0}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                Transfers
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {globalStats?.transfers ?? 0}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                Last Error
                                            </dt>
                                            <dd className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 space-y-1">
                                                    <p className="text-sm leading-6 break-words text-muted-foreground">
                                                        {lastError || '--'}
                                                    </p>
                                                    {lastErrorLocation ? (
                                                        <p className="text-xs leading-5 break-all text-muted-foreground">
                                                            {lastErrorLocation}
                                                        </p>
                                                    ) : null}
                                                </div>

                                                {lastError ? (
                                                    <Link
                                                        to="/transfers"
                                                        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                    >
                                                        Jobs
                                                        <ArrowRightIcon className="size-3.5" />
                                                    </Link>
                                                ) : null}
                                            </dd>
                                        </div>
                                    </dl>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>About</CardTitle>
                                <CardDescription>
                                    Runtime details and official rclone resources.
                                </CardDescription>
                            </CardHeader>

                            <CardContent>
                                {versionQuery.isPending && !versionQuery.data ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Spinner className="size-7" />
                                    </div>
                                ) : versionQuery.isError ? (
                                    <div className="space-y-3">
                                        <p className="text-sm text-muted-foreground">
                                            Unable to load version information.
                                        </p>

                                        {LINKS.map((link) => (
                                            <a
                                                key={link.href}
                                                href={link.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center justify-between gap-4 p-3 transition-colors border rounded-lg hover:bg-muted"
                                            >
                                                <span className="text-sm text-muted-foreground">
                                                    {link.label}
                                                </span>
                                                <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                                            <span className="text-sm text-muted-foreground">
                                                Version
                                            </span>
                                            <span className="font-mono text-sm">
                                                {versionQuery.data?.version || '--'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                                            <span className="text-sm text-muted-foreground">
                                                OS
                                            </span>
                                            <span className="font-mono text-sm">
                                                {versionQuery.data?.os || '--'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                                            <span className="text-sm text-muted-foreground">
                                                Arch
                                            </span>
                                            <span className="font-mono text-sm">
                                                {versionQuery.data?.arch || '--'}
                                            </span>
                                        </div>
                                        {LINKS.map((link) => (
                                            <a
                                                key={link.href}
                                                href={link.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center justify-between gap-4 p-3 transition-colors border rounded-lg hover:bg-muted"
                                            >
                                                <span className="text-sm text-muted-foreground">
                                                    {link.label}
                                                </span>
                                                <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    <Changelog />
                </div>
            </PageContent>
        </PageWrapper>
    )
}

type ServeSummary = {
    id: string
    address: string
    protocol: string
    remoteName: string
    source: string
    auth: 'none' | 'key' | 'basic' | 'proxy'
}

function DashboardMetricCard({
    title,
    value,
    icon: Icon,
    attention,
    isPending,
    isError,
}: {
    title: string
    value: string
    icon: LucideIcon
    attention?: {
        heading: string
        items: {
            title: string
            description: string
            meta?: string
        }[]
    }
    isPending: boolean
    isError: boolean
}) {
    const visibleItems = attention?.items.slice(0, 3) ?? []
    const remainingCount = attention ? Math.max(attention.items.length - visibleItems.length, 0) : 0

    return (
        <Card className={cn(attention && 'bg-amber-500/5 ring-amber-500/25')}>
            <CardHeader className="gap-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                        <CardDescription className="text-xs tracking-[0.16em] uppercase">
                            {title}
                        </CardDescription>
                        <CardTitle className="text-4xl font-semibold tracking-tight tabular-nums">
                            {isPending || isError ? '--' : value}
                        </CardTitle>
                    </div>

                    <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                {isError ? (
                    <div className="text-sm text-muted-foreground">Refresh to retry.</div>
                ) : isPending ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                ) : attention ? (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="xs"
                                    className="w-fit bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                                >
                                    <AlertTriangleIcon className="size-3.5" />
                                    Needs attention
                                </Button>
                            }
                        />
                        <TooltipContent side="bottom" align="start" className="max-w-sm p-3">
                            <div className="space-y-3 text-left">
                                <p className="font-medium">{attention.heading}</p>

                                <div className="space-y-2">
                                    {visibleItems.map((item) => (
                                        <div
                                            key={`${item.title}-${item.description}`}
                                            className="space-y-0.5"
                                        >
                                            <p className="font-medium text-background">
                                                {item.title}
                                            </p>
                                            {item.meta ? (
                                                <p className="text-background/70">
                                                    {formatTime(item.meta)}
                                                </p>
                                            ) : null}
                                            <p className="text-background/80">{item.description}</p>
                                        </div>
                                    ))}
                                </div>

                                {remainingCount > 0 ? (
                                    <p className="text-background/70">{`+${remainingCount} more`}</p>
                                ) : null}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2Icon className="size-4 text-emerald-500" />
                        All clear
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function getRemoteAttention(remotes: RemoteWithUsage[]) {
    return remotes
        .filter((remote) => (remote.usage?.barPercent ?? 0) >= 80)
        .sort((a, b) => (b.usage?.barPercent ?? 0) - (a.usage?.barPercent ?? 0))
        .map((remote) => ({
            title: remote.name,
            description: `${remote.usage?.percentLabel ?? '--'} used`,
        }))
}

function getServeAttention(serves: ServeSummary[]) {
    return serves
        .filter((serve) => serve.auth === 'none')
        .map((serve) => ({
            title: `${serve.protocol.toUpperCase()} · ${serve.remoteName}`,
            description: serve.address,
        }))
}

function getJobAttention(jobs: JobRow[]) {
    const seen = new Set<number>()

    return jobs
        .filter((job) => job.status === 'failed')
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .flatMap((job) => {
            if (seen.has(job.id)) {
                return []
            }

            seen.add(job.id)

            return {
                title: `Job ${job.id}`,
                description: job.errorText || 'Job failed',
                meta: job.startTime,
            }
        })
}

function getLastErrorJob(jobs: JobRow[], lastError: string) {
    if (!lastError) {
        return null
    }

    const jobsWithErrors = jobs
        .filter((job) => job.errorText.trim().length > 0)
        .sort((a, b) => getJobStartTime(b.startTime) - getJobStartTime(a.startTime))

    const matchedJob = jobsWithErrors.find((job) => jobMatchesLastError(job.errorText, lastError))

    if (matchedJob) {
        return matchedJob
    }

    return jobsWithErrors.length === 1 ? jobsWithErrors[0] : null
}

function jobMatchesLastError(jobErrorText: string, lastError: string) {
    const normalizedJobError = jobErrorText.trim()

    if (!normalizedJobError) {
        return false
    }

    if (normalizedJobError === lastError) {
        return true
    }

    return normalizedJobError.split('\n').some((line) => {
        const normalizedLine = line.trim()

        return (
            normalizedLine === lastError ||
            normalizedLine.endsWith(`: ${lastError}`) ||
            normalizedLine.includes(lastError) ||
            lastError.includes(normalizedLine)
        )
    })
}

function getJobLocationLabel(job: JobRow | null) {
    if (!job) {
        return ''
    }

    if (job.source !== '—' && job.destination !== '—') {
        return `${job.source} -> ${job.destination}`
    }

    if (job.source !== '—') {
        return job.source
    }

    if (job.destination !== '—') {
        return job.destination
    }

    return ''
}

function getJobStartTime(value: string) {
    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) ? timestamp : 0
}
