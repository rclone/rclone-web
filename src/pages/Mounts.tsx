import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { RefreshButton } from '@/components/RefreshButton'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { formatTime } from '@/lib/format'
import rclone from '@/rclone/client'
import { getRemoteName } from '@/rclone/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HardDriveIcon, PlusIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

function formatUptime(value: string) {
    const mountedOn = new Date(value)
    if (Number.isNaN(mountedOn.getTime())) {
        return 'Unknown'
    }

    const elapsedMs = Math.max(0, Date.now() - mountedOn.getTime())
    const totalMinutes = Math.floor(elapsedMs / 60_000)
    const days = Math.floor(totalMinutes / 1_440)
    const hours = Math.floor((totalMinutes % 1_440) / 60)
    const minutes = totalMinutes % 60

    if (days > 0) {
        return `${days}d ${hours}h`
    }

    if (hours > 0) {
        return `${hours}h ${minutes}m`
    }

    return `${minutes}m`
}

export function MountsPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const mountsQuery = useQuery({
        queryKey: ['mounts'],
        queryFn: async () => {
            const response = await rclone('/mount/listmounts')
            return response.mountPoints ?? []
        },
    })

    const unmountMutation = useMutation({
        mutationFn: async (mountPoint: string) => {
            await rclone('/mount/unmount', {
                params: { query: { mountPoint } },
            })
        },
        onSuccess: () => {
            toast.success('Mount ejected successfully.')
            queryClient.invalidateQueries({ queryKey: ['mounts'] })
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Unknown error occurred'
            toast.error(`Could not eject mount: ${message}`)
        },
    })

    const mounts = mountsQuery.data ?? []

    return (
        <PageWrapper>
            <PageHeader
                title="Mounts"
                description="Manage active remote mounts."
                actions={
                    <div className="flex items-center gap-2">
                        <Button size="lg" type="button" onClick={() => navigate('/mounts/new')}>
                            <PlusIcon />
                            New Mount
                        </Button>
                        <RefreshButton
                            isFetching={mountsQuery.isFetching}
                            refetch={mountsQuery.refetch}
                        />
                    </div>
                }
            />

            <PageContent>
                {mountsQuery.isPending ? (
                    <div className="flex items-center justify-center px-6 py-14">
                        <Spinner className="size-8" />
                    </div>
                ) : null}

                {mountsQuery.isError ? (
                    <Alert variant="destructive">
                        <AlertTitle>Unable to load mounts</AlertTitle>
                        <AlertDescription>
                            {mountsQuery.error instanceof Error
                                ? mountsQuery.error.message
                                : 'Unknown error occurred'}
                        </AlertDescription>
                        <AlertAction>
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                    mountsQuery.refetch()
                                }}
                            >
                                Retry
                            </Button>
                        </AlertAction>
                    </Alert>
                ) : null}

                {mountsQuery.isSuccess && mounts.length === 0 ? (
                    <Empty className="rounded-xl border">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <HardDriveIcon />
                            </EmptyMedia>
                            <EmptyTitle>No active mounts</EmptyTitle>
                            <EmptyDescription>
                                Create a new mount to get started.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/mounts/new')}
                            >
                                New Mount
                            </Button>
                        </EmptyContent>
                    </Empty>
                ) : null}

                {mounts.length > 0 ? (
                    <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                        {mounts.map((mount) => (
                            <Card key={mount.MountPoint}>
                                <CardHeader className="border-b">
                                    <CardTitle className="text-xl font-semibold">
                                        {getRemoteName(mount.Fs)}
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <dl className="space-y-4">
                                        <div className="space-y-1.5">
                                            <dt className="text-xs tracking-wide uppercase text-muted-foreground">
                                                Source
                                            </dt>
                                            <dd className="font-mono text-base font-medium break-all">
                                                {mount.Fs}
                                            </dd>
                                        </div>
                                        <div className="space-y-1.5">
                                            <dt className="text-xs tracking-wide uppercase text-muted-foreground">
                                                Mount Point
                                            </dt>
                                            <dd className="font-mono text-base font-medium break-all">
                                                {mount.MountPoint}
                                            </dd>
                                        </div>
                                        <div className="space-y-1.5">
                                            <dt className="text-xs tracking-wide uppercase text-muted-foreground">
                                                Mounted On
                                            </dt>
                                            <dd className="text-base font-medium tabular-nums">
                                                {formatTime(mount.MountedOn)}
                                            </dd>
                                        </div>
                                        <div className="space-y-1.5">
                                            <dt className="text-xs tracking-wide uppercase text-muted-foreground">
                                                Uptime
                                            </dt>
                                            <dd className="text-base font-medium tabular-nums">
                                                {formatUptime(mount.MountedOn)}
                                            </dd>
                                        </div>
                                    </dl>
                                </CardContent>

                                <CardFooter>
                                    <Button
                                        variant="destructive"
                                        className="w-full"
                                        disabled={unmountMutation.isPending}
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    `Are you sure you want to unmount ${getRemoteName(mount.Fs)}?`
                                                )
                                            ) {
                                                unmountMutation.mutate(mount.MountPoint)
                                            }
                                        }}
                                    >
                                        {unmountMutation.isPending ? 'Ejecting...' : 'Eject'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : null}
            </PageContent>
        </PageWrapper>
    )
}
