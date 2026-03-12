import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { RefreshButton } from '@/components/RefreshButton'
import { TransfersTable } from '@/components/TransfersTable'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { useAuthStore } from '@/lib/store'
import { fetchJobsSnapshot, stopJob } from '@/rclone/jobs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleDotIcon } from 'lucide-react'
import { toast } from 'sonner'

export function TransfersPage() {
    const queryClient = useQueryClient()
    const connectionKey = useAuthStore((state) => `${state.url}\u0000${state.user}`)

    const jobsQuery = useQuery({
        queryKey: ['jobs', connectionKey],
        queryFn: fetchJobsSnapshot,
        refetchInterval: 3000,
    })

    const stopMutation = useMutation({
        mutationFn: stopJob,
        onSuccess: () => {
            toast.success('Job stopped.')
            queryClient.invalidateQueries({ queryKey: ['jobs', connectionKey] })
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Unknown error'
            toast.error(`Could not stop job: ${message}`)
        },
    })

    const jobs = jobsQuery.data ?? []

    return (
        <PageWrapper>
            <PageHeader
                title="Transfers"
                description="Manage active file transfers and view history."
                actions={
                    <RefreshButton isFetching={jobsQuery.isFetching} refetch={jobsQuery.refetch} />
                }
            />
            <PageContent>
                {jobsQuery.isPending ? (
                    <div className="flex items-center justify-center px-6 py-14">
                        <Spinner className="size-8" />
                    </div>
                ) : null}

                {jobsQuery.isError ? (
                    <Alert variant="destructive">
                        <AlertTitle>Unable to load transfers</AlertTitle>
                        <AlertDescription>
                            {jobsQuery.error instanceof Error
                                ? jobsQuery.error.message
                                : 'Unknown error occurred'}
                        </AlertDescription>
                        <AlertAction>
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                    jobsQuery.refetch()
                                }}
                            >
                                Retry
                            </Button>
                        </AlertAction>
                    </Alert>
                ) : null}

                {jobsQuery.isSuccess && jobs.length === 0 ? (
                    <Empty className="rounded-xl border">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <CircleDotIcon />
                            </EmptyMedia>
                            <EmptyTitle>No transfers</EmptyTitle>
                            <EmptyDescription>
                                There are no active or recent background transfers.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : null}

                {jobs.length > 0 ? (
                    <TransfersTable
                        jobs={jobs}
                        onStop={(jobid) => stopMutation.mutate(jobid)}
                        isStopping={stopMutation.isPending}
                    />
                ) : null}
            </PageContent>
        </PageWrapper>
    )
}
