import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GlobeIcon, PlusIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { toRecord } from '@/components/OptionField'
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
import rclone from '@/rclone/client'
import { getRemoteName, getServeAuthLabel } from '@/rclone/utils'

export function ServesPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const servesQuery = useQuery({
        queryKey: ['serves'],
        queryFn: async () => {
            const response = await rclone('/serve/list')
            return response.list ?? []
        },
    })

    const stopMutation = useMutation({
        mutationFn: async (id: string) => {
            await rclone('/serve/stop', {
                params: { query: { id } },
            })
        },
        onSuccess: () => {
            toast.success('Serve stopped successfully.')
            queryClient.invalidateQueries({ queryKey: ['serves'] })
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Unknown error occurred'
            toast.error(`Could not stop serve: ${message}`)
        },
    })

    const serves = useMemo(() => {
        const list = servesQuery.data ?? []
        return list.map((serve) => {
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

    return (
        <PageWrapper>
            <PageHeader
                title="Serves"
                description="Manage active serve endpoints such as WebDAV, SFTP, and HTTP."
                actions={
                    <div className="flex items-center gap-2">
                        <Button size="lg" type="button" onClick={() => navigate('/serves/new')}>
                            <PlusIcon />
                            New Serve
                        </Button>
                        <RefreshButton
                            isFetching={servesQuery.isFetching}
                            refetch={servesQuery.refetch}
                        />
                    </div>
                }
            />

            <PageContent>
                {servesQuery.isPending ? (
                    <div className="overflow-hidden rounded-xl border">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="hover:bg-muted/40">
                                    <TableHead className="h-14 px-4 font-semibold text-muted-foreground uppercase">
                                        Id
                                    </TableHead>
                                    <TableHead className="h-14 px-6 font-semibold text-muted-foreground uppercase">
                                        Remote
                                    </TableHead>
                                    <TableHead className="h-14 px-4 font-semibold text-muted-foreground uppercase">
                                        Source
                                    </TableHead>
                                    <TableHead className="h-14 px-4 font-semibold text-muted-foreground uppercase">
                                        Protocol
                                    </TableHead>
                                    <TableHead className="h-14 px-4 font-semibold text-muted-foreground uppercase">
                                        Address
                                    </TableHead>
                                    <TableHead className="h-14 px-4 font-semibold text-muted-foreground uppercase">
                                        Auth
                                    </TableHead>
                                    <TableHead className="h-14 px-4 text-right font-semibold text-muted-foreground uppercase">
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

                {servesQuery.isError ? (
                    <Alert variant="destructive">
                        <AlertTitle>Unable to load serves</AlertTitle>
                        <AlertDescription>
                            {servesQuery.error instanceof Error
                                ? servesQuery.error.message
                                : 'Unknown error occurred'}
                        </AlertDescription>
                        <AlertAction>
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                    servesQuery.refetch()
                                }}
                            >
                                Retry
                            </Button>
                        </AlertAction>
                    </Alert>
                ) : null}

                {servesQuery.isSuccess && serves.length === 0 ? (
                    <Empty className="rounded-xl border">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <GlobeIcon />
                            </EmptyMedia>
                            <EmptyTitle>No active serves</EmptyTitle>
                            <EmptyDescription>
                                Start a new serve to expose a remote over HTTP, WebDAV, SFTP, or
                                other protocols.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/serves/new')}
                            >
                                New Serve
                            </Button>
                        </EmptyContent>
                    </Empty>
                ) : null}

                {serves.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="hover:bg-muted/40">
                                    <TableHead className="h-14 px-4 font-semibold text-muted-foreground uppercase">
                                        Id
                                    </TableHead>
                                    <TableHead className="h-14 px-6 font-semibold text-muted-foreground uppercase">
                                        Remote
                                    </TableHead>
                                    <TableHead className="h-14 px-4 font-semibold text-muted-foreground uppercase">
                                        Source
                                    </TableHead>
                                    <TableHead className="h-14 px-4 font-semibold text-muted-foreground uppercase">
                                        Protocol
                                    </TableHead>
                                    <TableHead className="h-14 px-4 font-semibold text-muted-foreground uppercase">
                                        Address
                                    </TableHead>
                                    <TableHead className="h-14 px-4 font-semibold text-muted-foreground uppercase">
                                        Auth
                                    </TableHead>
                                    <TableHead className="h-14 px-4 text-right font-semibold text-muted-foreground uppercase">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {serves.map((serve) => (
                                    <TableRow key={serve.id} className="hover:bg-muted/20">
                                        <TableCell className="px-4 py-4 font-mono text-sm">
                                            {serve.id}
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-base font-medium">
                                            {serve.remoteName}
                                        </TableCell>
                                        <TableCell className="px-4 py-4 font-mono text-sm">
                                            {serve.source || '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-4 uppercase">
                                            {serve.protocol}
                                        </TableCell>
                                        <TableCell className="px-4 py-4 font-mono">
                                            {serve.address}
                                        </TableCell>
                                        <TableCell className="px-4 py-4 uppercase">
                                            {serve.auth}
                                        </TableCell>
                                        <TableCell className="px-4 py-4 text-right">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="destructive"
                                                disabled={stopMutation.isPending}
                                                onClick={() => {
                                                    if (
                                                        window.confirm(
                                                            `Are you sure you want to stop serve "${serve.id}"?`
                                                        )
                                                    ) {
                                                        stopMutation.mutate(serve.id)
                                                    }
                                                }}
                                            >
                                                Stop
                                            </Button>
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
