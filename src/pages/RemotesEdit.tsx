import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { OptionField } from '@/components/OptionField'
import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import rclone from '@/rclone/client'

export function RemotesEditPage() {
    const { remoteName } = useParams<{ remoteName: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [config, setConfig] = useState<Record<string, unknown>>({})
    const [showMoreOptions, setShowMoreOptions] = useState(false)
    const [initialized, setInitialized] = useState(false)

    const remoteConfigQuery = useQuery({
        queryKey: ['remotes', remoteName, 'config'] as const,
        queryFn: async ({ queryKey: [, qRemoteName], signal }) => {
            const response = await rclone('/config/get', {
                params: { query: { name: qRemoteName! } },
                signal,
            })
            return response
        },
        enabled: Boolean(remoteName),
    })

    const backendsQuery = useQuery({
        queryKey: ['backends'],
        queryFn: async () => {
            const response = await rclone('/config/providers')
            return response.providers
        },
    })

    const remoteType = remoteConfigQuery.data?.type

    const sortedEnrichedBackends = useMemo(() => {
        const backends = backendsQuery.data ?? []
        return backends
            .filter((backend) => !['uptobox', 'tardigrade'].includes(backend.Name))
            .sort((a, b) => a.Name.localeCompare(b.Name))
    }, [backendsQuery.data])

    const selectedBackend = useMemo(
        () =>
            remoteType
                ? (sortedEnrichedBackends.find((backend) => backend.Name === remoteType) ?? null)
                : null,
        [remoteType, sortedEnrichedBackends]
    )

    const selectedProvider = typeof config.provider === 'string' ? config.provider : undefined

    const currentBackendFields = useMemo(
        () =>
            selectedBackend
                ? selectedBackend.Options.filter((option) => {
                      if (!option.Provider) {
                          return true
                      }

                      if (
                          selectedProvider &&
                          option.Provider.includes(selectedProvider) &&
                          !option.Provider.startsWith('!')
                      ) {
                          return true
                      }

                      if (
                          remoteType === 's3' &&
                          selectedProvider === 'Other' &&
                          option.Provider.includes('!')
                      ) {
                          return true
                      }

                      return false
                  })
                : [],
        [selectedBackend, selectedProvider, remoteType]
    )

    const normalFields = useMemo(
        () => currentBackendFields.filter((option) => !option.Advanced),
        [currentBackendFields]
    )
    const advancedFields = useMemo(
        () => currentBackendFields.filter((option) => option.Advanced),
        [currentBackendFields]
    )

    // Pre-fill config from existing remote data once loaded
    useEffect(() => {
        if (remoteConfigQuery.data && selectedBackend && !initialized) {
            const existing = remoteConfigQuery.data
            const prefilled: Record<string, unknown> = {}

            for (const [key, value] of Object.entries(existing)) {
                if (key === 'type') continue

                // Convert bool strings to actual booleans for bool fields
                const fieldDef = selectedBackend.Options.find((o) => o.Name === key)
                if (fieldDef?.Type === 'bool') {
                    prefilled[key] = value === 'true'
                } else {
                    prefilled[key] = value
                }
            }

            setConfig(prefilled)
            setInitialized(true)
        }
    }, [remoteConfigQuery.data, selectedBackend, initialized])

    const updateRemoteMutation = useMutation({
        mutationFn: async (parameters: Record<string, unknown>) => {
            await rclone('/config/update', {
                params: {
                    query: {
                        name: remoteName!,
                        parameters: JSON.stringify(parameters),
                    },
                },
            })
        },
        onSuccess: () => {
            toast.success(`Remote "${remoteName}" updated successfully.`)
            queryClient.invalidateQueries({ queryKey: ['remotes'] })
            navigate('/remotes')
        },
        onError: (error) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
            toast.error(`Could not update remote: ${errorMessage}`)
        },
    })

    const handleSave = useCallback(() => {
        const parameters = { ...config }
        updateRemoteMutation.mutate(parameters)
    }, [config, updateRemoteMutation])

    const isPending = remoteConfigQuery.isPending || backendsQuery.isPending
    const isError = remoteConfigQuery.isError || backendsQuery.isError
    const errorMessage =
        remoteConfigQuery.error instanceof Error
            ? remoteConfigQuery.error.message
            : backendsQuery.error instanceof Error
              ? backendsQuery.error.message
              : 'Unknown error occurred'
    const isReady = !isPending && !isError && remoteConfigQuery.data && selectedBackend

    return (
        <PageWrapper>
            <PageHeader
                title={`Edit Remote: ${remoteName}`}
                description="Modify the configuration for this remote."
            />

            <PageContent>
                <div className="p-6 mt-6 border rounded-xl bg-card">
                    {isPending ? (
                        <div className="flex items-center justify-center h-40">
                            <Spinner className="size-8" />
                        </div>
                    ) : null}

                    {isError ? (
                        <Alert variant="destructive">
                            <AlertTitle>Unable to load remote configuration</AlertTitle>
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                    ) : null}

                    {isReady ? (
                        <div className="space-y-6">
                            <FieldGroup>
                                <Field>
                                    <FieldLabel htmlFor="remote-name">name</FieldLabel>
                                    <Input id="remote-name" value={remoteName} disabled={true} />
                                </Field>

                                <Field>
                                    <FieldLabel>type</FieldLabel>
                                    <Input
                                        value={selectedBackend.Description || remoteType!}
                                        disabled={true}
                                    />
                                </Field>

                                {normalFields.map((option) => (
                                    <OptionField
                                        key={option.Name}
                                        option={option}
                                        value={config[option.Name] ?? option.DefaultStr}
                                        onChange={(value) =>
                                            setConfig((previous) => ({
                                                ...previous,
                                                [option.Name]: value,
                                            }))
                                        }
                                        showExamples={
                                            option.Name !== 'endpoint' ||
                                            (typeof config.provider === 'string' &&
                                                config.provider !== 'Other')
                                        }
                                    />
                                ))}

                                {advancedFields.length > 0 ? (
                                    <div className="space-y-4">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setShowMoreOptions((value) => !value)}
                                        >
                                            {showMoreOptions ? (
                                                <ChevronUpIcon />
                                            ) : (
                                                <ChevronDownIcon />
                                            )}
                                            More Options
                                        </Button>
                                        {showMoreOptions ? (
                                            <FieldGroup>
                                                {advancedFields.map((option) => (
                                                    <OptionField
                                                        key={option.Name}
                                                        option={option}
                                                        value={
                                                            config[option.Name] ?? option.DefaultStr
                                                        }
                                                        onChange={(value) =>
                                                            setConfig((previous) => ({
                                                                ...previous,
                                                                [option.Name]: value,
                                                            }))
                                                        }
                                                        showExamples={
                                                            option.Name !== 'endpoint' ||
                                                            (typeof config.provider === 'string' &&
                                                                config.provider !== 'Other')
                                                        }
                                                    />
                                                ))}
                                            </FieldGroup>
                                        ) : null}
                                    </div>
                                ) : null}
                            </FieldGroup>

                            <div className="flex items-center justify-end gap-2 pt-4 border-t">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => navigate('/remotes')}
                                    disabled={updateRemoteMutation.isPending}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={updateRemoteMutation.isPending}
                                >
                                    {updateRemoteMutation.isPending ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </PageContent>
        </PageWrapper>
    )
}
