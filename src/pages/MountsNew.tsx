import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { composeFs, toRecord } from '@/components/OptionField'
import { OptionGroupCard } from '@/components/OptionGroupCard'
import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from '@/components/ui/combobox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import rclone from '@/rclone/client'

export function MountsNewPage() {
    const navigate = useNavigate()

    const [remoteName, setRemoteName] = useState('')
    const [sourceSubpath, setSourceSubpath] = useState('')
    const [mountPoint, setMountPoint] = useState('')
    const [mountType, setMountType] = useState('')

    const [editedMount, setEditedMount] = useState<Record<string, unknown>>({})
    const [editedVfs, setEditedVfs] = useState<Record<string, unknown>>({})
    const [editedFilter, setEditedFilter] = useState<Record<string, unknown>>({})
    const [editedConfig, setEditedConfig] = useState<Record<string, unknown>>({})

    const [showAdvanced, setShowAdvanced] = useState({
        mount: false,
        vfs: false,
        filter: false,
        config: false,
    })

    const remotesQuery = useQuery({
        queryKey: ['mounts', 'new', 'remotes'],
        queryFn: async () => {
            const response = await rclone('/config/listremotes')
            return [...(response.remotes ?? [])].sort((a, b) => a.localeCompare(b))
        },
    })

    const optionsInfoQuery = useQuery({
        queryKey: ['mounts', 'new', 'options', 'info'],
        queryFn: async () => await rclone('/options/info'),
    })

    const optionsGetQuery = useQuery({
        queryKey: ['mounts', 'new', 'options', 'get'],
        queryFn: async () => await rclone('/options/get'),
    })

    const mountTypesQuery = useQuery({
        queryKey: ['mounts', 'new', 'types'],
        queryFn: async () => {
            const response = await rclone('/mount/types')
            return response.mountTypes ?? []
        },
    })

    const remotes = remotesQuery.data ?? []
    const mountTypes = mountTypesQuery.data ?? []

    useEffect(() => {
        if (!mountType && mountTypes.length > 0) {
            setMountType(mountTypes[0])
        }
    }, [mountType, mountTypes])

    const failedQueries = useMemo(() => {
        const entries: Array<{ name: string; message: string }> = []

        if (remotesQuery.isError) {
            entries.push({
                name: 'Remotes',
                message:
                    remotesQuery.error instanceof Error
                        ? remotesQuery.error.message
                        : 'Unknown error occurred',
            })
        }

        if (optionsInfoQuery.isError) {
            entries.push({
                name: 'Options metadata',
                message:
                    optionsInfoQuery.error instanceof Error
                        ? optionsInfoQuery.error.message
                        : 'Unknown error occurred',
            })
        }

        if (optionsGetQuery.isError) {
            entries.push({
                name: 'Current options',
                message:
                    optionsGetQuery.error instanceof Error
                        ? optionsGetQuery.error.message
                        : 'Unknown error occurred',
            })
        }

        if (mountTypesQuery.isError) {
            entries.push({
                name: 'Mount types',
                message:
                    mountTypesQuery.error instanceof Error
                        ? mountTypesQuery.error.message
                        : 'Unknown error occurred',
            })
        }

        return entries
    }, [
        mountTypesQuery.error,
        mountTypesQuery.isError,
        optionsGetQuery.error,
        optionsGetQuery.isError,
        optionsInfoQuery.error,
        optionsInfoQuery.isError,
        remotesQuery.error,
        remotesQuery.isError,
    ])

    const dependencyLoading =
        remotesQuery.isPending ||
        optionsInfoQuery.isPending ||
        optionsGetQuery.isPending ||
        mountTypesQuery.isPending
    const hasDependencyErrors = failedQueries.length > 0

    const mountOptions = optionsInfoQuery.data?.mount ?? []
    const vfsOptions = optionsInfoQuery.data?.vfs ?? []
    const filterOptions = optionsInfoQuery.data?.filter ?? []
    const configOptions = optionsInfoQuery.data?.main ?? []

    const mountInitialValues = toRecord(optionsGetQuery.data?.mount)
    const vfsInitialValues = toRecord(optionsGetQuery.data?.vfs)
    const filterInitialValues = toRecord(optionsGetQuery.data?.filter)
    const configInitialValues = toRecord(optionsGetQuery.data?.main)

    const optionGroups = [
        {
            key: 'mount',
            title: 'Mount',
            description: 'Mount-specific options.',
            options: mountOptions,
            initialValues: mountInitialValues,
            editedValues: editedMount,
            setEditedValues: setEditedMount,
            showAdvanced: showAdvanced.mount,
        },
        {
            key: 'vfs',
            title: 'VFS',
            description: 'Virtual file system behavior.',
            options: vfsOptions,
            initialValues: vfsInitialValues,
            editedValues: editedVfs,
            setEditedValues: setEditedVfs,
            showAdvanced: showAdvanced.vfs,
        },
        {
            key: 'filter',
            title: 'Filter',
            description: 'Inclusion and exclusion rules.',
            options: filterOptions,
            initialValues: filterInitialValues,
            editedValues: editedFilter,
            setEditedValues: setEditedFilter,
            showAdvanced: showAdvanced.filter,
        },
        {
            key: 'config',
            title: 'Config',
            description: 'Runtime rclone configuration overrides.',
            options: configOptions,
            initialValues: configInitialValues,
            editedValues: editedConfig,
            setEditedValues: setEditedConfig,
            showAdvanced: showAdvanced.config,
        },
    ] as const

    const retryFailedQueries = useCallback(() => {
        if (remotesQuery.isError) {
            void remotesQuery.refetch()
        }

        if (optionsInfoQuery.isError) {
            void optionsInfoQuery.refetch()
        }

        if (optionsGetQuery.isError) {
            void optionsGetQuery.refetch()
        }

        if (mountTypesQuery.isError) {
            void mountTypesQuery.refetch()
        }
    }, [mountTypesQuery, optionsGetQuery, optionsInfoQuery, remotesQuery])

    const mountMutation = useMutation({
        mutationFn: async () => {
            const normalizedRemoteName = remoteName.trim()
            const normalizedMountPoint = mountPoint.trim()
            const normalizedMountType = mountType.trim()

            if (!normalizedRemoteName || !normalizedMountPoint) {
                throw new Error('Remote and mount point are required')
            }

            if (mountTypes.length > 0 && !normalizedMountType) {
                throw new Error('Mount type is required')
            }

            const query: {
                fs: string
                mountPoint: string
                mountType?: string
                mountOpt?: string
                vfsOpt?: string
                _filter?: string
                _config?: string
            } = {
                fs: composeFs(normalizedRemoteName, sourceSubpath),
                mountPoint: normalizedMountPoint,
            }

            if (normalizedMountType) {
                query.mountType = normalizedMountType
            }

            if (Object.keys(editedMount).length > 0) {
                query.mountOpt = JSON.stringify(editedMount)
            }

            if (Object.keys(editedVfs).length > 0) {
                query.vfsOpt = JSON.stringify(editedVfs)
            }

            if (Object.keys(editedFilter).length > 0) {
                query._filter = JSON.stringify(editedFilter)
            }

            if (Object.keys(editedConfig).length > 0) {
                query._config = JSON.stringify(editedConfig)
            }

            await rclone('/mount/mount', {
                params: {
                    query,
                },
            })
        },
        onSuccess: () => {
            toast.success('Mount created successfully.')
            navigate('/mounts')
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Unknown error occurred'
            toast.error(`Could not create mount: ${message}`)
        },
    })

    const handleReset = useCallback(() => {
        setRemoteName('')
        setSourceSubpath('')
        setMountPoint('')
        setMountType(mountTypes[0] ?? '')

        setEditedMount({})
        setEditedVfs({})
        setEditedFilter({})
        setEditedConfig({})

        setShowAdvanced({
            mount: false,
            vfs: false,
            filter: false,
            config: false,
        })

        mountMutation.reset()
    }, [mountMutation, mountTypes])

    const isMountTypeRequired = mountTypes.length > 0
    const submitDisabled =
        dependencyLoading ||
        hasDependencyErrors ||
        remotes.length === 0 ||
        remoteName.trim().length === 0 ||
        mountPoint.trim().length === 0 ||
        (isMountTypeRequired && mountType.trim().length === 0) ||
        mountMutation.isPending

    const fsPreview = remoteName.trim() ? composeFs(remoteName.trim(), sourceSubpath) : ''

    return (
        <PageWrapper>
            <PageHeader
                title="New Mount"
                description="Create a new mount from one of your configured remotes."
                actions={
                    <Button type="button" variant="outline" onClick={handleReset}>
                        Reset
                    </Button>
                }
            />

            <PageContent>
                <div className="mt-6 space-y-4">
                    {dependencyLoading ? (
                        <div className="flex items-center justify-center rounded-xl border bg-card px-6 py-14">
                            <Spinner className="size-8" />
                        </div>
                    ) : null}

                    {hasDependencyErrors ? (
                        <Alert variant="destructive">
                            <AlertTitle>Unable to load mount dependencies</AlertTitle>
                            <AlertDescription>
                                <ul className="space-y-1">
                                    {failedQueries.map((entry) => (
                                        <li key={entry.name}>
                                            {entry.name}: {entry.message}
                                        </li>
                                    ))}
                                </ul>
                            </AlertDescription>
                            <AlertAction>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="xs"
                                    onClick={retryFailedQueries}
                                >
                                    Retry
                                </Button>
                            </AlertAction>
                        </Alert>
                    ) : null}

                    {!dependencyLoading && !hasDependencyErrors ? (
                        <div className="space-y-4">
                            <Card>
                                <CardHeader className="border-b">
                                    <CardTitle>Source and Destination</CardTitle>
                                    <CardDescription>
                                        Choose a remote source, optional subpath, and local mount
                                        point.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <FieldGroup>
                                        <Field>
                                            <FieldLabel>remote</FieldLabel>
                                            <Combobox
                                                items={remotes}
                                                value={remoteName || null}
                                                onValueChange={(value) =>
                                                    setRemoteName(value ?? '')
                                                }
                                                itemToStringValue={(item) => item}
                                                itemToStringLabel={(item) => item}
                                            >
                                                <ComboboxInput
                                                    placeholder="Select remote"
                                                    className="w-full"
                                                    showClear={true}
                                                />
                                                <ComboboxContent>
                                                    <ComboboxEmpty>No remotes found.</ComboboxEmpty>
                                                    <ComboboxList>
                                                        {(item: string) => (
                                                            <ComboboxItem key={item} value={item}>
                                                                <span className="font-mono text-xs">
                                                                    {item}
                                                                </span>
                                                            </ComboboxItem>
                                                        )}
                                                    </ComboboxList>
                                                </ComboboxContent>
                                            </Combobox>
                                            {remoteName.trim().length === 0 ? (
                                                <FieldDescription className="text-destructive">
                                                    Remote is required.
                                                </FieldDescription>
                                            ) : null}
                                        </Field>

                                        <Field>
                                            <FieldLabel htmlFor="source-subpath">
                                                source subpath
                                            </FieldLabel>
                                            <Input
                                                id="source-subpath"
                                                value={sourceSubpath}
                                                onChange={(event) =>
                                                    setSourceSubpath(event.target.value)
                                                }
                                                placeholder="Optional path inside the remote"
                                                autoComplete="off"
                                                autoCapitalize="off"
                                                autoCorrect="off"
                                                spellCheck={false}
                                            />
                                            <FieldDescription>
                                                {fsPreview
                                                    ? `Resolved fs: ${fsPreview}`
                                                    : 'Leave empty to mount the remote root.'}
                                            </FieldDescription>
                                        </Field>

                                        <Field>
                                            <FieldLabel htmlFor="mount-point">
                                                mount point
                                            </FieldLabel>
                                            <Input
                                                id="mount-point"
                                                value={mountPoint}
                                                onChange={(event) =>
                                                    setMountPoint(event.target.value)
                                                }
                                                placeholder="/path/to/mount"
                                                required={true}
                                                autoComplete="off"
                                                autoCapitalize="off"
                                                autoCorrect="off"
                                                spellCheck={false}
                                            />
                                            {mountPoint.trim().length === 0 ? (
                                                <FieldDescription className="text-destructive">
                                                    Mount point is required.
                                                </FieldDescription>
                                            ) : null}
                                        </Field>

                                        <Field>
                                            <FieldLabel>mount type</FieldLabel>
                                            <Combobox
                                                items={mountTypes}
                                                value={mountType || null}
                                                onValueChange={(value) => setMountType(value ?? '')}
                                                itemToStringValue={(item) => item}
                                                itemToStringLabel={(item) => item}
                                            >
                                                <ComboboxInput
                                                    placeholder={
                                                        mountTypes.length > 0
                                                            ? 'Select mount type'
                                                            : 'Optional mount type override'
                                                    }
                                                    className="w-full"
                                                    showClear={true}
                                                />
                                                <ComboboxContent>
                                                    <ComboboxEmpty>
                                                        No mount types available.
                                                    </ComboboxEmpty>
                                                    <ComboboxList>
                                                        {(item: string) => (
                                                            <ComboboxItem key={item} value={item}>
                                                                {item}
                                                            </ComboboxItem>
                                                        )}
                                                    </ComboboxList>
                                                </ComboboxContent>
                                            </Combobox>
                                            {isMountTypeRequired &&
                                            mountType.trim().length === 0 ? (
                                                <FieldDescription className="text-destructive">
                                                    Mount type is required.
                                                </FieldDescription>
                                            ) : null}
                                        </Field>
                                    </FieldGroup>
                                </CardContent>
                            </Card>

                            {remotes.length === 0 ? (
                                <Alert>
                                    <AlertTitle>No remotes found</AlertTitle>
                                    <AlertDescription>
                                        Create a remote first, then return to this page to start a
                                        mount.
                                    </AlertDescription>
                                    <AlertAction>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            onClick={() => navigate('/remotes/new')}
                                        >
                                            Create Remote
                                        </Button>
                                    </AlertAction>
                                </Alert>
                            ) : (
                                optionGroups.map((group) => {
                                    return (
                                        <OptionGroupCard
                                            key={group.key}
                                            title={group.title}
                                            description={group.description}
                                            options={group.options}
                                            initialValues={group.initialValues}
                                            editedValues={group.editedValues}
                                            setEditedValues={group.setEditedValues}
                                            showAdvanced={group.showAdvanced}
                                            onShowAdvancedChange={(value) =>
                                                setShowAdvanced((previous) => ({
                                                    ...previous,
                                                    [group.key]: value,
                                                }))
                                            }
                                        />
                                    )
                                })
                            )}

                            <div className="flex items-center justify-end gap-2 border-t pt-4">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={mountMutation.isPending}
                                    onClick={() => navigate('/mounts')}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => mountMutation.mutate()}
                                    disabled={submitDisabled}
                                >
                                    {mountMutation.isPending ? 'Creating...' : 'Create Mount'}
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </PageContent>
        </PageWrapper>
    )
}
