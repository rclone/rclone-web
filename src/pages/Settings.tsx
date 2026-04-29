import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    BookOpenIcon,
    ClipboardCopyIcon,
    EyeIcon,
    FileCogIcon,
    GaugeIcon,
    InfoIcon,
    MessageCircleCodeIcon,
    LayersIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { t as tFn, useT } from '@/lib/i18n'
import rclone, { rcloneUploadFile } from '@/rclone/client'

function normalizeConfigPath(path: string) {
    return path.trim().replace(/\\/g, '/')
}

function getConfigUploadTarget(configPath: string) {
    const normalizedPath = normalizeConfigPath(configPath).replace(/\/+$/, '')

    if (!normalizedPath) {
        throw new Error(tFn('settings.configPathRequired'))
    }

    const lastSlash = normalizedPath.lastIndexOf('/')
    if (lastSlash === -1) {
        return { fs: '.', remote: '', filename: normalizedPath }
    }

    const directory = normalizedPath.slice(0, lastSlash) || '/'
    const filename = normalizedPath.slice(lastSlash + 1)

    if (!filename) {
        throw new Error(tFn('settings.configPathRequiresFile'))
    }

    return {
        fs: /^[a-zA-Z]:$/.test(directory) ? `${directory}/` : directory,
        remote: '',
        filename,
    }
}

const logLevelItems = [
    { label: 'DEBUG', value: 'DEBUG' },
    { label: 'INFO', value: 'INFO' },
    { label: 'NOTICE', value: 'NOTICE' },
    { label: 'WARNING', value: 'WARNING' },
    { label: 'ERROR', value: 'ERROR' },
]

