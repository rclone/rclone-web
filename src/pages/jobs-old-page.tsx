import {
    CheckCircle2Icon,
    PauseCircleIcon,
    PlayIcon,
    RefreshCwIcon,
    XCircleIcon,
} from 'lucide-react'
import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { RefreshButton } from '@/components/RefreshButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/ui'

const baseJobs = [
    {
        id: 'job-1',
        status: 'active',
        source: 'Google Drive',
        destination: 'AWS S3',
        progress: 68,
        transferred: '1.2 GB / 1.8 GB',
        eta: '2m 15s',
        speed: '4.5 MB/s',
        action: 'stop',
    },
    {
        id: 'job-2',
        status: 'active',
        source: 'Local Disk',
        destination: 'AWS Glacier',
        progress: 12,
        transferred: '15.4 GB / 128 GB',
        eta: '22m',
        speed: '85.2 MB/s',
        action: 'stop',
    },
    {
        id: 'job-3',
        status: 'paused',
        source: 'Dropbox',
        destination: 'Local Backup',
        progress: 42,
        transferred: '500 MB / 1.2 GB',
        eta: 'Paused',
        speed: '--',
        action: 'resume',
    },
    {
        id: 'job-4',
        status: 'completed',
        source: 'SharePoint',
        destination: 'Google Drive',
        progress: 100,
        transferred: '45 MB / 45 MB',
        eta: '--',
        speed: 'Avg. 2.1 MB/s',
        action: null,
    },
    {
        id: 'job-5',
        status: 'failed',
        source: 'SQL Server',
        destination: 'Azure Blob',
        progress: 45,
        transferred: '540 MB / 1.2 GB',
        eta: '--',
        speed: '--',
        action: null,
    },
] as const satisfies Array<{
    id: string
    status: 'active' | 'paused' | 'completed' | 'failed'
    source: string
    destination: string
    progress: number
    transferred: string
    eta: string
    speed: string
    action: 'stop' | 'resume' | null
}>

const jobs = [
    ...baseJobs,
    ...baseJobs.map((job) => ({
        ...job,
        id: `${job.id}-2`,
        source: `${job.source} (Set B)`,
        destination: `${job.destination} (Set B)`,
    })),
    ...baseJobs.map((job) => ({
        ...job,
        id: `${job.id}-3`,
        source: `${job.source} (Set C)`,
        destination: `${job.destination} (Set C)`,
    })),
]

const statusUi = {
    active: {
        label: 'ACTIVE',
        icon: RefreshCwIcon,
        badgeClassName: 'bg-emerald-500/15 text-emerald-500',
        progressClassName: 'bg-emerald-500',
    },
    paused: {
        label: 'PAUSED',
        icon: PauseCircleIcon,
        badgeClassName: 'bg-amber-500/15 text-amber-500',
        progressClassName: 'bg-amber-500',
    },
    completed: {
        label: 'COMPLETED',
        icon: CheckCircle2Icon,
        badgeClassName: 'bg-sky-500/15 text-sky-500',
        progressClassName: 'bg-sky-500',
    },
    failed: {
        label: 'FAILED',
        icon: XCircleIcon,
        badgeClassName: 'bg-destructive/15 text-destructive',
        progressClassName: 'bg-destructive',
    },
} as const

export function JobsOldPage() {
    return (
        <PageWrapper>
            <PageHeader
                title="Jobs"
                description="Manage active file transfers and view history."
                actions={<RefreshButton isFetching={false} refetch={() => {}} />}
            />
            <PageContent>
                <div className="overflow-hidden rounded-xl border">
                    <Table className="min-w-[1040px]">
                        <TableHeader className="bg-muted/40">
                            <TableRow className="hover:bg-muted/40">
                                <TableHead className="h-12 px-6 font-semibold text-muted-foreground">
                                    STATUS
                                </TableHead>
                                <TableHead className="h-12 px-4 font-semibold text-muted-foreground">
                                    SOURCE
                                </TableHead>
                                <TableHead className="h-12 px-4 font-semibold text-muted-foreground">
                                    DESTINATION
                                </TableHead>
                                <TableHead className="h-12 px-4 font-semibold text-muted-foreground">
                                    PROGRESS
                                </TableHead>
                                <TableHead className="h-12 px-4 font-semibold text-muted-foreground">
                                    SPEED
                                </TableHead>
                                <TableHead className="h-12 px-4 font-semibold text-muted-foreground">
                                    ETA
                                </TableHead>
                                <TableHead className="h-12 px-4 text-right font-semibold text-muted-foreground">
                                    ACTIONS
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {jobs.map((job) => {
                                const status = statusUi[job.status]
                                const StatusIcon = status.icon

                                return (
                                    <TableRow key={job.id} className="hover:bg-muted/20">
                                        <TableCell className="px-6 py-4">
                                            <Badge
                                                className={cn(
                                                    'h-7 gap-1.5 px-2.5 text-xs tracking-wide',
                                                    status.badgeClassName
                                                )}
                                                variant="secondary"
                                            >
                                                <StatusIcon
                                                    className={cn(
                                                        'size-3.5',
                                                        job.status === 'active' && 'animate-spin'
                                                    )}
                                                />
                                                {status.label}
                                            </Badge>
                                        </TableCell>

                                        <TableCell className="px-4 py-4">
                                            <span className="whitespace-normal leading-5">
                                                {job.source}
                                            </span>
                                        </TableCell>

                                        <TableCell className="px-4 py-4">
                                            <span className="whitespace-normal leading-5">
                                                {job.destination}
                                            </span>
                                        </TableCell>

                                        <TableCell className="px-4 py-4">
                                            <div className="w-[320px] space-y-2">
                                                <div className="flex items-center justify-between gap-4 text-sm tabular-nums">
                                                    <span className="font-medium">
                                                        {job.progress}%
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        {job.transferred}
                                                    </span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className={cn(
                                                            'h-full rounded-full transition-all',
                                                            status.progressClassName
                                                        )}
                                                        style={{ width: `${job.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell className="px-4 py-4 text-base font-medium tabular-nums">
                                            {job.speed}
                                        </TableCell>

                                        <TableCell className="px-4 py-4 text-base font-medium tabular-nums">
                                            {job.eta}
                                        </TableCell>

                                        <TableCell className="px-4 py-4 text-right">
                                            {job.action === 'stop' ? (
                                                <Button size="sm" variant="destructive">
                                                    Stop
                                                </Button>
                                            ) : null}
                                            {job.action === 'resume' ? (
                                                <Button size="sm" variant="secondary">
                                                    <PlayIcon />
                                                    Resume
                                                </Button>
                                            ) : null}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            </PageContent>
        </PageWrapper>
    )
}
