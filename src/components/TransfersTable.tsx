import { CheckCircle2Icon, RefreshCwIcon, XCircleIcon } from 'lucide-react'
import { PathLabel } from '@/components/PathLabel'
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
import type { TranslationKey } from '@/lib/i18n'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/ui'
import type { JobRow } from '@/rclone/jobs'

function getTransferredLabel(job: JobRow) {
    if (job.totalBytes > 0) {
        return `${formatBytes(job.bytes)} / ${formatBytes(job.totalBytes)}`
    }

    return formatBytes(job.bytes)
}

function TransferLocationCell({ value }: { value: string }) {
    return <PathLabel value={value} className="text-xs leading-4" />
}

const statusUi: Record<
    JobRow['status'],
    {
        label: TranslationKey
        icon: typeof RefreshCwIcon
        badgeClassName: string
        progressClassName: string
    }
> = {
    running: {
        label: 'transfersTable.running',
        icon: RefreshCwIcon,
        badgeClassName: 'bg-emerald-500/15 text-emerald-500',
        progressClassName: 'bg-emerald-500',
    },
    completed: {
        label: 'transfersTable.completed',
        icon: CheckCircle2Icon,
        badgeClassName: 'bg-sky-500/15 text-sky-500',
        progressClassName: 'bg-sky-500',
    },
    failed: {
        label: 'transfersTable.failed',
        icon: XCircleIcon,
        badgeClassName: 'bg-destructive/15 text-destructive',
        progressClassName: 'bg-destructive',
    },
}

const columnWidths = {
    id: 'w-[64px]',
    status: 'w-[112px]',
    source: 'w-[240px]',
    destination: 'w-[240px]',
    progress: 'w-[220px]',
    speed: 'w-[100px]',
    eta: 'w-[100px]',
    actions: 'w-[80px]',
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
    const t = useT()
    return (
        <div className="overflow-hidden rounded-xl border">
            <Table className="min-w-[1156px] table-fixed text-xs">
                <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-muted/40">
                        <TableHead
                            className={cn(
                                columnWidths.id,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('transfersTable.group')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.status,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('transfersTable.status')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.source,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('transfersTable.source')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.destination,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('transfersTable.destination')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.progress,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('transfersTable.progress')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.speed,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('transfersTable.speed')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.eta,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('transfersTable.eta')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.actions,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('transfersTable.actions')}
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
                                    'h-6 gap-1 px-1.5 text-xs tracking-wide',
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
                                {t(ui.label)}
                            </Badge>
                        )

                        return (
                            <TableRow key={job.rowKey} className="hover:bg-muted/20">
                                <TableCell
                                    className={cn(
                                        columnWidths.id,
                                        'px-2 py-1.5 text-left font-mono text-xs font-medium text-muted-foreground tabular-nums align-middle'
                                    )}
                                >
                                    #{job.id}
                                </TableCell>

                                <TableCell
                                    className={cn(
                                        columnWidths.status,
                                        'px-2 py-1.5 text-left align-middle'
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
                                        'px-2 py-1.5 text-left align-middle'
                                    )}
                                >
                                    <TransferLocationCell value={job.source} />
                                </TableCell>

                                <TableCell
                                    className={cn(
                                        columnWidths.destination,
                                        'px-2 py-1.5 text-left align-middle'
                                    )}
                                >
                                    <TransferLocationCell value={job.destination} />
                                </TableCell>

                                <TableCell
                                    className={cn(
                                        columnWidths.progress,
                                        'px-2 py-1.5 text-left align-middle'
                                    )}
                                >
                                    <div className="w-full max-w-[204px] space-y-1">
                                        <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                                            <span className="font-medium">{job.progress}%</span>
                                            <span className="text-muted-foreground">
                                                {getTransferredLabel(job)}
                                            </span>
                                        </div>
                                        <div className="h-1 overflow-hidden rounded-full bg-muted">
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
                                        'px-2 py-1.5 text-left text-xs font-medium tabular-nums align-middle'
                                    )}
                                >
                                    {job.speedLabel}
                                </TableCell>

                                <TableCell
                                    className={cn(
                                        columnWidths.eta,
                                        'px-2 py-1.5 text-left text-xs font-medium tabular-nums align-middle'
                                    )}
                                >
                                    {job.etaLabel}
                                </TableCell>

                                <TableCell
                                    className={cn(
                                        columnWidths.actions,
                                        'px-2 py-1.5 text-left align-middle'
                                    )}
                                >
                                    {job.canStop ? (
                                        <div className="flex justify-start">
                                            <Button
                                                size="xs"
                                                variant="destructive"
                                                disabled={isStopping}
                                                onClick={() => onStop(job.id)}
                                            >
                                                {t('common.stop')}
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
