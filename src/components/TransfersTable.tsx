import { CheckCircle2Icon, RefreshCwIcon, XCircleIcon } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/ui'
import type { JobRow } from '@/rclone/jobs'

function getTransferredLabel(job: JobRow) {
    if (job.totalBytes > 0) {
        return `${formatBytes(job.bytes)} / ${formatBytes(job.totalBytes)}`
    }

    return formatBytes(job.bytes)
}

function TransferLocationCell({ value }: { value: string }) {
    return (
        <span className="block whitespace-normal leading-5 break-all text-sm">{value || '—'}</span>
    )
}

const statusUi: Record<
    JobRow['status'],
    {
        label: string
        icon: typeof RefreshCwIcon
        badgeClassName: string
        progressClassName: string
    }
> = {
    running: {
        label: 'RUNNING',
        icon: RefreshCwIcon,
        badgeClassName: 'bg-emerald-500/15 text-emerald-500',
        progressClassName: 'bg-emerald-500',
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
}

const columnWidths = {
    id: 'w-[92px]',
    status: 'w-[168px]',
    source: 'w-[320px]',
    destination: 'w-[372px]',
    progress: 'w-[284px]',
    speed: 'w-[152px]',
    eta: 'w-[152px]',
    actions: 'w-[124px]',
} as const

export function TransfersTable({
    jobs,
    onStop,
    isStopping,
}: {
    jobs: JobRow[]
    onStop: (jobid: number) => void
    isStopping: boolean
}) {
    return (
        <div className="overflow-hidden rounded-xl border">
            <Table className="min-w-[1664px] table-fixed">
                <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-muted/40">
                        <TableHead
                            className={cn(
                                columnWidths.id,
                                'h-12 px-4 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            GROUP
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.status,
                                'h-12 px-4 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            STATUS
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.source,
                                'h-12 px-4 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            SOURCE
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.destination,
                                'h-12 px-4 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            DESTINATION
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.progress,
                                'h-12 px-4 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            PROGRESS
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.speed,
                                'h-12 px-4 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            SPEED
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.eta,
                                'h-12 px-4 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            ETA
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.actions,
                                'h-12 px-4 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            ACTIONS
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {jobs.map((job) => {
                        const ui = statusUi[job.status]
                        const StatusIcon = ui.icon
                        const badge = (
                            <Badge
                                className={cn(
                                    'h-7 gap-1.5 px-2.5 text-xs tracking-wide',
                                    ui.badgeClassName
                                )}
                                variant="secondary"
                            >
                                <StatusIcon
                                    className={cn(
                                        'size-3.5',
                                        job.status === 'running' && 'animate-spin'
                                    )}
                                />
                                {ui.label}
                            </Badge>
                        )

                        return (
                            <TableRow key={job.rowKey} className="hover:bg-muted/20">
                                <TableCell
                                    className={cn(
                                        columnWidths.id,
                                        'px-4 py-4 text-left font-mono text-base font-medium text-muted-foreground tabular-nums align-middle'
                                    )}
                                >
                                    #{job.id}
                                </TableCell>

                                <TableCell
                                    className={cn(
                                        columnWidths.status,
                                        'px-4 py-4 text-left align-middle'
                                    )}
                                >
                                    <div className="flex justify-start">
                                        {job.status === 'failed' && job.errorText ? (
                                            <Tooltip>
                                                <TooltipTrigger render={badge} />
                                                <TooltipContent
                                                    side="bottom"
                                                    align="start"
                                                    className="max-w-sm p-3 text-left text-sm leading-5 whitespace-pre-wrap break-words"
                                                >
                                                    {job.errorText}
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            badge
                                        )}
                                    </div>
                                </TableCell>

                                <TableCell
                                    className={cn(
                                        columnWidths.source,
                                        'px-4 py-4 text-left align-middle'
                                    )}
                                >
                                    <TransferLocationCell value={job.source} />
                                </TableCell>

                                <TableCell
                                    className={cn(
                                        columnWidths.destination,
                                        'px-4 py-4 text-left align-middle'
                                    )}
                                >
                                    <TransferLocationCell value={job.destination} />
                                </TableCell>

                                <TableCell
                                    className={cn(
                                        columnWidths.progress,
                                        'px-4 py-4 text-left align-middle'
                                    )}
                                >
                                    <div className="w-full max-w-[260px] space-y-2">
                                        <div className="flex items-center justify-between gap-4 text-sm tabular-nums">
                                            <span className="font-medium">{job.progress}%</span>
                                            <span className="text-muted-foreground">
                                                {getTransferredLabel(job)}
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full transition-all',
                                                    ui.progressClassName
                                                )}
                                                style={{ width: `${job.progress}%` }}
                                            />
                                        </div>
                                    </div>
                                </TableCell>

                                <TableCell
                                    className={cn(
                                        columnWidths.speed,
                                        'px-4 py-4 text-left text-base font-medium tabular-nums align-middle'
                                    )}
                                >
                                    {job.speedLabel}
                                </TableCell>

                                <TableCell
                                    className={cn(
                                        columnWidths.eta,
                                        'px-4 py-4 text-left text-base font-medium tabular-nums align-middle'
                                    )}
                                >
                                    {job.etaLabel}
                                </TableCell>

                                <TableCell
                                    className={cn(
                                        columnWidths.actions,
                                        'px-4 py-4 text-left align-middle'
                                    )}
                                >
                                    {job.canStop ? (
                                        <div className="flex justify-start">
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                disabled={isStopping}
                                                onClick={() => onStop(job.id)}
                                            >
                                                Stop
                                            </Button>
                                        </div>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
