import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { type TranslationKey, t as tStandalone, useT } from '@/lib/i18n'
import { cn } from '@/lib/ui'
import rclone from '@/rclone/client'
import { fetchJobsSnapshot, type JobRow } from '@/rclone/jobs'
import { fetchRemotesList, fetchRemoteUsage, type RemoteWithUsage } from '@/rclone/usage'
import { getRemoteName, getServeAuthLabel } from '@/rclone/utils'

const LINKS: readonly { key: TranslationKey; href: string }[] = [
    { key: 'dashboard.linkDocs', href: 'https://rclone.org/docs/' },
    { key: 'dashboard.linkForum', href: 'https://forum.rclone.org/' },
    { key: 'dashboard.linkGithub', href: 'https://github.com/rclone/rclone' },
    { key: 'dashboard.linkBusiness', href: 'https://rclone.com/' },
]

export function DashboardPage() {
    const t = useT()
    const queryClient = useQueryClient()
    const sponsorQuery = useQuery({
        queryKey: ['sponsor'],
        queryFn: fetchSponsor,
        staleTime: 24 * 60 * 60 * 1000,
        enabled: !import.meta.env.DEV,
    })
    const sponsor = sponsorQuery.data ?? null

    const remotesListQuery = useQuery({
        queryKey: ['remotes', 'list'],
        queryFn: fetchRemotesList,
    })
    const remotesList = useMemo(() => remotesListQuery.data ?? [], [remotesListQuery.data])
    const usageQueries = useQueries({
        queries: remotesList.map((remote) => ({
            queryKey: ['remotes', 'usage', remote.name] as const,
            queryFn: ({ queryKey: [, , qName] }: { queryKey: readonly string[] }) =>
                fetchRemoteUsage(qName, remote.type),
            staleTime: 5 * 60 * 1000,
            retry: false,
        })),
    })
    const mountsQuery = useQuery({
        queryKey: ['mounts'],
        queryFn: async () => {
            const response = await rclone('/mount/listmounts')
            return response.mountPoints ?? []
        },
    })
    const servesQuery = useQuery({
        queryKey: ['serves'],
        queryFn: async () => {
            const response = await rclone('/serve/list')
            return response.list ?? []
        },
    })
    const jobsQuery = useQuery({
        queryKey: ['jobs'],
        queryFn: fetchJobsSnapshot,
        refetchInterval: 3000,
    })
    const globalStatsQuery = useQuery({
        queryKey: ['core', 'stats'],
        queryFn: async () => await rclone('/core/stats'),
        refetchInterval: 3000,
    })
    const versionQuery = useQuery({
        queryKey: ['core', 'version'],
        queryFn: async () => await rclone('/core/version'),
        staleTime: Infinity,
    })

    const remotes = useMemo((): RemoteWithUsage[] => {
        return remotesList.map((remote, i) => {
            const status = usageQueries[i]?.data
            return {
                ...remote,
                usage: status?.state === 'success' ? status.usage : null,
                reachable: status
                    ? status.state !== 'auth_error' && status.state !== 'error'
                    : true,
            }
        })
    }, [remotesList, usageQueries])
    const mounts = useMemo(() => mountsQuery.data ?? [], [mountsQuery.data])
    const serves = useMemo(() => {
        const list = servesQuery.data ?? []
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
    }, [servesQuery.data])
    const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data])
    const globalStats = useMemo(() => globalStatsQuery.data, [globalStatsQuery.data])
    const lastError = typeof globalStats?.lastError === 'string' ? globalStats.lastError.trim() : ''
    const lastErrorJob = useMemo(() => getLastErrorJob(jobs, lastError), [jobs, lastError])
    const lastErrorLocation = useMemo(() => getJobLocationLabel(lastErrorJob), [lastErrorJob])
    const runningJobsCount = new Set(
        jobs.filter((job) => job.status === 'running').map((job) => job.id)
    ).size
    const recentFailedJobs = useMemo(() => getJobAttention(jobs), [jobs])
    const remoteErrors = useMemo(() => getRemoteErrors(remotes), [remotes])
    const remoteAttention = useMemo(() => getRemoteAttention(remotes), [remotes])
    const serveAttention = useMemo(() => getServeAttention(serves), [serves])
    const isFetchingAny =
        remotesListQuery.isFetching ||
        servesQuery.isFetching ||
        mountsQuery.isFetching ||
        jobsQuery.isFetching ||
        globalStatsQuery.isFetching ||
        versionQuery.isFetching

    const handleRefresh = useCallback(async () => {
        queryClient.refetchQueries({ type: 'active' })
    }, [queryClient])

    return (
        <PageWrapper>
            <PageHeader
                title={t('dashboard.title')}
                description={t('dashboard.description')}
                actions={<RefreshButton isFetching={isFetchingAny} refetch={handleRefresh} />}
            />

            <PageContent>
                <div className="space-y-6">
                    {sponsor?.type === 'banner' ? (
                        <section className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 text-sm text-card-foreground ring-1 ring-foreground/10">
                            <p>{sponsor.message}</p>
                            <a
                                href={sponsor.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label="Visit sponsor"
                            >
                                <ExternalLinkIcon className="size-3.5" />
                            </a>
                        </section>
                    ) : null}

                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <DashboardMetricCard
                            title={t('dashboard.remotes')}
                            value={String(remotes.length)}
                            icon={CloudIcon}
                            attention={
                                remoteErrors.length > 0
                                    ? {
                                          heading: t('dashboard.remotesUnreachable'),
                                          items: remoteErrors,
                                      }
                                    : remoteAttention.length > 0
                                      ? {
                                            heading: t('dashboard.remotesNearingFull'),
                                            items: remoteAttention,
                                        }
                                      : undefined
                            }
                            isPending={remotesListQuery.isPending}
                            isError={remotesListQuery.isError}
                        />

                        <DashboardMetricCard
                            title={t('dashboard.mounts')}
                            value={String(mounts.length)}
                            icon={HardDriveIcon}
                            isPending={mountsQuery.isPending}
                            isError={mountsQuery.isError}
                        />

                        <DashboardMetricCard
                            title={t('dashboard.serves')}
                            value={String(serves.length)}
                            icon={GlobeIcon}
                            attention={
                                serveAttention.length > 0
                                    ? {
                                          heading: t('dashboard.servesNoAuth'),
                                          items: serveAttention,
                                      }
                                    : undefined
                            }
                            isPending={servesQuery.isPending}
                            isError={servesQuery.isError}
                        />

                        {sponsor?.type === 'card' ? (
                            <a href={sponsor.link} target="_blank" rel="noreferrer">
                                <Card className="relative h-full overflow-hidden py-0">
                                    <img
                                        src={sponsor.image}
                                        alt=""
                                        aria-hidden
                                        className="absolute inset-0 size-full scale-110 object-cover blur-lg"
                                    />
                                    <img
                                        src={sponsor.image}
                                        alt="Sponsor"
                                        className="relative size-full object-contain"
                                    />
                                </Card>
                            </a>
                        ) : (
                            <DashboardMetricCard
                                title={t('dashboard.operations')}
                                value={String(runningJobsCount)}
                                icon={ActivityIcon}
                                attention={
                                    recentFailedJobs.length > 0
                                        ? {
                                              heading: t('dashboard.recentFailedJobs'),
                                              items: recentFailedJobs,
                                          }
                                        : undefined
                                }
                                isPending={jobsQuery.isPending}
                                isError={jobsQuery.isError}
                            />
                        )}
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>{t('dashboard.statsTitle')}</CardTitle>
                                <CardDescription>{t('dashboard.statsDescription')}</CardDescription>
                            </CardHeader>

                            <CardContent className="flex flex-1">
                                {globalStatsQuery.isPending && !globalStats ? (
                                    <div className="flex items-center justify-center flex-1 py-12">
                                        <Spinner className="size-7" />
                                    </div>
                                ) : globalStatsQuery.isError ? (
                                    <p className="self-center text-sm text-muted-foreground">
                                        {t('dashboard.statsError')}
                                    </p>
                                ) : (
                                    <dl className="grid flex-1 h-full gap-x-6 gap-y-4 md:auto-rows-fr md:grid-cols-2">
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                {t('dashboard.bytesTransferred')}
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {formatBytes(globalStats?.bytes ?? 0)}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                {t('dashboard.averageSpeed')}
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {`${formatBytes(globalStats?.speed ?? 0)}PS`}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                {t('dashboard.checks')}
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {globalStats?.checks ?? 0}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                {t('dashboard.deletes')}
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {globalStats?.deletes ?? 0}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                {t('dashboard.runningSince')}
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {formatDuration(globalStats?.elapsedTime ?? 0)}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                {t('dashboard.errors')}
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {globalStats?.errors ?? 0}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                {t('dashboard.transfers')}
                                            </dt>
                                            <dd className="text-lg font-medium tabular-nums">
                                                {globalStats?.transfers ?? 0}
                                            </dd>
                                        </div>
                                        <div className="p-4 space-y-1 border rounded-lg">
                                            <dt className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                                                {t('dashboard.lastError')}
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
                                                        {t('dashboard.jobs')}
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
                                <CardTitle>{t('dashboard.aboutTitle')}</CardTitle>
                                <CardDescription>{t('dashboard.aboutDescription')}</CardDescription>
                            </CardHeader>

                            <CardContent>
                                {versionQuery.isPending && !versionQuery.data ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Spinner className="size-7" />
                                    </div>
                                ) : versionQuery.isError ? (
                                    <div className="space-y-3">
                                        <p className="text-sm text-muted-foreground">
                                            {t('dashboard.versionError')}
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
                                                    {t(link.key)}
                                                </span>
                                                <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                                            <span className="text-sm text-muted-foreground">
                                                {t('dashboard.version')}
                                            </span>
                                            <span className="font-mono text-sm">
                                                {versionQuery.data?.version || '--'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                                            <span className="text-sm text-muted-foreground">
                                                {t('dashboard.os')}
                                            </span>
                                            <span className="font-mono text-sm">
                                                {versionQuery.data?.os || '--'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                                            <span className="text-sm text-muted-foreground">
                                                {t('dashboard.arch')}
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
                                                    {t(link.key)}
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
    const t = useT()
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
                    <div className="text-sm text-muted-foreground">
                        {t('dashboard.refreshToRetry')}
                    </div>
                ) : isPending ? (
                    <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
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
                                    {t('dashboard.needsAttention')}
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
                                    <p className="text-background/70">
                                        {t('dashboard.countMore', {
                                            count: String(remainingCount),
                                        })}
                                    </p>
                                ) : null}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2Icon className="size-4 text-emerald-500" />
                        {t('dashboard.ok')}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function getRemoteErrors(remotes: RemoteWithUsage[]) {
    return remotes
        .filter((remote) => !remote.reachable)
        .map((remote) => ({
            title: remote.name,
            description: tStandalone('dashboard.notReachable'),
        }))
}

function getRemoteAttention(remotes: RemoteWithUsage[]) {
    return remotes
        .filter((remote) => {
            const percent = remote.usage?.barPercent ?? 0
            const threshold = remote.type === 'local' ? 99 : 85
            return percent >= threshold
        })
        .sort((a, b) => (b.usage?.barPercent ?? 0) - (a.usage?.barPercent ?? 0))
        .map((remote) => ({
            title: remote.name,
            description: tStandalone('dashboard.percentUsed', {
                percent: remote.usage?.percentLabel ?? '--',
            }),
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
                title: tStandalone('dashboard.jobTitle', { id: String(job.id) }),
                description: job.errorText || tStandalone('dashboard.jobFailed'),
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

type Sponsor =
    | { type: 'banner'; message: string; link: string }
    | { type: 'card'; image: string; link: string }

async function fetchSponsor(): Promise<Sponsor | null> {
    const res = await fetch('https://cdn.jsdelivr.net/gh/rclone/rclone-web@main/src/sponsor.json')
    if (!res.ok) return null
    const data = await res.json()
    if (!data || typeof data !== 'object') return null
    const obj = data as Record<string, unknown>
    if (typeof obj.link !== 'string') return null
    if (obj.type === 'banner' && typeof obj.message === 'string') {
        return { type: 'banner', message: obj.message, link: obj.link }
    }
    if (obj.type === 'card' && typeof obj.image === 'string') {
        return { type: 'card', image: obj.image, link: obj.link }
    }
    return null
}