export function SettingsPage() {
    const t = useT()
    const queryClient = useQueryClient()

    // Fetch current rclone options
    const optionsQuery = useQuery({
        queryKey: ['options'],
        queryFn: () => rclone('/options/get'),
    })

    // Performance edits (only tracks user-changed fields)
    const [performanceEdits, setPerformanceEdits] = useState<Record<string, string>>({})

    // Extract fetched performance values from rclone
    const fetchedPerformance = useMemo(() => {
        const main = optionsQuery.data?.main
        return {
            transfers: String(main?.Transfers ?? ''),
            checkers: String(main?.Checkers ?? ''),
            bwLimit: String(main?.BwLimit ?? ''),
            tpsLimit: String(main?.TPSLimit ?? ''),
        }
    }, [optionsQuery.data])

    // Effective performance values (edits override fetched)
    const transfers = performanceEdits.transfers ?? fetchedPerformance.transfers
    const checkers = performanceEdits.checkers ?? fetchedPerformance.checkers
    const bwLimit = performanceEdits.bwLimit ?? fetchedPerformance.bwLimit
    const tpsLimit = performanceEdits.tpsLimit ?? fetchedPerformance.tpsLimit

    function updatePerformance(field: string, value: string) {
        setPerformanceEdits((prev) => {
            const fetchedValue = fetchedPerformance[field as keyof typeof fetchedPerformance]
            if (value === fetchedValue) {
                const { [field]: _, ...rest } = prev
                return rest
            }
            return { ...prev, [field]: value }
        })
    }

    // Logging edits (only tracks user-changed fields)
    const [loggingEdits, setLoggingEdits] = useState<Record<string, string>>({})

    const fetchedLogging = useMemo(() => {
        const main = optionsQuery.data?.main
        const log = optionsQuery.data?.log
        return {
            logLevel: String(main?.LogLevel ?? 'NOTICE'),
            logFilePath: String(log?.File ?? ''),
        }
    }, [optionsQuery.data])

    const logLevel = loggingEdits.logLevel ?? fetchedLogging.logLevel
    const logFilePath = loggingEdits.logFilePath ?? fetchedLogging.logFilePath

    function updateLogging(field: string, value: string) {
        setLoggingEdits((prev) => {
            const fetchedValue = fetchedLogging[field as keyof typeof fetchedLogging]
            if (value === fetchedValue) {
                const { [field]: _, ...rest } = prev
                return rest
            }
            return { ...prev, [field]: value }
        })
    }

    // Version info display
    const coreVersionQuery = useQuery({
        queryKey: ['core', 'version'],
        queryFn: () => rclone('/core/version'),
        staleTime: Infinity,
    })

    const versionOutput = useMemo(() => {
        if (coreVersionQuery.isPending) return t('settings.versionLoading')
        if (coreVersionQuery.isError) {
            return coreVersionQuery.error instanceof Error
                ? coreVersionQuery.error.message
                : t('settings.versionError')
        }
        return JSON.stringify(
            { ...(coreVersionQuery.data ?? {}), webVersion: `v${APP_VERSION}` },
            null,
            2
        )
    }, [
        coreVersionQuery.data,
        coreVersionQuery.error,
        coreVersionQuery.isError,
        coreVersionQuery.isPending,
    ])

    // Config file
    const configPathsQuery = useQuery({
        queryKey: ['config', 'paths'],
        queryFn: () => rclone('/config/paths'),
    })

    const fetchedConfigPath = configPathsQuery.data?.config ?? ''

    const configContentsQuery = useQuery({
        queryKey: ['config', 'contents', fetchedConfigPath] as const,
        enabled: Boolean(fetchedConfigPath),
        queryFn: async ({ queryKey: [, , qConfigPath], signal }) => {
            const response = await rclone('/core/command', {
                body: { command: 'cat', arg: [normalizeConfigPath(qConfigPath)] },
                signal,
            })

            return response.result ?? ''
        },
    })

    const [configEdits, setConfigEdits] = useState<Record<string, string>>({})
    const [isConfigRevealed, setIsConfigRevealed] = useState(false)

    const fetchedConfig = useMemo(() => {
        return {
            configPath: fetchedConfigPath,
            configContents: configContentsQuery.data ?? '',
        }
    }, [configContentsQuery.data, fetchedConfigPath])

    const configPath = configEdits.configPath ?? fetchedConfig.configPath
    const configContents = configEdits.configContents ?? fetchedConfig.configContents

    function updateConfig(field: string, value: string) {
        setConfigEdits((prev) => {
            const fetchedValue = fetchedConfig[field as keyof typeof fetchedConfig]
            if (value === fetchedValue) {
                const { [field]: _, ...rest } = prev
                return rest
            }
            return { ...prev, [field]: value }
        })
    }

    const isDirty =
        Object.keys(performanceEdits).length > 0 ||
        Object.keys(loggingEdits).length > 0 ||
        Object.keys(configEdits).length > 0

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            // Options (performance + logging)
            const main: Record<string, unknown> = {}
            const log: Record<string, unknown> = {}

            if ('transfers' in performanceEdits) {
                main.Transfers = Number(performanceEdits.transfers) || 0
            }
            if ('checkers' in performanceEdits) {
                main.Checkers = Number(performanceEdits.checkers) || 0
            }
            if ('bwLimit' in performanceEdits) {
                main.BwLimit = performanceEdits.bwLimit
            }
            if ('tpsLimit' in performanceEdits) {
                main.TPSLimit = Number(performanceEdits.tpsLimit) || 0
            }
            if ('logLevel' in loggingEdits) {
                main.LogLevel = loggingEdits.logLevel
            }
            if ('logFilePath' in loggingEdits) {
                log.File = loggingEdits.logFilePath
            }

            const body: Record<string, unknown> = {}
            if (Object.keys(main).length > 0) body.main = main
            if (Object.keys(log).length > 0) body.log = log
            if (Object.keys(body).length > 0) {
                await rclone('/options/set', { body })
            }

            // Config path
            if ('configPath' in configEdits) {
                const nextConfigPath = configEdits.configPath

                if (!nextConfigPath.trim()) {
                    throw new Error(t('settings.configPathRequired'))
                }

                if ('configContents' in configEdits) {
                    const { fs, remote, filename } = getConfigUploadTarget(nextConfigPath)

                    await rcloneUploadFile({
                        fs,
                        remote,
                        filename,
                        contents: configEdits.configContents,
                    })
                }

                await rclone('/config/setpath', {
                    params: {
                        query: { path: nextConfigPath },
                    },
                })
            }

            if ('configContents' in configEdits && !('configPath' in configEdits)) {
                const { fs, remote, filename } = getConfigUploadTarget(fetchedConfig.configPath)

                await rcloneUploadFile({
                    fs,
                    remote,
                    filename,
                    contents: configEdits.configContents,
                })
            }
        },
        onSuccess: () => {
            toast.success(t('settings.saveSuccess'))
            setPerformanceEdits({})
            setLoggingEdits({})
            setConfigEdits({})
            queryClient.invalidateQueries({ queryKey: ['options'] })
            queryClient.invalidateQueries({ queryKey: ['config'] })
            queryClient.invalidateQueries({ queryKey: ['remotes'] })
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : t('common.unknownError')
            toast.error(t('settings.saveError', { message }))
        },
    })

    return (
        <section className="flex flex-col w-full xl:h-full xl:min-h-0 xl:flex-row xl:overflow-hidden">
            <div className="flex flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto">
                <PageHeader title={t('settings.title')} description={t('settings.description')} />

                <PageContent>
                    <div className="p-6 mt-6 border rounded-xl bg-card lg:p-8">
                        <div className="space-y-8">
                            <div className="space-y-5">
                                <div className="flex items-center gap-3">
                                    <span className="inline-flex items-center justify-center rounded-md size-8 bg-primary/10 text-primary">
                                        <GaugeIcon className="size-4" />
                                    </span>
                                    <h2 className="text-2xl font-semibold tracking-tight">
                                        {t('settings.performance')}
                                    </h2>
                                </div>

                                {optionsQuery.isPending ? (
                                    <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
                                        <Spinner />
                                        <span>{t('settings.loadingOptions')}</span>
                                    </div>
                                ) : optionsQuery.isError ? (
                                    <p className="text-sm text-destructive py-4">
                                        {t('settings.loadError', {
                                            message:
                                                optionsQuery.error instanceof Error
                                                    ? optionsQuery.error.message
                                                    : t('common.unknownError'),
                                        })}
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                        <div className="space-y-2.5">
                                            <h3 className="text-xl font-medium">
                                                {t('settings.maxTransfers')}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {t('settings.maxTransfersDescription')}
                                            </p>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={transfers}
                                                onChange={(event) =>
                                                    updatePerformance(
                                                        'transfers',
                                                        event.target.value
                                                    )
                                                }
                                                className="h-12"
                                            />
                                        </div>

                                        <div className="space-y-2.5">
                                            <h3 className="text-xl font-medium">
                                                {t('settings.checkers')}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {t('settings.checkersDescription')}
                                            </p>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={checkers}
                                                onChange={(event) =>
                                                    updatePerformance(
                                                        'checkers',
                                                        event.target.value
                                                    )
                                                }
                                                className="h-12"
                                            />
                                        </div>

                                        <div className="space-y-2.5">
                                            <h3 className="text-xl font-medium">
                                                {t('settings.bandwidthLimit')}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {t('settings.bandwidthLimitDescription')}
                                            </p>
                                            <Input
                                                value={bwLimit}
                                                onChange={(event) =>
                                                    updatePerformance('bwLimit', event.target.value)
                                                }
                                                placeholder={t('settings.unlimitedPlaceholder')}
                                                className="h-12"
                                            />
                                        </div>

                                        <div className="space-y-2.5">
                                            <h3 className="text-xl font-medium">
                                                {t('settings.tpsLimit')}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {t('settings.tpsLimitDescription')}
                                            </p>
                                            <Input
                                                type="number"
                                                min={0}
                                                step="any"
                                                value={tpsLimit}
                                                onChange={(event) =>
                                                    updatePerformance(
                                                        'tpsLimit',
                                                        event.target.value
                                                    )
                                                }
                                                className="h-12"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="space-y-5">
                                <div className="flex items-center gap-3">
                                    <span className="inline-flex items-center justify-center rounded-md size-8 bg-primary/10 text-primary">
                                        <FileCogIcon className="size-4" />
                                    </span>
                                    <h2 className="text-2xl font-semibold tracking-tight">
                                        {t('settings.logging')}
                                    </h2>
                                </div>

                                {optionsQuery.isSuccess ? (
                                    <>
                                        <div className="space-y-2.5">
                                            <h3 className="text-xl font-medium">
                                                {t('settings.defaultLogLevel')}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {t('settings.defaultLogLevelDescription')}
                                            </p>
                                            <Select
                                                items={logLevelItems}
                                                value={logLevel}
                                                onValueChange={(value) =>
                                                    updateLogging('logLevel', value ?? logLevel)
                                                }
                                            >
                                                <SelectTrigger className="w-full data-[size=default]:h-12">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        {logLevelItems.map((item) => (
                                                            <SelectItem
                                                                key={item.value}
                                                                value={item.value}
                                                            >
                                                                {item.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2.5">
                                            <h3 className="text-xl font-medium">
                                                {t('settings.logFilePath')}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {t('settings.logFilePathDescription')}
                                            </p>
                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <Input
                                                    value={logFilePath}
                                                    onChange={(event) =>
                                                        updateLogging(
                                                            'logFilePath',
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder={t(
                                                        'settings.logFilePathPlaceholder'
                                                    )}
                                                    className="h-12 font-mono"
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : null}
                            </div>

                            <Separator />

                            <div className="space-y-5">
                                <div className="flex items-center gap-3">
                                    <span className="inline-flex items-center justify-center rounded-md size-8 bg-primary/10 text-primary">
                                        <LayersIcon className="size-4" />
                                    </span>
                                    <h2 className="text-2xl font-semibold tracking-tight">
                                        {t('settings.configFile')}
                                    </h2>
                                </div>

                                <div className="space-y-5">
                                    <div className="space-y-2.5">
                                        <h3 className="text-xl font-medium">
                                            {t('settings.configPath')}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {t('settings.configPathDescription')}
                                        </p>
                                        {configPathsQuery.isError ? (
                                            <p className="text-sm text-destructive">
                                                {t('settings.configPathLoadError', {
                                                    message:
                                                        configPathsQuery.error instanceof Error
                                                            ? configPathsQuery.error.message
                                                            : t('common.unknownError'),
                                                })}
                                            </p>
                                        ) : null}
                                        <Input
                                            value={configPath}
                                            onChange={(event) =>
                                                updateConfig('configPath', event.target.value)
                                            }
                                            disabled={
                                                (configPathsQuery.isPending &&
                                                    !('configPath' in configEdits)) ||
                                                saveMutation.isPending
                                            }
                                            className="h-12 font-mono"
                                        />
                                    </div>

                                    <div className="space-y-2.5">
                                        <h3 className="text-xl font-medium">
                                            {t('settings.configContents')}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {t('settings.configContentsDescription')}
                                        </p>
                                        {configContentsQuery.isPending &&
                                        !('configContents' in configEdits) ? (
                                            <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
                                                <Spinner />
                                                <span>{t('settings.configContentsLoading')}</span>
                                            </div>
                                        ) : null}
                                        {configContentsQuery.isError &&
                                        !('configContents' in configEdits) ? (
                                            <p className="text-sm text-destructive">
                                                {t('settings.configContentsLoadError', {
                                                    message:
                                                        configContentsQuery.error instanceof Error
                                                            ? configContentsQuery.error.message
                                                            : t('common.unknownError'),
                                                })}
                                            </p>
                                        ) : null}
                                        <div className="relative">
                                            <Textarea
                                                value={configContents}
                                                onChange={(event) =>
                                                    updateConfig(
                                                        'configContents',
                                                        event.target.value
                                                    )
                                                }
                                                disabled={
                                                    (configContentsQuery.isPending &&
                                                        !('configContents' in configEdits)) ||
                                                    saveMutation.isPending
                                                }
                                                className="min-h-96 max-h-[60vh] font-mono text-sm"
                                            />
                                            {!isConfigRevealed ? (
                                                <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/40 backdrop-blur-md">
                                                    <Button
                                                        type="button"
                                                        onClick={() => setIsConfigRevealed(true)}
                                                    >
                                                        <EyeIcon />
                                                        {t('settings.showConfig')}
                                                    </Button>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator className="my-8" />

                        <div className="flex items-center justify-end gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setPerformanceEdits({})
                                    setLoggingEdits({})
                                    setConfigEdits({})
                                }}
                                disabled={!isDirty || saveMutation.isPending}
                            >
                                {t('common.reset')}
                            </Button>
                            <Button
                                type="button"
                                disabled={!isDirty || saveMutation.isPending}
                                onClick={() => saveMutation.mutate()}
                            >
                                {saveMutation.isPending
                                    ? t('common.saving')
                                    : t('common.saveChanges')}
                            </Button>
                        </div>
                    </div>
                </PageContent>
            </div>

            <aside className="flex w-full shrink-0 flex-col border-t xl:h-full xl:w-[415px] xl:border-t-0 xl:border-l">
                <div className="p-6 space-y-8 xl:flex-1 xl:overflow-y-auto">
                    <div className="p-5 border rounded-xl bg-primary/5">
                        <div className="inline-flex items-center gap-2 mb-3 text-sm font-semibold uppercase text-primary">
                            <InfoIcon className="size-4" />
                            {t('settings.proTip')}
                        </div>
                        <p className="text-base leading-8 text-muted-foreground">
                            {t('settings.proTipText')}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                            {t('settings.relatedDocs')}
                        </h3>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3 text-xl">
                                <BookOpenIcon className="size-4 text-muted-foreground" />
                                <a
                                    href="https://rclone.org/flags/"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    {t('settings.globalFlagsReference')}
                                </a>
                            </li>
                            <li className="flex items-center gap-3 text-xl">
                                <BookOpenIcon className="size-4 text-muted-foreground" />
                                <a
                                    href="https://rclone.org/flags/#performance"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    {t('settings.performanceTuning')}
                                </a>
                            </li>
                            <li className="flex items-center gap-3 text-xl">
                                <MessageCircleCodeIcon className="size-4 text-muted-foreground" />
                                <a
                                    href="https://github.com/rclone/rclone-web"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    {t('settings.githubRepo')}
                                </a>
                            </li>
                        </ul>
                    </div>

                    <Separator />

                    <div className="p-5 border rounded-xl bg-primary/5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-sm font-semibold uppercase text-muted-foreground">
                                {t('settings.versionTitle')}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => {
                                    navigator.clipboard.writeText(versionOutput)
                                    toast.success(t('settings.copiedToClipboard'))
                                }}
                            >
                                <ClipboardCopyIcon className="size-3.5" />
                            </Button>
                        </div>
                        <div
                            className="font-mono text-sm break-all text-primary dark:text-blue-200"
                            style={{ whiteSpace: 'pre-wrap' }}
                        >
                            {versionOutput}
                        </div>
                    </div>
                </div>
            </aside>
        </section>
    )
}
