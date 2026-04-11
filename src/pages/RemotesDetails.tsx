import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    ArchiveIcon,
    CloudIcon,
    DownloadIcon,
    FileImageIcon,
    FileSpreadsheetIcon,
    FileTextIcon,
    FolderIcon,
    HardDriveIcon,
    HouseIcon,
    PencilIcon,
    SearchIcon,
    TrashIcon,
    UploadIcon,
} from 'lucide-react'
import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageContent } from '@/components/PageContent'
import { RefreshButton } from '@/components/RefreshButton'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Progress } from '@/components/ui/progress'
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
import { formatBytes } from '@/lib/format'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/ui'
import rclone from '@/rclone/client'

const IMAGE_EXTS = new Set([
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'svg',
    'bmp',
    'ico',
    'tiff',
    'tif',
    'avif',
])
const SPREADSHEET_EXTS = new Set(['xlsx', 'xls', 'csv', 'ods', 'tsv', 'numbers'])
const ARCHIVE_EXTS = new Set(['zip', 'tar', 'gz', 'bz2', 'rar', '7z', 'xz', 'zst', 'tgz'])
const PDF_EXTS = new Set(['pdf'])

function getFileExtension(name: string): string {
    const lastDot = name.lastIndexOf('.')
    if (lastDot < 0) return ''
    return name.slice(lastDot + 1).toLowerCase()
}

function getFileTypeIcon(name: string) {
    const ext = getFileExtension(name)

    if (PDF_EXTS.has(ext)) {
        return { icon: FileTextIcon, className: 'bg-rose-500/10 text-rose-600' }
    }
    if (SPREADSHEET_EXTS.has(ext)) {
        return { icon: FileSpreadsheetIcon, className: 'bg-emerald-500/10 text-emerald-600' }
    }
    if (IMAGE_EXTS.has(ext)) {
        return { icon: FileImageIcon, className: 'bg-sky-500/10 text-sky-600' }
    }
    if (ARCHIVE_EXTS.has(ext)) {
        return { icon: ArchiveIcon, className: 'bg-amber-500/10 text-amber-600' }
    }

    return { icon: FileTextIcon, className: 'bg-muted text-muted-foreground' }
}

function normalizePath(pathParam: string | null | undefined) {
    if (!pathParam) return ''
    return pathParam
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean)
        .join('/')
}

function getPathSegments(path: string) {
    const normalized = normalizePath(path)
    if (!normalized) return []
    return normalized.split('/')
}

function buildRemotePathHref(remoteName: string, path: string) {
    const normalized = normalizePath(path)
    if (!normalized) return `/remotes/${remoteName}`
    const query = new URLSearchParams({ path: normalized })
    return `/remotes/${remoteName}?${query.toString()}`
}

function formatModTime(modTime: string | undefined): string {
    if (!modTime) return '\u2014'
    try {
        const date = new Date(modTime)
        if (Number.isNaN(date.getTime())) return '\u2014'
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    } catch {
        return '\u2014'
    }
}

function buildServeUrl(rcUrl: string, serveAddr: string): string {
    const parsed = new URL(rcUrl.trim().replace(/\/+$/, ''))
    const portMatch = serveAddr.match(/:(\d+)$/)
    if (!portMatch) throw new Error('Could not parse serve address')
    return `${parsed.protocol}//${parsed.hostname}:${portMatch[1]}`
}

type ListItem = {
    Name: string
    Path: string
    Size: number
    ModTime: string
    IsDir: boolean
}

