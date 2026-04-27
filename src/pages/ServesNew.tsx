import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { composeFs, normalizeText, toRecord } from '@/components/OptionField'
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
import { useT } from '@/lib/i18n'
import rclone from '@/rclone/client'

const SERVE_BLOCK_CANDIDATES = ['dlna', 'ftp', 'http', 'nfs', 'restic', 's3', 'sftp', 'webdav']

export function ServesNewPage() {
    const t = useT()
    const navigate = useNavigate()

    const [remoteName, setRemoteName] = useState('')
    const [sourceSubpath, setSourceSubpath] = useState('')
    const [serveType, setServeType] = useState('')

    const [editedServe, setEditedServe] = useState<Record<string, unknown>>({})
    const [editedVfs, setEditedVfs] = useState<Record<string, unknown>>({})
    const [editedFilter, setEditedFilter] = useState<Record<string, unknown>>({})
    const [editedConfig, setEditedConfig] = useState<Record<string, unknown>>({})

    const [showAdvanced, setShowAdvanced] = useState({
        serve: false,
        vfs: false,
        filter: false,
        config: false,
    })
    const [collapsed, setCollapsed] = useState({
        serve: true,
        vfs: true,
        filter: true,
        config: true,
    })

    const remotesQuery = useQuery({
        queryKey: ['serves', 'new', 'remotes'],
        queryFn: async () => {
            const response = await rclone('/config/listremotes')
            return [...(response.remotes ?? [])].sort((a, b) => a.localeCompare(b))
        },
    })

    const optionsInfoQuery = useQuery({
        queryKey: ['options', 'info'],
        queryFn: async () => await rclone('/options/info'),
        staleTime: Infinity,
    })

    const optionsGetQuery = useQuery({
        queryKey: ['options', 'get'],
        queryFn: async () => await rclone('/options/get'),
        staleTime: Infinity,
    })

    const serveTypesQuery = useQuery({
        queryKey: ['serves', 'types'],
        queryFn: async () => {
            const response = await rclone('/serve/types')
            return response.types
        },
        staleTime: Infinity,
    })

    const remotes = remotesQuery.data ?? []

    const serveTypesFromInfo = useMemo(() => {
        const optionsInfo = optionsInfoQuery.data
        if (!optionsInfo) {
            return []
        }

        return SERVE_BLOCK_CANDIDATES.filter((type) => {
            const block = optionsInfo[type]
            return Array.isArray(block) && block.length > 0
        })
    }, [optionsInfoQuery.data])

    const serveTypes = useMemo(() => {
        const merged = [...(serveTypesQuery.data ?? []), ...serveTypesFromInfo]
        return [...new Set(merged)].sort((a, b) => a.localeCompare(b))
    }, [serveTypesFromInfo, serveTypesQuery.data])

    useEffect(() => {
        if (!serveType && serveTypes.length > 0) {
            setServeType(serveTypes[0])
        }
    }, [serveType, serveTypes])

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

        if (serveTypesQuery.isError) {
            entries.push({
                name: 'Serve types',
                message:
                    serveTypesQuery.error instanceof Error
                        ? serveTypesQuery.error.message
                        : 'Unknown error occurred',
            })
        }

        return entries
    }, [
        optionsGetQuery.error,
        optionsGetQuery.isError,
        optionsInfoQuery.error,
        optionsInfoQuery.isError,
        remotesQuery.error,
        remotesQuery.isError,
        serveTypesQuery.error,
        serveTypesQuery.isError,
    ])

    const dependencyLoading =
        remotesQuery.isPending ||
        optionsInfoQuery.isPending ||
        optionsGetQuery.isPending ||
        serveTypesQuery.isPending
    const hasDependencyErrors = failedQueries.length > 0

    const serveOptions = serveType ? (optionsInfoQuery.data?.[serveType] ?? []) : []
    const vfsOptions = optionsInfoQuery.data?.vfs ?? []
    const filterOptions = optionsInfoQuery.data?.filter ?? []
    const configOptions = optionsInfoQuery.data?.main ?? []

    const serveInitialValues = serveType ? toRecord(optionsGetQuery.data?.[serveType]) : {}
    const vfsInitialValues = toRecord(optionsGetQuery.data?.vfs)
    const filterInitialValues = toRecord(optionsGetQuery.data?.filter)
    const configInitialValues = toRecord(optionsGetQuery.data?.main)

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

        if (serveTypesQuery.isError) {
            void serveTypesQuery.refetch()
        }
    }, [optionsGetQuery, optionsInfoQuery, remotesQuery, serveTypesQuery])

    const resolvedServeValues = useMemo(
        () => ({ ...serveInitialValues, ...editedServe }),
        [editedServe, serveInitialValues]
    )

    const serveMutation = useMutation({
        mutationFn: async () => {
            const normalizedRemoteName = remoteName.trim()
            const normalizedServeType = serveType.trim()
            const serveAddr = normalizeText(resolvedServeValues.addr).trim()

            if (!normalizedRemoteName || !normalizedServeType || !serveAddr) {
                throw new Error(t('servesNew.requiredFields'))
            }

            const query: {
                type: string
                fs: string
                addr: string
                _filter?: string
                _config?: string
            } & Record<string, unknown> = {
                type: normalizedServeType,
                fs: composeFs(normalizedRemoteName, sourceSubpath),
                addr: serveAddr,
            }

            const serveExtraOptions = Object.fromEntries(
                Object.entries(editedServe).filter(([key]) => key !== 'addr')
            )

            for (const [key, value] of Object.entries(serveExtraOptions)) {
                query[key] = value
            }

            for (const [key, value] of Object.entries(editedVfs)) {
                query[key] = value
            }

            if (Object.keys(editedFilter).length > 0) {
                query._filter = JSON.stringify(editedFilter)
            }

            if (Object.keys(editedConfig).length > 0) {
                query._config = JSON.stringify(editedConfig)
            }

            return await rclone('/serve/start', {
                params: {
                    query,
                },
            })
        },
        onSuccess: (result) => {
            const id = toRecord(result).id
            if (typeof id === 'string' && id.length > 0) {
                toast.success(t('servesNew.startSuccessWithId', { id }))
            } else {
                toast.success(t('servesNew.startSuccess'))
            }
            navigate('/serves')
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : t('common.unknownError')
            toast.error(t('servesNew.createError', { message }))
        },
    })

    const handleServeTypeChange = useCallback((nextType: string | null) => {
        setServeType(nextType ?? '')
        setEditedServe({})
        setShowAdvanced((previous) => ({
            ...previous,
            serve: false,
        }))
    }, [])

    const handleReset = useCallback(() => {
        setRemoteName('')
        setSourceSubpath('')
        setServeType(serveTypes[0] ?? '')

        setEditedServe({})
        setEditedVfs({})
        setEditedFilter({})
        setEditedConfig({})

        setShowAdvanced({
            serve: false,
            vfs: false,
            filter: false,
            config: false,
        })

        serveMutation.reset()
    }, [serveMutation, serveTypes])

    const submitDisabled =
        dependencyLoading ||
        hasDependencyErrors ||
        remotes.length === 0 ||
        remoteName.trim().length === 0 ||
        serveType.trim().length === 0 ||
        serveMutation.isPending

    const fsPreview = remoteName.trim() ? composeFs(remoteName.trim(), sourceSubpath) : ''

    const groupEntries = [
        {
            key: 'serve',
            title: serveType
                ? t('servesNew.groupServeWithType', { type: serveType })
                : t('servesNew.groupServe'),
            description: t('servesNew.groupServeDescription'),
            options: serveOptions,
            initialValues: serveInitialValues,
            editedValues: editedServe,
            setEditedValues: setEditedServe,
            showAdvanced: showAdvanced.serve,
        },
        {
            key: 'vfs',
            title: t('servesNew.groupVfs'),
            description: t('servesNew.groupVfsDescription'),
            options: vfsOptions,
            initialValues: vfsInitialValues,
            editedValues: editedVfs,
            setEditedValues: setEditedVfs,
            showAdvanced: showAdvanced.vfs,
        },
        {
            key: 'filter',
            title: t('servesNew.groupFilter'),
            description: t('servesNew.groupFilterDescription'),
            options: filterOptions,
            initialValues: filterInitialValues,
            editedValues: editedFilter,
            setEditedValues: setEditedFilter,
            showAdvanced: showAdvanced.filter,
        },
        {
            key: 'config',
            title: t('servesNew.groupConfig'),
            description: t('servesNew.groupConfigDescription'),
            options: configOptions,
            initialValues: configInitialValues,
            editedValues: editedConfig,
            setEditedValues: setEditedConfig,
            showAdvanced: showAdvanced.config,
        },
    ] as const

    return (
        <PageWrapper>
            <PageHeader
                title={t('servesNew.title')}
                description={t('servesNew.description')}
                actions={
                    <Button type="button" variant="outline" onClick={handleReset}>
                        {t('common.reset')}
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
                            <AlertTitle>{t('servesNew.loadError')}</AlertTitle>
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
                                    {t('common.retry')}
                                </Button>
                            </AlertAction>
                        </Alert>
                    ) : null}

                    {!dependencyLoading && !hasDependencyErrors ? (
                        <div className="space-y-4">
                            <Card>
                                <CardHeader className="border-b">
                                    <CardTitle>{t('servesNew.sourceAndProtocol')}</CardTitle>
                                    <CardDescription>
                                        {t('servesNew.sourceAndProtocolDescription')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <FieldGroup>
                                        <Field>
                                            <FieldLabel>{t('common.remote')}</FieldLabel>
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
                                                    placeholder={t('common.selectRemote')}
                                                    className="w-full"
                                                    showClear={true}
                                                />
                                                <ComboboxContent>
                                                    <ComboboxEmpty>
                                                        {t('common.noRemotesCombobox')}
                                                    </ComboboxEmpty>
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
                                                    {t('common.remoteRequired')}
                                                </FieldDescription>
                                            ) : null}
                                        </Field>

                                        <Field>
                                            <FieldLabel htmlFor="serve-source-subpath">
                                                {t('common.sourceSubpath')}
                                            </FieldLabel>
                                            <Input
                                                id="serve-source-subpath"
                                                value={sourceSubpath}
                                                onChange={(event) =>
                                                    setSourceSubpath(event.target.value)
                                                }
                                                placeholder={t('common.subpathPlaceholder')}
                                                autoComplete="off"
                                                autoCapitalize="off"
                                                autoCorrect="off"
                                                spellCheck={false}
                                            />
                                            <FieldDescription>
                                                {fsPreview
                                                    ? t('common.resolvedFs', { fs: fsPreview })
                                                    : t('servesNew.leaveEmpty')}
                                            </FieldDescription>
                                        </Field>

                                        <Field>
                                            <FieldLabel>{t('servesNew.serveType')}</FieldLabel>
                                            <Combobox
                                                items={serveTypes}
                                                value={serveType || null}
                                                onValueChange={handleServeTypeChange}
                                                itemToStringValue={(item) => item}
                                                itemToStringLabel={(item) => item}
                                            >
                                                <ComboboxInput
                                                    placeholder={t('servesNew.selectServeType')}
                                                    className="w-full"
                                                    showClear={true}
                                                />
                                                <ComboboxContent>
                                                    <ComboboxEmpty>
                                                        {t('servesNew.noServeTypes')}
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
                                            {serveType.trim().length === 0 ? (
                                                <FieldDescription className="text-destructive">
                                                    {t('servesNew.serveTypeRequired')}
                                                </FieldDescription>
                                            ) : null}
                                        </Field>
                                    </FieldGroup>
                                </CardContent>
                            </Card>

                            {remotes.length === 0 ? (
                                <Alert>
                                    <AlertTitle>{t('common.noRemotesTitle')}</AlertTitle>
                                    <AlertDescription>
                                        {t('servesNew.noRemotesDescription')}
                                    </AlertDescription>
                                    <AlertAction>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            onClick={() => navigate('/remotes/new')}
                                        >
                                            {t('common.createRemote')}
                                        </Button>
                                    </AlertAction>
                                </Alert>
                            ) : null}

                            {serveTypes.length === 0 ? (
                                <Alert variant="destructive">
                                    <AlertTitle>{t('servesNew.noServeTypesTitle')}</AlertTitle>
                                    <AlertDescription>
                                        {t('servesNew.noServeTypesDescription')}
                                    </AlertDescription>
                                </Alert>
                            ) : null}

                            {serveTypes.length > 0
                                ? groupEntries.map((group) => {
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
                                              collapsed={collapsed[group.key]}
                                              onCollapsedChange={(value) =>
                                                  setCollapsed((previous) => ({
                                                      ...previous,
                                                      [group.key]: value,
                                                  }))
                                              }
                                          />
                                      )
                                  })
                                : null}

                            <div className="flex items-center justify-end gap-2 border-t pt-4">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={serveMutation.isPending}
                                    onClick={() => navigate('/serves')}
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => serveMutation.mutate()}
                                    disabled={submitDisabled}
                                >
                                    {serveMutation.isPending
                                        ? t('servesNew.starting')
                                        : t('servesNew.startServe')}
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </PageContent>
        </PageWrapper>
    )
}
