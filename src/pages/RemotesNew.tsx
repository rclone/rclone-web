import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import type { components } from 'rclone-openapi'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { OptionField } from '@/components/OptionField'
import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from '@/components/ui/combobox'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import rclone from '@/rclone/client'

export function RemotesNewPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [config, setConfig] = useState<Record<string, unknown>>({})
    const [showMoreOptions, setShowMoreOptions] = useState(false)

    const backendsQuery = useQuery({
        queryKey: ['backends'],
        queryFn: async () => {
            const response = await rclone('/config/providers')
            return response.providers
        },
    })

    const sortedEnrichedBackends = useMemo(() => {
        const backends = backendsQuery.data ?? []

        return backends
            .filter((backend) => !['uptobox', 'tardigrade'].includes(backend.Name))
            .sort((a, b) => a.Name.localeCompare(b.Name))
    }, [backendsQuery.data])

    const remoteName = typeof config.name === 'string' ? config.name : ''
    const selectedType = typeof config.type === 'string' ? config.type : undefined
    const selectedProvider = typeof config.provider === 'string' ? config.provider : undefined

    const selectedBackend = useMemo(
        () =>
            selectedType
                ? (sortedEnrichedBackends.find((backend) => backend.Name === selectedType) ?? null)
                : null,
        [selectedType, sortedEnrichedBackends]
    )

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
                          selectedType === 's3' &&
                          selectedProvider === 'Other' &&
                          option.Provider.includes('!')
                      ) {
                          return true
                      }

                      return false
                  })
                : [],
        [selectedBackend, selectedProvider, selectedType]
    )

    const normalFields = useMemo(
        () => currentBackendFields.filter((option) => !option.Advanced),
        [currentBackendFields]
    )
    const advancedFields = useMemo(
        () => currentBackendFields.filter((option) => option.Advanced),
        [currentBackendFields]
    )

    const createRemoteMutation = useMutation({
        mutationFn: async ({
            name,
            type,
            parameters,
        }: {
            name: string
            type: string
            parameters: Record<string, unknown>
        }) => {
            await rclone('/config/create', {
                params: {
                    query: {
                        name,
                        type,
                        parameters: JSON.stringify(parameters),
                    },
                },
            })

            return name
        },
        onSuccess: async (name) => {
            toast.success(`Remote "${name}" created successfully.`)
            await queryClient.invalidateQueries({ queryKey: ['remotes'] })
            setConfig({})
            setShowMoreOptions(false)
            navigate('/remotes')
        },
        onError: (error) => {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

            if (errorMessage.includes('address already in use')) {
                toast.error(
                    'Rclone Oauth Client is stuck, please restart the UI to add new remotes.'
                )
            }

            toast.error(`Could not create remote: ${errorMessage}`)
        },
    })

    const handleTypeChange = useCallback(
        (backend: components['schemas']['ConfigProvider'] | null) => {
            const nextType = backend?.Name
            setConfig((previous) => ({
                name: previous.name,
                type: nextType,
            }))
            setShowMoreOptions(false)
        },
        []
    )

    const handleReset = useCallback(() => {
        setConfig({})
        setShowMoreOptions(false)
        createRemoteMutation.reset()
    }, [createRemoteMutation])

    const handleCreate = useCallback(() => {
        if (!remoteName.trim() || !selectedType) {
            return
        }

        const parameters = Object.fromEntries(
            Object.entries(config).filter(([key]) => key !== 'name' && key !== 'type')
        )

        createRemoteMutation.mutate({
            name: remoteName,
            type: selectedType,
            parameters,
        })
    }, [config, createRemoteMutation, remoteName, selectedType])

    const canCreate =
        remoteName.trim().length > 0 && Boolean(selectedType) && !createRemoteMutation.isPending

    return (
        <PageWrapper>
            <PageHeader
                title="New Remote"
                description="Set up a new remote endpoint and choose its connection settings."
                actions={
                    <Button type="button" variant="outline" onClick={handleReset}>
                        Reset
                    </Button>
                }
            />

            <PageContent>
                <div className="p-6 mt-6 border rounded-xl bg-card">
                    {backendsQuery.isPending ? (
                        <div className="flex items-center justify-center h-40">
                            <Spinner className="size-8" />
                        </div>
                    ) : null}

                    {backendsQuery.isError ? (
                        <Alert variant="destructive">
                            <AlertTitle>Unable to load remote providers</AlertTitle>
                            <AlertDescription>
                                {backendsQuery.error instanceof Error
                                    ? backendsQuery.error.message
                                    : 'Unknown error occurred'}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {!backendsQuery.isPending && !backendsQuery.isError ? (
                        <div className="space-y-6">
                            <FieldGroup>
                                <Field>
                                    <FieldLabel htmlFor="remote-name">name</FieldLabel>
                                    <Input
                                        id="remote-name"
                                        name="name"
                                        placeholder="Remote name (for your reference)"
                                        value={remoteName}
                                        onChange={(event) =>
                                            setConfig((previous) => ({
                                                ...previous,
                                                name: event.target.value,
                                            }))
                                        }
                                        required={true}
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        autoCorrect="off"
                                        spellCheck={false}
                                    />
                                </Field>

                                <Field>
                                    <FieldLabel>type</FieldLabel>
                                    <Combobox
                                        items={sortedEnrichedBackends}
                                        value={selectedBackend}
                                        onValueChange={handleTypeChange}
                                        itemToStringValue={(backend) => backend.Name}
                                        itemToStringLabel={(backend) =>
                                            backend.Description || backend.Name
                                        }
                                    >
                                        <ComboboxInput
                                            placeholder="Select type or search"
                                            className="w-full"
                                            showClear={true}
                                        />
                                        <ComboboxContent>
                                            <ComboboxEmpty>No backends found.</ComboboxEmpty>
                                            <ComboboxList>
                                                {(
                                                    backend: components['schemas']['ConfigProvider']
                                                ) => (
                                                    <ComboboxItem
                                                        key={backend.Name}
                                                        value={backend}
                                                    >
                                                        <div className="flex items-center justify-between w-full gap-4">
                                                            <span>
                                                                {backend.Description ||
                                                                    backend.Name}
                                                            </span>
                                                            <span className="font-mono text-xs text-muted-foreground">
                                                                {backend.Name}
                                                            </span>
                                                        </div>
                                                    </ComboboxItem>
                                                )}
                                            </ComboboxList>
                                        </ComboboxContent>
                                    </Combobox>
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
                                    disabled={createRemoteMutation.isPending}
                                >
                                    Cancel
                                </Button>
                                <Button type="button" onClick={handleCreate} disabled={!canCreate}>
                                    {createRemoteMutation.isPending
                                        ? 'Creating...'
                                        : 'Create Remote'}
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </PageContent>
        </PageWrapper>
    )
}