export function RemotesDetailsPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { remoteName = '' } = useParams()
    const [searchParams, setSearchParams] = useSearchParams()
    const [searchTerm, setSearchTerm] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const connectionKey = useAuthStore((state) => `${state.url}\u0000${state.user}`)

    const currentPath = useMemo(() => normalizePath(searchParams.get('path')), [searchParams])

    // --- Queries ---

    const remotesQuery = useQuery({
        queryKey: ['remote-names', connectionKey],
        queryFn: async () => {
            const response = await rclone('/config/listremotes')
            return [...(response.remotes ?? [])].sort((a, b) => a.localeCompare(b))
        },
    })

    const remoteExists =
        !!remoteName && (!remotesQuery.isSuccess || (remotesQuery.data ?? []).includes(remoteName))

    const listQuery = useQuery({
        queryKey: ['remote-browse', remoteName, currentPath, connectionKey],
        queryFn: async () => {
            const response = await rclone('/operations/list', {
                params: { query: { fs: `${remoteName}:`, remote: currentPath } },
            })
            const rawList = ((response as any).list ?? []) as Array<Record<string, any>>
            return rawList
                .map(
                    (item): ListItem => ({
                        Name: String(item.Name ?? ''),
                        Path: String(item.Path ?? item.Name ?? ''),
                        Size: Number(item.Size ?? 0),
                        ModTime: String(item.ModTime ?? ''),
                        IsDir: Boolean(item.IsDir || item.IsBucket),
                    })
                )
                .sort((a, b) => {
                    if (a.IsDir !== b.IsDir) return a.IsDir ? -1 : 1
                    return a.Name.localeCompare(b.Name)
                })
        },
        enabled: remoteExists,
    })

    const usageQuery = useQuery({
        queryKey: ['remote-usage', remoteName, connectionKey],
        queryFn: async () => {
            const response = await rclone('/operations/about', {
                params: { query: { fs: `${remoteName}:` } },
            })
            return response as { used?: number; total?: number; free?: number }
        },
        enabled: remoteExists,
        retry: false,
    })

    // --- Mutations ---

    const deleteMutation = useMutation({
        mutationFn: async ({ path, isDir }: { path: string; isDir: boolean }) => {
            const endpoint = isDir ? '/operations/purge' : '/operations/deletefile'
            await rclone(endpoint as any, {
                params: { query: { fs: `${remoteName}:`, remote: path } },
            })
        },
        onSuccess: () => {
            toast.success('Deleted successfully.')
            queryClient.invalidateQueries({ queryKey: ['remote-browse', remoteName] })
        },
        onError: (error) => {
            toast.error(
                `Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
        },
    })

    // const mkdirMutation = useMutation({
    //     mutationFn: async (path: string) => {
    //         await rclone('/operations/mkdir', {
    //             params: { query: { fs: `${remoteName}:`, remote: path } },
    //         })
    //     },
    //     onSuccess: () => {
    //         toast.success('Folder created.')
    //         queryClient.invalidateQueries({ queryKey: ['remote-browse', remoteName] })
    //     },
    //     onError: (error) => {
    //         toast.error(
    //             `Could not create folder: ${error instanceof Error ? error.message : 'Unknown error'}`
    //         )
    //     },
    // })

    const renameMutation = useMutation({
        mutationFn: async ({
            oldPath,
            newPath,
            isDir,
        }: {
            oldPath: string
            newPath: string
            isDir: boolean
        }) => {
            if (isDir) {
                await rclone('/sync/move' as any, {
                    params: {
                        query: {
                            srcFs: `${remoteName}:${oldPath}/`,
                            dstFs: `${remoteName}:${newPath}/`,
                            deleteEmptySrcDirs: true,
                        },
                    },
                })
            } else {
                await rclone('/operations/movefile', {
                    params: {
                        query: {
                            srcFs: `${remoteName}:`,
                            srcRemote: oldPath,
                            dstFs: `${remoteName}:`,
                            dstRemote: newPath,
                        },
                    },
                })
            }
        },
        onSuccess: () => {
            toast.success('Renamed successfully.')
            queryClient.invalidateQueries({ queryKey: ['remote-browse', remoteName] })
        },
        onError: (error) => {
            toast.error(
                `Rename failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
        },
    })

    const uploadMutation = useMutation({
        mutationFn: async (files: File[]) => {
            const { url, user, pass } = useAuthStore.getState()
            const baseUrl = url.trim().replace(/\/+$/, '')
            const params = new URLSearchParams({
                fs: `${remoteName}:`,
                remote: currentPath,
            })

            for (const file of files) {
                const formData = new FormData()
                formData.append('file', file, file.name)

                const response = await fetch(`${baseUrl}/operations/uploadfile?${params}`, {
                    method: 'POST',
                    headers:
                        user && pass
                            ? { Authorization: `Basic ${btoa(`${user}:${pass}`)}` }
                            : undefined,
                    body: formData,
                })

                if (!response.ok) {
                    let errorMsg = `${response.status} ${response.statusText}`
                    try {
                        const data = (await response.json()) as { error?: string }
                        if (data?.error) errorMsg = data.error
                    } catch {}
                    throw new Error(`Failed to upload ${file.name}: ${errorMsg}`)
                }
            }
        },
        onSuccess: () => {
            toast.success('Upload complete.')
            queryClient.invalidateQueries({
                queryKey: ['remote-browse', remoteName, currentPath, connectionKey],
            })
            if (fileInputRef.current) fileInputRef.current.value = ''
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Upload failed')
            if (fileInputRef.current) fileInputRef.current.value = ''
        },
    })

    const downloadMutation = useMutation({
        mutationFn: async ({
            name,
            path,
            isDir,
        }: {
            name: string
            path: string
            isDir: boolean
        }) => {
            const result = await rclone('/serve/start' as any, {
                params: {
                    query: {
                        type: 'http',
                        fs: `${remoteName}:`,
                        addr: ':0',
                        allow_origin: '*',
                    } as any,
                },
            })

            const { id: serveId, addr: serveAddr } = result as { id: string; addr: string }

            try {
                const { url } = useAuthStore.getState()
                const serveBaseUrl = buildServeUrl(url, serveAddr)

                const downloadUrl = isDir
                    ? `${serveBaseUrl}/${path}/?download=zip`
                    : `${serveBaseUrl}/${path}`

                const response = await fetch(downloadUrl)
                if (!response.ok) {
                    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
                }

                const blob = await response.blob()
                const objectUrl = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = objectUrl
                a.download = isDir ? `${name}.zip` : name
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(objectUrl)
            } finally {
                try {
                    await rclone('/serve/stop', {
                        params: { query: { id: serveId } },
                    })
                } catch {
                    // Swallow stop errors
                }
            }
        },
        onError: (error) => {
            toast.error(
                `Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
        },
    })

    // --- Memos ---

    const remoteNames = useMemo(() => remotesQuery.data ?? [], [remotesQuery.data])
    const items = useMemo(() => listQuery.data ?? [], [listQuery.data])
    const filteredItems = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        if (!q) return items
        return items.filter((item) => item.Name.toLowerCase().includes(q))
    }, [items, searchTerm])

    const breadcrumbItems = useMemo(() => {
        const segments = getPathSegments(currentPath)
        return segments.map((segment, index) => ({
            label: segment,
            path: segments.slice(0, index + 1).join('/'),
        }))
    }, [currentPath])

    const usage = useMemo(() => {
        const data = usageQuery.data
        if (!data || data.used === undefined) return null
        const used = data.used
        const total = data.total
        const hasTotal = total !== undefined && total > 0

        return {
            usedLabel: formatBytes(used),
            totalLabel: hasTotal ? formatBytes(total) : null,
            percent: hasTotal ? Math.min(Math.round((used / total) * 100), 100) : null,
        }
    }, [usageQuery.data])

    const remoteNotFound = useMemo(
        () => remotesQuery.isSuccess && remoteName !== '' && !remoteNames.includes(remoteName),
        [remotesQuery.isSuccess, remoteName, remoteNames]
    )

    const isMutating = useMemo(
        () =>
            deleteMutation.isPending ||
            // mkdirMutation.isPending ||
            renameMutation.isPending ||
            uploadMutation.isPending ||
            downloadMutation.isPending,
        [
            deleteMutation.isPending,
            renameMutation.isPending,
            uploadMutation.isPending,
            downloadMutation.isPending,
        ]
    )

    // --- Callbacks ---

    const setPath = useCallback(
        (path: string) => {
            const normalized = normalizePath(path)
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                if (normalized) {
                    next.set('path', normalized)
                } else {
                    next.delete('path')
                }
                return next
            })
        },
        [setSearchParams]
    )

    const openFolder = useCallback(
        (folderName: string) => {
            setPath([currentPath, folderName].filter(Boolean).join('/'))
        },
        [setPath, currentPath]
    )

    // const handleNewFolder = useCallback(() => {
    //     const name = window.prompt('Enter folder name:')
    //     if (!name?.trim()) return
    //     const folderPath = [currentPath, name.trim()].filter(Boolean).join('/')
    //     mkdirMutation.mutate(folderPath)
    // }, [currentPath])

    const handleRename = useCallback(
        (item: ListItem) => {
            const newName = window.prompt('Enter new name:', item.Name)
            if (!newName?.trim() || newName.trim() === item.Name) return
            const oldPath = [currentPath, item.Name].filter(Boolean).join('/')
            const newPath = [currentPath, newName.trim()].filter(Boolean).join('/')
            renameMutation.mutate({ oldPath, newPath, isDir: item.IsDir })
        },
        [currentPath]
    )

    const handleDelete = useCallback(
        (item: ListItem) => {
            const confirmed = window.confirm(
                `Are you sure you want to delete "${item.Name}"?${item.IsDir ? ' This will delete all contents.' : ''}`
            )
            if (!confirmed) return
            const itemPath = [currentPath, item.Name].filter(Boolean).join('/')
            deleteMutation.mutate({ path: itemPath, isDir: item.IsDir })
        },
        [currentPath]
    )

    const handleDownload = useCallback(
        (item: ListItem) => {
            const itemPath = [currentPath, item.Name].filter(Boolean).join('/')
            downloadMutation.mutate({ name: item.Name, path: itemPath, isDir: item.IsDir })
        },
        [currentPath]
    )

    const handleUpload = useCallback(() => {
        fileInputRef.current?.click()
    }, [fileInputRef])

    const handleFileChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = event.target.files
            if (!files || files.length === 0) return
            uploadMutation.mutate(Array.from(files))
        },
        [uploadMutation]
    )

    // --- Render ---

    return (
        <section className="flex h-full min-h-0 w-full overflow-hidden">
            <input
                ref={fileInputRef}
                type="file"
                multiple={true}
                className="hidden"
                onChange={handleFileChange}
            />

            <aside className="flex w-72 shrink-0 flex-col border-r bg-background">
                <h2 className="px-4 py-4 pb-0 font-semibold tracking-wide text-muted-foreground uppercase">
                    Remotes
                </h2>

                <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
                    {remotesQuery.isPending ? (
                        <div className="flex justify-center py-6">
                            <Spinner className="size-5" />
                        </div>
                    ) : remotesQuery.isError ? (
                        <p className="px-3 py-2 text-sm text-destructive">Failed to load remotes</p>
                    ) : remoteNames.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">
                            No remotes configured
                        </p>
                    ) : (
                        remoteNames.map((name) => (
                            <NavLink
                                key={name}
                                to={buildRemotePathHref(name, '')}
                                className={({ isActive }) =>
                                    cn(
                                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-muted text-foreground'
                                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                                    )
                                }
                            >
                                <CloudIcon className="size-4 shrink-0" />
                                <span className="truncate">{name}</span>
                            </NavLink>
                        ))
                    )}
                </nav>

                <div className="border-t p-4">
                    {remoteName ? (
                        usageQuery.isPending ? (
                            <Card size="sm">
                                <CardContent className="flex justify-center py-2">
                                    <Spinner className="size-4" />
                                </CardContent>
                            </Card>
                        ) : usage ? (
                            <Card size="sm" className="gap-3">
                                <CardHeader className="pb-0">
                                    <div className="flex items-center justify-between gap-3">
                                        <CardTitle className="text-sm">Storage</CardTitle>
                                        {usage.percent !== null ? (
                                            <span className="text-xs text-muted-foreground">
                                                {usage.percent}%
                                            </span>
                                        ) : null}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <Progress value={usage.percent ?? 50} />
                                    <p className="text-xs text-muted-foreground">
                                        {usage.totalLabel
                                            ? `${usage.usedLabel} of ${usage.totalLabel} used`
                                            : `${usage.usedLabel} used`}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card size="sm">
                                <CardContent>
                                    <p className="text-xs text-muted-foreground">
                                        Usage info not available for this remote.
                                    </p>
                                </CardContent>
                            </Card>
                        )
                    ) : (
                        <Card size="sm">
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Select a remote to view storage.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </aside>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {remoteNotFound ? (
                    <div className="border-b px-6 py-4">
                        <p className="text-2xl font-semibold tracking-tight">Remote Not Found</p>
                        <p className="text-muted-foreground">{`No remote found for "${remoteName}".`}</p>
                    </div>
                ) : remoteName ? (
                    <div className="sticky top-0 z-10 border-b bg-background px-6 py-4 space-y-3">
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <Link
                                        to={buildRemotePathHref(remoteName, '')}
                                        className="inline-flex items-center transition-colors hover:text-foreground"
                                    >
                                        <HouseIcon className="size-3.5" />
                                    </Link>
                                </BreadcrumbItem>

                                {breadcrumbItems.map((item, index) => (
                                    <Fragment key={item.path}>
                                        <BreadcrumbSeparator />
                                        <BreadcrumbItem>
                                            {index === breadcrumbItems.length - 1 ? (
                                                <BreadcrumbPage>{item.label}</BreadcrumbPage>
                                            ) : (
                                                <Link
                                                    to={buildRemotePathHref(remoteName, item.path)}
                                                    className="transition-colors hover:text-foreground"
                                                >
                                                    {item.label}
                                                </Link>
                                            )}
                                        </BreadcrumbItem>
                                    </Fragment>
                                ))}
                            </BreadcrumbList>
                        </Breadcrumb>

                        <div className="flex flex-wrap items-center gap-2">
                            <InputGroup className="min-w-0 flex-1 basis-48">
                                <InputGroupAddon align="inline-start">
                                    <SearchIcon />
                                </InputGroupAddon>
                                <InputGroupInput
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Search in current folder..."
                                    aria-label="Search files and folders"
                                />
                            </InputGroup>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    onClick={handleUpload}
                                    disabled={uploadMutation.isPending}
                                >
                                    <UploadIcon />
                                    {uploadMutation.isPending ? 'Uploading\u2026' : 'Upload'}
                                </Button>
                                {/* <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleNewFolder}
                                    disabled={mkdirMutation.isPending}
                                >
                                    <FolderPlusIcon />
                                    New Folder
                                </Button> */}
                                <RefreshButton
                                    isFetching={listQuery.isFetching}
                                    refetch={listQuery.refetch}
                                />
                            </div>
                        </div>
                    </div>
                ) : null}

                <PageContent>
                    {remoteNotFound ? (
                        <Empty className="mt-6 rounded-xl border">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <HardDriveIcon />
                                </EmptyMedia>
                                <EmptyTitle>Remote not found</EmptyTitle>
                                <EmptyDescription>
                                    {`The remote "${remoteName}" does not exist.`}
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate('/remotes')}
                                >
                                    Go to remotes
                                </Button>
                            </EmptyContent>
                        </Empty>
                    ) : listQuery.isPending ? (
                        <div className="flex items-center justify-center py-14">
                            <Spinner className="size-8" />
                        </div>
                    ) : listQuery.isError ? (
                        <div className="mt-6">
                            <Alert variant="destructive">
                                <AlertTitle>Unable to list files</AlertTitle>
                                <AlertDescription>
                                    {listQuery.error instanceof Error
                                        ? listQuery.error.message
                                        : 'Unknown error occurred'}
                                </AlertDescription>
                                <AlertAction>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="xs"
                                        onClick={() => listQuery.refetch()}
                                    >
                                        Retry
                                    </Button>
                                </AlertAction>
                            </Alert>
                        </div>
                    ) : (
                        <div className="mt-6">
                            <div className="overflow-hidden rounded-xl border">
                                <Table className="min-w-[760px]">
                                    <TableHeader className="bg-muted/40">
                                        <TableRow className="hover:bg-muted/40">
                                            <TableHead className="px-2 font-semibold text-muted-foreground uppercase">
                                                Name
                                            </TableHead>
                                            <TableHead className="w-40 px-4 font-semibold text-muted-foreground uppercase">
                                                Size
                                            </TableHead>
                                            <TableHead className="w-44 px-4 font-semibold text-muted-foreground uppercase">
                                                Modified
                                            </TableHead>
                                            <TableHead className="w-44 px-4 text-right font-semibold text-muted-foreground uppercase">
                                                Actions
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {filteredItems.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={4}
                                                    className="px-4 py-10 text-center"
                                                >
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium">
                                                            {searchTerm
                                                                ? 'No items match your search.'
                                                                : 'This folder is empty.'}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {searchTerm
                                                                ? 'Try a different file or folder name.'
                                                                : 'Upload files or create a new folder to get started.'}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredItems.map((item) => {
                                                const fileTypeUi = getFileTypeIcon(item.Name)
                                                const FileTypeIcon = fileTypeUi.icon

                                                return (
                                                    <TableRow
                                                        key={item.Path || item.Name}
                                                        className="group/row hover:bg-muted/20"
                                                    >
                                                        <TableCell className="px-2 py-3">
                                                            {item.IsDir ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        openFolder(item.Name)
                                                                    }
                                                                    className="inline-flex items-center gap-3 rounded-md px-1 py-1 pr-2.5 -translate-x-1 text-left transition-colors hover:bg-muted"
                                                                >
                                                                    <span className="inline-flex size-10 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600">
                                                                        <FolderIcon />
                                                                    </span>
                                                                    <span className="font-medium">
                                                                        {item.Name}
                                                                    </span>
                                                                </button>
                                                            ) : (
                                                                <div className="inline-flex items-center gap-3">
                                                                    <span
                                                                        className={cn(
                                                                            'inline-flex size-10 items-center justify-center rounded-md',
                                                                            fileTypeUi.className
                                                                        )}
                                                                    >
                                                                        <FileTypeIcon />
                                                                    </span>
                                                                    <span className="font-medium">
                                                                        {item.Name}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </TableCell>

                                                        <TableCell className="px-4 py-3 font-medium text-muted-foreground">
                                                            {item.IsDir
                                                                ? '--'
                                                                : formatBytes(item.Size)}
                                                        </TableCell>
                                                        <TableCell className="px-4 py-3 font-medium text-muted-foreground">
                                                            {formatModTime(item.ModTime)}
                                                        </TableCell>

                                                        <TableCell className="px-4 py-3">
                                                            <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
                                                                <Tooltip>
                                                                    <TooltipTrigger
                                                                        render={
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon-xs"
                                                                                aria-label={`Download ${item.Name}`}
                                                                                disabled={
                                                                                    isMutating
                                                                                }
                                                                                onClick={() =>
                                                                                    handleDownload(
                                                                                        item
                                                                                    )
                                                                                }
                                                                            >
                                                                                <DownloadIcon className="size-3.5" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                                    <TooltipContent>
                                                                        {item.IsDir
                                                                            ? 'Download as ZIP'
                                                                            : 'Download'}
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                                <Tooltip>
                                                                    <TooltipTrigger
                                                                        render={
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon-xs"
                                                                                aria-label={`Rename ${item.Name}`}
                                                                                disabled={
                                                                                    isMutating
                                                                                }
                                                                                onClick={() =>
                                                                                    handleRename(
                                                                                        item
                                                                                    )
                                                                                }
                                                                            >
                                                                                <PencilIcon className="size-3.5" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                                    <TooltipContent>
                                                                        Rename
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                                <Tooltip>
                                                                    <TooltipTrigger
                                                                        render={
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon-xs"
                                                                                aria-label={`Delete ${item.Name}`}
                                                                                disabled={
                                                                                    isMutating
                                                                                }
                                                                                onClick={() =>
                                                                                    handleDelete(
                                                                                        item
                                                                                    )
                                                                                }
                                                                            >
                                                                                <TrashIcon className="size-3.5" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                                    <TooltipContent>
                                                                        Delete
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </PageContent>
            </div>
        </section>
    )
}
