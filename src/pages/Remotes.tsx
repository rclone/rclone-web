import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HardDriveIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { RefreshButton } from '@/components/RefreshButton'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
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
import rclone from '@/rclone/client'

interface RemoteUsage {
    used: number
    total: number
    free: number
    usedLabel: string
    totalLabel: string
    percentLabel: string
    barPercent: number
}

function parseUsage(data: { used?: number; total?: number; free?: number }): RemoteUsage | null {
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

export function RemotesPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const remotesQuery = useQuery({
        queryKey: ['remotes'],
        queryFn: async () => {
            const [listResponse, dumpResponse] = await Promise.all([
                rclone('/config/listremotes'),
                rclone('/config/dump'),
            ])

            const names = [...(listResponse.remotes ?? [])].sort((a, b) => a.localeCompare(b))
            const configs = (dumpResponse ?? {}) as Record<string, Record<string, string>>

            const remotes = await Promise.all(
                names.map(async (name) => {
                    let usage: RemoteUsage | null = null
                    try {
                        const aboutResponse = await rclone('/operations/about', {
                            params: { query: { fs: `${name}:` } },
                        })
                        usage = parseUsage(
                            aboutResponse as { used?: number; total?: number; free?: number }
                        )
                    } catch {
                        // Remote doesn't support about - leave usage null
                    }

                    return {
                        name,
                        type: configs[name]?.type ?? 'unknown',
                        usage,
                    }
                })
            )

            return remotes
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async (name: string) => {
            await rclone('/config/delete', {
                params: { query: { name } },
            })
        },
        onSuccess: () => {
            toast.success('Remote deleted successfully.')
            queryClient.invalidateQueries({ queryKey: ['remotes'] })
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Unknown error occurred'
            toast.error(`Could not delete remote: ${message}`)
        },
    })

    const remotes = remotesQuery.data ?? []

    return (
        <PageWrapper>
            <PageHeader
                title="Remotes"
                description="Manage connected storage remotes and monitor usage."
                actions={
                    <div className="flex items-center gap-2">
                        <Button size="lg" type="button" onClick={() => navigate('/remotes/new')}>
                            <PlusIcon />
                            Add New Remote
                        </Button>
                        <RefreshButton
                            isFetching={remotesQuery.isFetching}
                            refetch={remotesQuery.refetch}
                        />
                    </div>
                }
            />

            <PageContent>
                {remotesQuery.isPending ? (
                    <div className="overflow-hidden border rounded-xl">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="hover:bg-muted/40">
                                    <TableHead className="px-6 font-semibold uppercase h-14 text-muted-foreground">
                                        Name
                                    </TableHead>
                                    <TableHead className="px-4 font-semibold uppercase h-14 text-muted-foreground">
                                        Type
                                    </TableHead>
                                    <TableHead className="px-4 font-semibold uppercase h-14 text-muted-foreground">
                                        Usage
                                    </TableHead>
                                    <TableHead className="px-4 font-semibold text-right uppercase h-14 text-muted-foreground">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                        </Table>
                        <div className="flex items-center justify-center px-6 py-14">
                            <Spinner className="size-8" />
                        </div>
                    </div>
                ) : null}

                {remotesQuery.isError ? (
                    <Alert variant="destructive">
                        <AlertTitle>Unable to load remotes</AlertTitle>
                        <AlertDescription>
                            {remotesQuery.error instanceof Error
                                ? remotesQuery.error.message
                                : 'Unknown error occurred'}
                        </AlertDescription>
                        <AlertAction>
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                    remotesQuery.refetch()
                                }}
                            >
                                Retry
                            </Button>
                        </AlertAction>
                    </Alert>
                ) : null}

                {remotesQuery.isSuccess && remotes.length === 0 ? (
                    <Empty className="rounded-xl border">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <HardDriveIcon />
                            </EmptyMedia>
                            <EmptyTitle>No remotes configured</EmptyTitle>
                            <EmptyDescription>Add a new remote to get started.</EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/remotes/new')}
                            >
                                Add New Remote
                            </Button>
                        </EmptyContent>
                    </Empty>
                ) : null}

                {remotes.length > 0 ? (
                    <div className="overflow-hidden border rounded-xl">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="hover:bg-muted/40">
                                    <TableHead className="px-6 font-semibold uppercase h-14 text-muted-foreground">
                                        Name
                                    </TableHead>
                                    <TableHead className="px-4 font-semibold uppercase h-14 text-muted-foreground">
                                        Type
                                    </TableHead>
                                    <TableHead className="px-4 font-semibold uppercase h-14 text-muted-foreground">
                                        Usage
                                    </TableHead>
                                    <TableHead className="px-4 font-semibold text-right uppercase h-14 text-muted-foreground">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {remotes.map((remote) => (
                                    <TableRow
                                        key={remote.name}
                                        className="hover:bg-muted/20"
                                        onClick={() => navigate(`/remotes/${remote.name}`)}
                                    >
                                        <TableCell className="px-6 py-6">
                                            <Link
                                                to={`/remotes/${remote.name}`}
                                                className="inline-flex cursor-pointer rounded-md outline-none group focus-visible:ring-2 focus-visible:ring-ring"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <span className="text-lg font-semibold group-hover:text-primary">
                                                    {remote.name}
                                                </span>
                                            </Link>
                                        </TableCell>

                                        <TableCell className="px-4 py-6">
                                            <span className="font-mono text-base text-muted-foreground">
                                                {remote.type}
                                            </span>
                                        </TableCell>

                                        <TableCell className="px-4 py-6">
                                            {remote.usage ? (
                                                <div className="w-[240px] space-y-2">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-mono text-sm text-muted-foreground">
                                                            {remote.usage.usedLabel} /{' '}
                                                            {remote.usage.totalLabel}
                                                        </span>
                                                        <span className="font-mono text-sm text-muted-foreground">
                                                            {remote.usage.percentLabel}
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                                        <div
                                                            className={cn(
                                                                'h-full rounded-full transition-all',
                                                                remote.usage.barPercent >= 85
                                                                    ? 'bg-destructive'
                                                                    : 'bg-primary'
                                                            )}
                                                            style={{
                                                                width: `${remote.usage.barPercent}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="font-mono text-sm text-muted-foreground">
                                                    --
                                                </span>
                                            )}
                                        </TableCell>

                                        <TableCell
                                            className="px-4 py-6"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <Tooltip>
                                                    <TooltipTrigger
                                                        render={
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon-xs"
                                                                aria-label={`Edit ${remote.name}`}
                                                                onClick={() =>
                                                                    navigate(
                                                                        `/remotes/${remote.name}/edit`
                                                                    )
                                                                }
                                                            >
                                                                <PencilIcon className="size-3.5" />
                                                            </Button>
                                                        }
                                                    />
                                                    <TooltipContent>Edit</TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger
                                                        render={
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon-xs"
                                                                aria-label={`Delete ${remote.name}`}
                                                                disabled={deleteMutation.isPending}
                                                                onClick={() => {
                                                                    if (
                                                                        window.confirm(
                                                                            `Are you sure you want to delete the remote "${remote.name}"?`
                                                                        )
                                                                    ) {
                                                                        deleteMutation.mutate(
                                                                            remote.name
                                                                        )
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2Icon className="size-3.5" />
                                                            </Button>
                                                        }
                                                    />
                                                    <TooltipContent>Delete</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : null}
            </PageContent>
        </PageWrapper>
    )
}
