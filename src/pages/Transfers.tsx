import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleDotIcon, PlusIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { RefreshButton } from '@/components/RefreshButton'
import { TransfersTable } from '@/components/TransfersTable'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { useT } from '@/lib/i18n'
import { fetchJobsSnapshot, stopJob } from '@/rclone/jobs'
import { fetchRemotesList } from '@/rclone/usage'

export function TransfersPage() {
    const t = useT()
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const jobsQuery = useQuery({
        queryKey: ['jobs'],
        queryFn: fetchJobsSnapshot,
        refetchInterval: 1500,
    })

    const remotesListQuery = useQuery({
        queryKey: ['remotes', 'list'],
        queryFn: fetchRemotesList,
    })

    const firstRemote = remotesListQuery.data?.[0]

    const stopMutation = useMutation({
        mutationFn: stopJob,
        onSuccess: () => {
            toast.success(t('transfers.stopSuccess'))
            queryClient.invalidateQueries({ queryKey: ['jobs'] })
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : t('common.unknownError')
            toast.error(t('transfers.stopError', { message }))
        },
    })

    const jobs = jobsQuery.data ?? []

    return (
        <PageWrapper>
            <PageHeader
                title={t('transfers.title')}
                description={t('transfers.description')}
                actions={
                    <div className="flex items-center gap-2">
                        {firstRemote ? (
                            <Button
                                size="lg"
                                type="button"
                                onClick={() => navigate(`/remotes/${firstRemote.name}`)}
                            >
                                <PlusIcon />
                                {t('transfers.newTransfer')}
                            </Button>
                        ) : null}
                        <RefreshButton
                            isFetching={jobsQuery.isFetching}
                            refetch={jobsQuery.refetch}
                        />
                    </div>
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
                        <AlertTitle>{t('transfers.loadError')}</AlertTitle>
                        <AlertDescription>
                            {jobsQuery.error instanceof Error
                                ? jobsQuery.error.message
                                : t('common.unknownError')}
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
                                {t('common.retry')}
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
                            <EmptyTitle>{t('transfers.emptyTitle')}</EmptyTitle>
                            <EmptyDescription>{t('transfers.emptyDescription')}</EmptyDescription>
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
