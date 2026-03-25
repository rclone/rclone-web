const baseRemotes = [
    {
        name: 'google-drive',
        label: 'Google Drive',
        providerLabel: 'Google Workspace',
        remoteType: 'drive',
        remotePath: 'drive://personal-vault',
        usageUsedLabel: '150GB',
        usageTotalLabel: '200GB',
        usagePercentLabel: '75%',
        usageBarPercent: 75,
        usedGb: 150,
        isUnlimited: false,
        totalGb: 200,
    },
    {
        name: 'dropbox-archive',
        label: 'Dropbox Archive',
        providerLabel: 'Dropbox Business',
        remoteType: 'dropbox',
        remotePath: 'dropbox://backups/2023',
        usageUsedLabel: '450GB',
        usageTotalLabel: '2TB',
        usagePercentLabel: '22%',
        usageBarPercent: 22,
        usedGb: 450,
        totalGb: 2048,
        isUnlimited: false,
    },
    {
        name: 'aws-s3-bucket',
        label: 'AWS S3 Bucket',
        providerLabel: 'Amazon S3',
        remoteType: 's3',
        remotePath: 's3://production-data-us-east-1',
        usageUsedLabel: '1.2TB',
        usageTotalLabel: 'Unlimited',
        usagePercentLabel: '--',
        usageBarPercent: 40,
        usedGb: 1200,
        totalGb: 5000,
        isUnlimited: true,
    },
    {
        name: 'local-backup',
        label: 'Local Backup',
        providerLabel: 'Local Filesystem',
        remoteType: 'local',
        remotePath: 'local:///mnt/external-disk',
        usageUsedLabel: '890GB',
        usageTotalLabel: '1TB',
        usagePercentLabel: '89%',
        usageBarPercent: 89,
        usedGb: 890,
        totalGb: 1000,
        isUnlimited: false,
    },
] as const satisfies Array<{
    name: string
    label: string
    providerLabel?: string
    remoteType: string
    remotePath: string
    usageUsedLabel: string
    usageTotalLabel: string
    usagePercentLabel: string
    usageBarPercent: number
    usedGb: number
    totalGb: number
    isUnlimited: boolean
}>

const remoteSets = [
    {
        nameSuffix: '',
        labelSuffix: '',
        pathSuffix: '',
    },
    {
        nameSuffix: '-set-b',
        labelSuffix: ' Set B',
        pathSuffix: '-set-b',
    },
    {
        nameSuffix: '-set-c',
        labelSuffix: ' Set C',
        pathSuffix: '-set-c',
    },
] as const

export const remotes = remoteSets.flatMap((set) =>
    baseRemotes.map((remote) => ({
        ...remote,
        name: `${remote.name}${set.nameSuffix}`,
        label: `${remote.label}${set.labelSuffix}`,
        remotePath: `${remote.remotePath}${set.pathSuffix}`,
    }))
) satisfies Array<{
    name: string
    label: string
    providerLabel?: string
    remoteType: string
    remotePath: string
    usageUsedLabel: string
    usageTotalLabel: string
    usagePercentLabel: string
    usageBarPercent: number
    usedGb: number
    totalGb: number
    isUnlimited: boolean
}>

const baseRemoteDirectoryItemsByPath: Record<
    string,
    Record<
        string,
        Array<{
            id: string
            name: string
            kind: 'folder' | 'file'
            fileType?: 'pdf' | 'spreadsheet' | 'image' | 'archive' | 'document' | 'text'
            sizeLabel: string
            modifiedLabel: string
        }>
    >
