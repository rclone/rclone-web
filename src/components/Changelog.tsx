import { useQuery } from '@tanstack/react-query'
import { ArrowUpRightIcon, InfoIcon } from 'lucide-react'
import { Fragment, type ReactNode, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/ui'
import rclone from '@/rclone/client'

const CHANGELOG_SOURCE_URL =
    'https://raw.githubusercontent.com/rclone/rclone/refs/heads/master/docs/content/changelog.md'
const CHANGELOG_URL = 'https://rclone.org/changelog/'

type ChangelogListItem = {
    text: string
    children: ChangelogListItem[]
}

type ChangelogBlock =
    | { type: 'heading'; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'list'; items: ChangelogListItem[] }

function extractChangelogSection(markdown: string, version: string) {
    const normalizedVersion = version.trim()
    if (!normalizedVersion) {
        return null
    }

    const escapedVersion = normalizedVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const startMatch = new RegExp(`^##\\s+${escapedVersion}\\b.*$`, 'm').exec(markdown)

    if (!startMatch || startMatch.index === undefined) {
        return null
    }

    const startIndex = startMatch.index
    const remaining = markdown.slice(startIndex + startMatch[0].length)
    const nextMatch = /\n##\s+v[^\n]+/m.exec(remaining)
    const endIndex =
        nextMatch && nextMatch.index !== undefined
            ? startIndex + startMatch[0].length + nextMatch.index
            : markdown.length

    return markdown.slice(startIndex, endIndex).trim()
}

function parseChangelogSection(section: string) {
    const lines = section.split('\n')
    const blocks: ChangelogBlock[] = []

    for (let index = 0; index < lines.length; ) {
        const line = lines[index].trimEnd()
        const trimmed = line.trim()

        if (!trimmed) {
            index += 1
            continue
        }

        if (trimmed.startsWith('## ')) {
            blocks.push({ type: 'heading', text: trimmed.slice(3).trim() })
            index += 1
            continue
        }

        if (isListItem(lines[index])) {
            const parsed = parseList(lines, index, getListIndent(lines[index]))
            blocks.push({ type: 'list', items: parsed.items })
            index = parsed.nextIndex
            continue
        }

        const paragraphLines = [trimmed]
        index += 1

        while (index < lines.length) {
            const nextTrimmed = lines[index].trim()
            if (!nextTrimmed || nextTrimmed.startsWith('## ') || isListItem(lines[index])) {
                break
            }

            paragraphLines.push(nextTrimmed)
            index += 1
        }

        blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') })
    }

    return blocks
}

function parseInlineMarkdown(text: string) {
    const tokens: Array<
        | { type: 'text'; text: string }
        | { type: 'code'; text: string }
        | { type: 'link'; text: string; href: string }
    > = []
    const pattern = /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g
    let lastIndex = 0

    for (const match of text.matchAll(pattern)) {
        const matchIndex = match.index ?? 0
        if (matchIndex > lastIndex) {
            tokens.push({
                type: 'text',
                text: text.slice(lastIndex, matchIndex),
            })
        }

        if (match[1]) {
            tokens.push({ type: 'code', text: match[1] })
        } else if (match[2] && match[3]) {
            tokens.push({
                type: 'link',
                text: match[2],
                href: resolveMarkdownLinkHref(match[3]),
            })
        }

        lastIndex = matchIndex + match[0].length
    }

    if (lastIndex < text.length) {
        tokens.push({
            type: 'text',
            text: text.slice(lastIndex),
        })
    }

    return tokens
}

function parseList(lines: string[], startIndex: number, indent: number) {
    const items: ChangelogListItem[] = []
    let index = startIndex

    while (index < lines.length) {
        const line = lines[index]
        if (!line.trim()) {
            index += 1
            continue
        }

        if (!isListItem(line)) {
            break
        }

        const currentIndent = getListIndent(line)
        if (currentIndent < indent) {
            break
        }

        if (currentIndent > indent) {
            if (items.length === 0) {
                break
            }

            const nested = parseList(lines, index, currentIndent)
            items[items.length - 1].children = nested.items
            index = nested.nextIndex
            continue
        }

        items.push({
            text: line.trim().replace(/^[-*]\s+/, ''),
            children: [],
        })
        index += 1
    }

    return { items, nextIndex: index }
}

function isListItem(line: string) {
    return /^(\s*)[-*]\s+/.test(line)
}

function getListIndent(line: string) {
    return line.match(/^(\s*)/)?.[1].length ?? 0
}

function resolveMarkdownLinkHref(href: string) {
    if (href.startsWith('/')) {
        return `https://rclone.org${href}`
    }

    return href
}

function renderInlineText(text: string) {
    return parseInlineMarkdown(text).map((token, index) => {
        if (token.type === 'code') {
            return (
                <code
                    key={`${token.type}-${index}-${token.text}`}
                    className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
                >
                    {token.text}
                </code>
            )
        }

        if (token.type === 'link') {
            return (
                <a
                    key={`${token.type}-${index}-${token.href}`}
                    href={token.href}
                    target="_blank"
                    rel="noreferrer"
                    className="underline transition-colors underline-offset-4 hover:text-foreground"
                >
                    {token.text}
                </a>
            )
        }

        return <Fragment key={`${token.type}-${index}-${token.text}`}>{token.text}</Fragment>
    })
}

function renderListItems(items: ChangelogListItem[], depth = 0): ReactNode {
    return (
        <ul className={cn('space-y-2', depth > 0 && 'mt-2 pl-5')}>
            {items.map((item, index) => (
                <li key={`${depth}-${index}-${item.text}`} className="space-y-2">
                    <div className="flex items-start gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/70" />
                        <span className="min-w-0">{renderInlineText(item.text)}</span>
                    </div>
                    {item.children.length > 0 ? renderListItems(item.children, depth + 1) : null}
                </li>
            ))}
        </ul>
    )
}

function renderChangelogBlock(block: ChangelogBlock, index: number) {
    if (block.type === 'heading') {
        const [version, releaseDate] = block.text.split(/\s+-\s+/, 2)

        return (
            <div key={`${block.type}-${index}`} className="space-y-1">
                <h3 className="text-xl font-semibold tracking-tight">{version}</h3>
                {releaseDate ? (
                    <p className="text-sm text-muted-foreground">{releaseDate}</p>
                ) : null}
            </div>
        )
    }

    if (block.type === 'paragraph') {
        return (
            <p key={`${block.type}-${index}`} className="text-sm leading-6 text-muted-foreground">
                {renderInlineText(block.text)}
            </p>
        )
    }

    return (
        <div key={`${block.type}-${index}`} className="text-sm leading-6 text-muted-foreground">
            {renderListItems(block.items)}
        </div>
    )
}

export function Changelog() {
    const versionQuery = useQuery({
        queryKey: ['dashboard', 'core', 'version'],
        queryFn: async () => await rclone('/core/version'),
        staleTime: 1000 * 60 * 5,
    })

    const installedVersion = versionQuery.data?.version ?? ''

    const changelogQuery = useQuery({
        queryKey: ['dashboard', 'changelog', installedVersion],
        enabled: Boolean(installedVersion),
        staleTime: 1000 * 60 * 60 * 24,
        gcTime: 1000 * 60 * 60 * 24 * 7,
        queryFn: async () => {
            const response = await fetch(CHANGELOG_SOURCE_URL)

            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`)
            }

            const markdown = await response.text()
            return extractChangelogSection(markdown, installedVersion)
        },
    })

    const changelogBlocks = useMemo(
        () => (changelogQuery.data ? parseChangelogSection(changelogQuery.data) : []),
        [changelogQuery.data]
    )

    return (
        <section>
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                            <CardTitle>Changelog</CardTitle>
                            <CardDescription>
                                Release notes for the installed rclone version.
                            </CardDescription>
                        </div>

                        <a
                            href={CHANGELOG_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm transition-colors text-primary hover:text-primary/80"
                        >
                            View full changelog
                            <ArrowUpRightIcon className="size-4" />
                        </a>
                    </div>
                </CardHeader>

                <CardContent>
                    {versionQuery.isPending && !installedVersion ? (
                        <div className="flex items-center justify-center py-12">
                            <Spinner className="size-7" />
                        </div>
                    ) : changelogQuery.isPending ? (
                        <div className="flex items-center justify-center py-12">
                            <Spinner className="size-7" />
                        </div>
                    ) : changelogQuery.isError || !changelogQuery.data ? (
                        <Empty className="border min-h-56 rounded-xl">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <InfoIcon />
                                </EmptyMedia>
                                <EmptyTitle>No changelog found for this version</EmptyTitle>
                                <EmptyDescription>
                                    {changelogQuery.isError
                                        ? 'The upstream changelog could not be loaded right now.'
                                        : installedVersion
                                          ? `The upstream changelog could not be matched to ${installedVersion}.`
                                          : 'Version information is unavailable right now.'}
                                </EmptyDescription>
                            </EmptyHeader>

                            <EmptyContent>
                                <a
                                    href={CHANGELOG_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-sm transition-colors text-primary hover:text-primary/80"
                                >
                                    Open online changelog
                                    <ArrowUpRightIcon className="size-4" />
                                </a>
                            </EmptyContent>
                        </Empty>
                    ) : (
                        <div className="max-h-[40rem] space-y-4 overflow-y-auto pr-1">
                            {changelogBlocks.map((block, index) =>
                                renderChangelogBlock(block, index)
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </section>
    )
}
