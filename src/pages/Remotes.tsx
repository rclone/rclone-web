import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangleIcon, HardDriveIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { Input } from '@/components/ui/input'
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
import { cn } from '@/lib/ui'
import rclone from '@/rclone/client'
import { fetchRemotesList, fetchRemoteUsage, type UsageStatus } from '@/rclone/usage'

export function RemotesPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const remotesListQuery = useQuery({
        queryKey: ['remotes', 'list'],
        queryFn: fetchRemotesList,
    })

    const [search, setSearch] = useState('')

    const remotes = remotesListQuery.data ?? []

    const filteredRemotes = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return remotes
        return remotes.filter(
            (r) => r.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
        )
    }, [remotes, search])

    const usageQueries = useQueries({
        queries: remotes.map((remote) => ({
            queryKey: ['remotes', 'usage', remote.name],
            queryFn: () => fetchRemoteUsage(remote.name, remote.type),
            staleTime: 5 * 60 * 1000,
            retry: false,
        })),
    })

    const isFetchingUsage = useMemo(() => usageQueries.some((q) => q.isFetching), [usageQueries])

    const usageByName = useMemo(() => {
        const map = new Map<string, (typeof usageQueries)[number]>()
        remotes.forEach((remote, i) => map.set(remote.name, usageQueries[i]))
        return map
    }, [remotes, usageQueries])

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

    return (
        <PageWrapper>
            <PageHeader
                title="Remotes"
                description="Manage connected storage remotes and monitor usage."
                actions={
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="Search by name or type"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-56"
                        />
                        <Button size="lg" type="button" onClick={() => navigate('/remotes/new')}>
                            <PlusIcon />
                            Add New Remote
                        </Button>
                        <RefreshButton
                            isFetching={remotesListQuery.isFetching || isFetchingUsage}
                            refetch={remotesListQuery.refetch}
                        />
                    </div>
                }
            />

            <PageContent>
                {remotesListQuery.isPending ? (
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

                {remotesListQuery.isError ? (
                    <Alert variant="destructive">
                        <AlertTitle>Unable to load remotes</AlertTitle>
                        <AlertDescription>
                            {remotesListQuery.error instanceof Error
                                ? remotesListQuery.error.message
                                : 'Unknown error occurred'}
                        </AlertDescription>
                        <AlertAction>
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                    remotesListQuery.refetch()
                                }}
                            >
                                Retry
                            </Button>
                        </AlertAction>
                    </Alert>
                ) : null}

                {remotesListQuery.isSuccess && filteredRemotes.length === 0 && !search ? (
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

                {filteredRemotes.length > 0 ? (
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
                                {filteredRemotes.map((remote) => (
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
                                            <UsageCell
                                                status={usageByName.get(remote.name)?.data}
                                                isLoading={usageByName.get(remote.name)?.isLoading ?? true}
                                            />
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

function UsageCell({ status, isLoading }: { status: UsageStatus | undefined; isLoading: boolean }) {
    if (isLoading) {
        return <Spinner className="size-4" />
    }

    if (!status || status.state === 'idle' || status.state === 'loading') {
        return <span className="font-mono text-sm text-muted-foreground">--</span>
    }

    switch (status.state) {
        case 'success':
            return (
                <div className="w-[240px] space-y-2">
                    <div className="flex items-center justify-between gap-4">
                        <span className="font-mono text-sm text-muted-foreground">
                            {status.usage.usedLabel} / {status.usage.totalLabel}
                        </span>
                        <span className="font-mono text-sm text-muted-foreground">
                            {status.usage.percentLabel}
                        </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                            className={cn(
                                'h-full rounded-full transition-all',
                                status.usage.barPercent >= 85 ? 'bg-destructive' : 'bg-primary'
                            )}
                            style={{
                                width: `${status.usage.barPercent}%`,
                            }}
                        />
                    </div>
                </div>
            )

        case 'auth_error':
            return (
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                                <AlertTriangleIcon className="size-3.5" />
                                Needs reconnection
                            </span>
                        }
                    />
                    <TooltipContent className="max-w-sm">{status.message}</TooltipContent>
                </Tooltip>
            )

        case 'error':
            return (
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
                                <AlertTriangleIcon className="size-3.5" />
                                Error
                            </span>
                        }
                    />
                    <TooltipContent className="max-w-sm">{status.message}</TooltipContent>
                </Tooltip>
            )

        case 'unsupported':
        default:
            return <span className="font-mono text-sm text-muted-foreground">--</span>
    }
}