> = {
    'google-drive': {
        '': [
            {
                id: 'gd-folder-1',
                name: 'Work Documents',
                kind: 'folder',
                sizeLabel: '--',
                modifiedLabel: 'Oct 27, 2023',
            },
            {
                id: 'gd-folder-2',
                name: 'Client Assets',
                kind: 'folder',
                sizeLabel: '--',
                modifiedLabel: 'Oct 26, 2023',
            },
            {
                id: 'gd-file-1',
                name: 'annual_report_2023.pdf',
                kind: 'file',
                fileType: 'pdf',
                sizeLabel: '2.4 MB',
                modifiedLabel: 'Oct 25, 2023',
            },
            {
                id: 'gd-file-2',
                name: 'budget_q4.xlsx',
                kind: 'file',
                fileType: 'spreadsheet',
                sizeLabel: '15 KB',
                modifiedLabel: 'Oct 24, 2023',
            },
            {
                id: 'gd-file-3',
                name: 'site_mockup_v2.png',
                kind: 'file',
                fileType: 'image',
                sizeLabel: '1.2 MB',
                modifiedLabel: 'Oct 23, 2023',
            },
        ],
        'Work Documents': [
            {
                id: 'gd-folder-3',
                name: 'Project Alpha',
                kind: 'folder',
                sizeLabel: '--',
                modifiedLabel: 'Oct 22, 2023',
            },
            {
                id: 'gd-folder-4',
                name: 'Project Beta',
                kind: 'folder',
                sizeLabel: '--',
                modifiedLabel: 'Oct 20, 2023',
            },
            {
                id: 'gd-file-4',
                name: 'meeting_notes.md',
                kind: 'file',
                fileType: 'document',
                sizeLabel: '12 KB',
                modifiedLabel: 'Oct 18, 2023',
            },
        ],
        'Work Documents/Project Alpha': [
            {
                id: 'gd-folder-5',
                name: 'Design Specs',
                kind: 'folder',
                sizeLabel: '--',
                modifiedLabel: 'Oct 17, 2023',
            },
            {
                id: 'gd-file-5',
                name: 'roadmap.txt',
                kind: 'file',
                fileType: 'text',
                sizeLabel: '9 KB',
                modifiedLabel: 'Oct 16, 2023',
            },
            {
                id: 'gd-file-6',
                name: 'milestone_export.zip',
                kind: 'file',
                fileType: 'archive',
                sizeLabel: '41 MB',
                modifiedLabel: 'Oct 15, 2023',
            },
        ],
        'Client Assets': [
            {
                id: 'gd-file-7',
                name: 'brand_kit.pdf',
                kind: 'file',
                fileType: 'pdf',
                sizeLabel: '5.2 MB',
                modifiedLabel: 'Oct 14, 2023',
            },
            {
                id: 'gd-file-8',
                name: 'hero_banner.png',
                kind: 'file',
                fileType: 'image',
                sizeLabel: '3.1 MB',
                modifiedLabel: 'Oct 12, 2023',
            },
        ],
    },
    'dropbox-archive': {
        '': [
            {
                id: 'db-folder-1',
                name: 'Invoices',
                kind: 'folder',
                sizeLabel: '--',
                modifiedLabel: 'Jan 14, 2024',
            },
            {
                id: 'db-folder-2',
                name: 'Legal',
                kind: 'folder',
                sizeLabel: '--',
                modifiedLabel: 'Jan 12, 2024',
            },
            {
                id: 'db-file-1',
                name: 'handover-checklist.pdf',
                kind: 'file',
                fileType: 'pdf',
                sizeLabel: '880 KB',
                modifiedLabel: 'Jan 11, 2024',
            },
            {
                id: 'db-file-2',
                name: 'archive_index.xlsx',
                kind: 'file',
                fileType: 'spreadsheet',
                sizeLabel: '460 KB',
                modifiedLabel: 'Jan 10, 2024',
            },
        ],
        Invoices: [
            {
                id: 'db-file-3',
                name: 'invoice-1002.pdf',
                kind: 'file',
                fileType: 'pdf',
                sizeLabel: '320 KB',
                modifiedLabel: 'Jan 9, 2024',
            },
            {
                id: 'db-file-4',
                name: 'invoice-1003.pdf',
                kind: 'file',
                fileType: 'pdf',
                sizeLabel: '340 KB',
                modifiedLabel: 'Jan 8, 2024',
            },
        ],
        Legal: [
            {
                id: 'db-file-5',
                name: 'nda-template.docx',
                kind: 'file',
                fileType: 'document',
                sizeLabel: '54 KB',
                modifiedLabel: 'Jan 6, 2024',
            },
            {
                id: 'db-file-6',
                name: 'contracts.zip',
                kind: 'file',
                fileType: 'archive',
                sizeLabel: '12 MB',
                modifiedLabel: 'Jan 4, 2024',
            },
        ],
    },
    'aws-s3-bucket': {
        '': [
            {
                id: 's3-folder-1',
                name: 'logs',
                kind: 'folder',
                sizeLabel: '--',
                modifiedLabel: 'Feb 1, 2024',
            },
            {
                id: 's3-folder-2',
                name: 'exports',
                kind: 'folder',
                sizeLabel: '--',
                modifiedLabel: 'Jan 30, 2024',
            },
            {
                id: 's3-file-1',
                name: 'readme.txt',
                kind: 'file',
                fileType: 'text',
                sizeLabel: '2 KB',
                modifiedLabel: 'Jan 28, 2024',
            },
            {
                id: 's3-file-2',
                name: 'analytics_snapshot.png',
                kind: 'file',
                fileType: 'image',
                sizeLabel: '2.1 MB',
                modifiedLabel: 'Jan 25, 2024',
            },
        ],
        logs: [
            {
                id: 's3-file-3',
                name: 'app-2024-01-01.log',
                kind: 'file',
                fileType: 'text',
                sizeLabel: '4 MB',
                modifiedLabel: 'Jan 2, 2024',
            },
            {
                id: 's3-file-4',
                name: 'app-2024-01-02.log',
                kind: 'file',
                fileType: 'text',
                sizeLabel: '3.8 MB',
                modifiedLabel: 'Jan 3, 2024',
            },
        ],
        exports: [
            {
                id: 's3-folder-3',
                name: 'daily',
                kind: 'folder',
                sizeLabel: '--',
                modifiedLabel: 'Jan 24, 2024',
            },
            {
                id: 's3-file-5',
                name: 'warehouse-export.zip',
                kind: 'file',
                fileType: 'archive',
                sizeLabel: '188 MB',
                modifiedLabel: 'Jan 22, 2024',
            },
        ],
        'exports/daily': [
            {
                id: 's3-file-6',
                name: '2024-01-20.csv',
                kind: 'file',
                fileType: 'spreadsheet',
                sizeLabel: '8 MB',
                modifiedLabel: 'Jan 21, 2024',
            },
            {
                id: 's3-file-7',
                name: '2024-01-21.csv',
                kind: 'file',
                fileType: 'spreadsheet',
                sizeLabel: '8.3 MB',
                modifiedLabel: 'Jan 22, 2024',
            },
        ],
    },
    'local-backup': {
        '': [
            {
                id: 'lb-folder-1',
                name: 'Snapshots',
                kind: 'folder',
                sizeLabel: '--',
                modifiedLabel: 'Feb 8, 2024',
            },
            {
                id: 'lb-folder-2',
                name: 'Media',
                kind: 'folder',
                sizeLabel: '--',
                modifiedLabel: 'Feb 5, 2024',
            },
            {
                id: 'lb-file-1',
                name: 'system-report.txt',
                kind: 'file',
                fileType: 'text',
                sizeLabel: '6 KB',
                modifiedLabel: 'Feb 2, 2024',
            },
            {
                id: 'lb-file-2',
                name: 'photos-archive.zip',
                kind: 'file',
                fileType: 'archive',
                sizeLabel: '12 GB',
                modifiedLabel: 'Jan 30, 2024',
            },
        ],
        Snapshots: [
            {
                id: 'lb-file-3',
                name: 'snapshot-2024-01-20.img',
                kind: 'file',
                fileType: 'archive',
                sizeLabel: '84 GB',
                modifiedLabel: 'Jan 20, 2024',
            },
            {
                id: 'lb-file-4',
                name: 'snapshot-2024-02-01.img',
                kind: 'file',
                fileType: 'archive',
                sizeLabel: '90 GB',
                modifiedLabel: 'Feb 1, 2024',
            },
        ],
        Media: [
            {
                id: 'lb-file-5',
                name: 'studio-session.png',
                kind: 'file',
                fileType: 'image',
                sizeLabel: '8 MB',
                modifiedLabel: 'Jan 28, 2024',
            },
            {
                id: 'lb-file-6',
                name: 'demo-reel.mp4',
                kind: 'file',
                fileType: 'archive',
                sizeLabel: '1.4 GB',
                modifiedLabel: 'Jan 22, 2024',
            },
        ],
    },
}

export const remoteDirectoryItemsByPath = Object.fromEntries(
    remoteSets.flatMap((set) =>
        Object.entries(baseRemoteDirectoryItemsByPath).map(([remoteName, directoryItemsByPath]) => [
            `${remoteName}${set.nameSuffix}`,
            directoryItemsByPath,
        ])
    )
) as typeof baseRemoteDirectoryItemsByPath

export function getRemote(remoteName: string) {
    return remotes.find((remote) => remote.name === remoteName)
}

export function normalizePath(pathParam: string | null | undefined) {
    if (!pathParam) {
        return ''
    }

    return pathParam
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .join('/')
}

export function getItemsForPath(remoteName: string, path: string) {
    const normalizedPath = normalizePath(path)

    return remoteDirectoryItemsByPath[remoteName]?.[normalizedPath]
}

export function getPathSegments(path: string) {
    const normalizedPath = normalizePath(path)

    if (!normalizedPath) {
        return []
    }

    return normalizedPath.split('/')
}
