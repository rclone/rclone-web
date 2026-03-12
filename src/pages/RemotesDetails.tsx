import { PageContent } from '@/components/PageContent'
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
    getItemsForPath,
    getPathSegments,
    getRemote,
    normalizePath,
    remotes,
} from '@/data/remote-browser-data'
import { cn } from '@/lib/ui'
import {
    ArchiveIcon,
    ChevronLeftIcon,
    CloudIcon,
    DownloadCloudIcon,
    FileImageIcon,
    FileSpreadsheetIcon,
    FileTextIcon,
    FolderIcon,
    FolderPlusIcon,
    HardDriveIcon,
    HouseIcon,
    PencilIcon,
    SearchIcon,
    TrashIcon,
    UploadIcon,
} from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'

function getFileTypeIcon(fileType: string | undefined) {
    if (fileType === 'pdf') {
        return {
            icon: FileTextIcon,
            className: 'bg-rose-500/10 text-rose-600',
        }
    }

    if (fileType === 'spreadsheet') {
        return {
            icon: FileSpreadsheetIcon,
            className: 'bg-emerald-500/10 text-emerald-600',
        }
    }

    if (fileType === 'image') {
        return {
            icon: FileImageIcon,
            className: 'bg-sky-500/10 text-sky-600',
        }
    }

    if (fileType === 'archive') {
        return {
            icon: ArchiveIcon,
            className: 'bg-amber-500/10 text-amber-600',
        }
    }

    return {
        icon: FileTextIcon,
        className: 'bg-muted text-muted-foreground',
    }
}

function buildRemotePathHref(remoteName: string, path: string) {
    const normalizedPath = normalizePath(path)

    if (!normalizedPath) {
        return `/remotes/${remoteName}`
    }

    const query = new URLSearchParams({ path: normalizedPath })
    return `/remotes/${remoteName}?${query.toString()}`
}

export function RemotesDetailsPage() {
    const navigate = useNavigate()
    const { remoteName = '' } = useParams()
    const [searchParams, setSearchParams] = useSearchParams()
    const [searchTerm, setSearchTerm] = useState('')

    const currentPath = useMemo(() => normalizePath(searchParams.get('path')), [searchParams])
    const currentRemote = useMemo(() => getRemote(remoteName), [remoteName])
    const storagePercent = currentRemote
        ? currentRemote.isUnlimited
            ? 50
            : Math.round((currentRemote.usedGb / currentRemote.totalGb) * 100)
        : 0
    const pathItems = useMemo(
        () => (currentRemote ? getItemsForPath(currentRemote.name, currentPath) : undefined),
        [currentRemote, currentPath]
    )
    const isInvalidPath = Boolean(currentRemote) && pathItems === undefined
    const itemsAtPath = pathItems ?? []
    const filteredItems = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()

        if (!normalizedSearch) {
            return itemsAtPath
        }

        return itemsAtPath.filter((item) => item.name.toLowerCase().includes(normalizedSearch))
    }, [itemsAtPath, searchTerm])
    const breadcrumbItems = useMemo(() => {
        const segments = getPathSegments(currentPath)

        return segments.map((segment, index) => ({
            label: segment,
            path: segments.slice(0, index + 1).join('/'),
        }))
    }, [currentPath])

    const setPath = (path: string) => {
        const normalizedPath = normalizePath(path)

        setSearchParams((previousParams) => {
            const nextParams = new URLSearchParams(previousParams)

            if (normalizedPath) {
                nextParams.set('path', normalizedPath)
            } else {
                nextParams.delete('path')
            }

            return nextParams
        })
    }

    const openFolder = (folderName: string) => {
        setPath([currentPath, folderName].filter(Boolean).join('/'))
    }
    const canGoBack = breadcrumbItems.length > 0

    const goBack = () => {
        if (!canGoBack) {
            return
        }

        const parentPath =
            breadcrumbItems.length > 1 ? breadcrumbItems[breadcrumbItems.length - 2].path : ''
        setPath(parentPath)
    }

    return (
        <section className="flex h-full min-h-0 w-full">
            <aside className="flex w-72 shrink-0 flex-col border-r bg-background">
                <h2 className="px-4 py-4 font-semibold tracking-wide text-muted-foreground uppercase">
                    Remotes
                </h2>

                <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
                    {remotes.map((remote) => (
                        <NavLink
                            key={remote.name}
                            to={buildRemotePathHref(remote.name, '')}
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
                            <span className="truncate">{remote.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="border-t p-4">
                    {currentRemote ? (
                        <Card size="sm" className="gap-3">
                            <CardHeader className="pb-0">
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle className="text-sm">Storage</CardTitle>
                                    {currentRemote.isUnlimited ? null : (
                                        <span className="text-xs text-muted-foreground">
                                            {storagePercent}%
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Progress value={storagePercent} />
                                <p className="text-xs text-muted-foreground">
                                    {currentRemote.isUnlimited
                                        ? `${currentRemote.usedGb} GB used`
                                        : `${currentRemote.usedGb} GB of ${currentRemote.totalGb} GB used`}
                                </p>
                            </CardContent>
                        </Card>
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

            <div className="flex min-h-0 flex-1 flex-col">
                {currentRemote ? (
                    <div className="border-b px-6 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <Link
                                            to={buildRemotePathHref(currentRemote.name, '')}
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
                                                    <BreadcrumbPage>
                                                        {item.label}
                                                    </BreadcrumbPage>
                                                ) : (
                                                    <Link
                                                        to={buildRemotePathHref(
                                                            currentRemote.name,
                                                            item.path
                                                        )}
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

                            <div className="flex items-center gap-2">
                                <Button type="button">
                                    <UploadIcon />
                                    Upload
                                </Button>
                                <Button type="button" variant="outline">
                                    <FolderPlusIcon />
                                    New Folder
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="border-b px-6 py-4">
                        <p className="text-2xl font-semibold tracking-tight">Remote Not Found</p>
                        <p className="text-muted-foreground">{`No remote found for "${remoteName}".`}</p>
                    </div>
                )}

                <PageContent>
                    {currentRemote ? (
                        isInvalidPath ? (
                            <Empty className="mt-6 rounded-xl border">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <FolderIcon />
                                    </EmptyMedia>
                                    <EmptyTitle>Path not found</EmptyTitle>
                                    <EmptyDescription>
                                        The folder path does not exist for this remote.
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setPath('')}
                                    >
                                        Go to root
                                    </Button>
                                </EmptyContent>
                            </Empty>
                        ) : (
                            <div className="mt-6 space-y-4">
                                <div className="flex w-full items-center gap-2 xl:max-w-xl">
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        aria-label="Go to parent folder"
                                        disabled={!canGoBack}
                                        onClick={goBack}
                                    >
                                        <ChevronLeftIcon />
                                    </Button>
                                    <InputGroup className="min-w-0 flex-1">
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
                                </div>

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
                                                    const fileTypeUi = getFileTypeIcon(
                                                        item.fileType
                                                    )
                                                    const FileTypeIcon = fileTypeUi.icon

                                                    return (
                                                        <TableRow
                                                            key={item.id}
                                                            className="group/row hover:bg-muted/20"
                                                        >
                                                            <TableCell className="px-2 py-3">
                                                                {item.kind === 'folder' ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            openFolder(item.name)
                                                                        }
                                                                        className="inline-flex items-center gap-3 rounded-md px-1 py-1 -translate-x-1 text-left transition-colors hover:bg-muted"
                                                                    >
                                                                        <span className="inline-flex size-10 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600">
                                                                            <FolderIcon />
                                                                        </span>
                                                                        <span className="font-medium">
                                                                            {item.name}
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
                                                                            {item.name}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </TableCell>

                                                            <TableCell className="px-4 py-3 font-medium text-muted-foreground">
                                                                {item.sizeLabel}
                                                            </TableCell>
                                                            <TableCell className="px-4 py-3 font-medium text-muted-foreground">
                                                                {item.modifiedLabel}
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
                                                                                    aria-label={`Rename ${item.name}`}
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
                                                                                    aria-label={`Delete ${item.name}`}
                                                                                >
                                                                                    <TrashIcon className="size-3.5" />
                                                                                </Button>
                                                                            }
                                                                        />
                                                                        <TooltipContent>
                                                                            Delete
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                    {item.kind ===
                                                                    'folder' ? null : (
                                                                        <Tooltip>
                                                                            <TooltipTrigger
                                                                                render={
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        size="icon-xs"
                                                                                        aria-label={`Download ${item.name}`}
                                                                                    >
                                                                                        <DownloadCloudIcon className="size-3.5" />
                                                                                    </Button>
                                                                                }
                                                                            />
                                                                            <TooltipContent>
                                                                                Download
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    )}
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
                        )
                    ) : (
                        <Empty className="mt-6 rounded-xl border">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <HardDriveIcon />
                                </EmptyMedia>
                                <EmptyTitle>Remote not found</EmptyTitle>
                                <EmptyDescription>
                                    The requested remote does not exist in this demo data set.
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
                    )}
                </PageContent>
            </div>
        </section>
    )
}
