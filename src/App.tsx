import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, LogOutIcon } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { LANGUAGES, type Language, type TranslationKey, useT } from '@/lib/i18n'
import { clearAuthSession, useStore } from '@/lib/store'
import { cn } from '@/lib/ui'
import rclone from '@/rclone/client'
import { updateCheckQueryOptions } from '@/rclone/update'

const navItems: { key: TranslationKey; to: string; end?: boolean }[] = [
    { key: 'nav.dashboard', to: '/', end: true },
    { key: 'nav.remotes', to: '/remotes' },
    { key: 'nav.mounts', to: '/mounts' },
    { key: 'nav.serves', to: '/serves' },
    { key: 'nav.transfers', to: '/transfers' },
    { key: 'nav.settings', to: '/settings' },
]

const MESSAGES: readonly { path: string; key: TranslationKey }[] = [
    { path: '/', key: 'app.footerDashboard' },
    { path: '/remotes', key: 'app.footerRemotes' },
    { path: '/mounts', key: 'app.footerMounts' },
    { path: '/transfers', key: 'app.footerTransfers' },
    { path: '/serves', key: 'app.footerServes' },
]

export function App() {
    const t = useT()
    const location = useLocation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const hasAuthCredentials = useStore((state) => Boolean(state.user && state.pass))

    const updateCheckQuery = useQuery(updateCheckQueryOptions())

    const latestVersion = useMemo(() => updateCheckQuery.data, [updateCheckQuery.data])
    const footerMessageKey = useMemo(
        () => MESSAGES.find(({ path }) => location.pathname === path)?.key,
        [location.pathname]
    )

    const handleExit = useCallback(() => {
        clearAuthSession()
        navigate('/login', { replace: true })
    }, [navigate])

    const updateMutation = useMutation({
        mutationFn: async () => {
            await rclone('/core/command', {
                body: { command: 'selfupdate' },
            })
        },
        onSuccess: () => {
            toast.success(t('app.updateSuccess'))
            queryClient.setQueryData(['core', 'updateCheck'], null)
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['core', 'version'] })
            }, 5000)
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : t('common.unknownError')
            toast.error(t('app.updateError', { message }))
        },
    })

    const handleRcloneUpdate = useCallback(() => {
        const shouldUpdate = window.confirm(t('app.updateConfirm'))
        if (!shouldUpdate) return
        updateMutation.mutate()
    }, [updateMutation])

    const longPressTimerRef = useRef<number | null>(null)
    const longPressFiredRef = useRef(false)
    const [isLanguageDialogOpen, setIsLanguageDialogOpen] = useState(false)
    const currentLanguage = useStore((state) => state.language)

    const startLongPress = useCallback(() => {
        longPressFiredRef.current = false
        longPressTimerRef.current = window.setTimeout(() => {
            longPressFiredRef.current = true
            const el = document.querySelector<HTMLImageElement>('header img[src="/icon.svg"]')
            if (el) {
                el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
                el.style.transform = 'rotate(360deg)'
                setTimeout(() => {
                    el.style.transition = ''
                    el.style.transform = ''
                }, 500)
            }
        }, 500)
    }, [])

    const cancelLongPress = useCallback(() => {
        if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
        }
    }, [])

    const selectLanguage = useCallback(
        (language: Language | undefined) => {
            useStore.setState({ language })
            setIsLanguageDialogOpen(false)
            queryClient.invalidateQueries()
        },
        [queryClient]
    )

    return (
        <div className="flex h-dvh min-h-screen flex-col overflow-hidden overscroll-none bg-background text-foreground">
            <header className="sticky top-0 z-10 border-b bg-background/95">
                <div className="mx-auto flex items-center gap-4 px-4 py-4 sm:px-6">
                    <img
                        alt=""
                        className="size-6 select-none"
                        src="/icon.svg"
                        draggable={false}
                        onPointerDown={startLongPress}
                        onPointerUp={cancelLongPress}
                        onPointerLeave={cancelLongPress}
                        onPointerCancel={cancelLongPress}
                        onContextMenu={(e) => {
                            e.preventDefault()
                            const el = e.currentTarget
                            el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
                            el.style.transform = 'rotate(360deg)'
                            setTimeout(() => {
                                el.style.transition = ''
                                el.style.transform = ''
                            }, 500)
                        }}
                        onClick={() => {
                            if (longPressFiredRef.current) return
                            setIsLanguageDialogOpen(true)
                        }}
                    />
                    <nav className="flex">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                end={item.end}
                                to={item.to}
                                className={({ isActive }) =>
                                    isActive
                                        ? 'px-3 py-1.5 text-sm text-foreground'
                                        : 'px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                                }
                            >
                                {t(item.key)}
                            </NavLink>
                        ))}
                    </nav>
                    <div className="ml-auto flex items-center gap-2">
                        {latestVersion && (
                            <button
                                type="button"
                                onClick={() => handleRcloneUpdate()}
                                disabled={updateMutation.isPending}
                                className="px-3 py-1.5 text-sm text-blue-800 transition-colors hover:bg-muted hover:text-blue-700 disabled:opacity-50"
                            >
                                {updateMutation.isPending
                                    ? t('app.updating')
                                    : t('app.updateAvailable')}
                            </button>
                        )}
                        {hasAuthCredentials && (
                            <button
                                type="button"
                                onClick={handleExit}
                                aria-label={t('app.logOut')}
                                className="inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-red-600"
                            >
                                <LogOutIcon className="size-4" />
                                {/* Log out */}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-none">
                <Outlet />

                {footerMessageKey ? (
                    <footer className="mt-auto shrink-0 px-6 py-4 text-center text-sm text-muted-foreground">
                        <a
                            href="https://rcloneui.com/web"
                            target="_blank"
                            rel="noreferrer"
                            className="transition-colors hover:text-foreground"
                        >
                            {t(footerMessageKey)}
                        </a>
                    </footer>
                ) : null}
            </main>

            <Dialog open={isLanguageDialogOpen} onOpenChange={setIsLanguageDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('app.translateTitle')}</DialogTitle>
                        <DialogDescription>{t('app.translateDescription')}</DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-1">
                        <LanguageOption
                            emoji="🌐"
                            label={t('app.defaultLanguage')}
                            isActive={!currentLanguage}
                            onSelect={() => selectLanguage(undefined)}
                        />
                        {LANGUAGES.map((language) => (
                            <LanguageOption
                                key={language.code}
                                emoji={language.emoji}
                                label={language.label}
                                isActive={currentLanguage === language.code}
                                onSelect={() => selectLanguage(language.code)}
                            />
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function LanguageOption({
    emoji,
    label,
    isActive,
    onSelect,
}: {
    emoji: string
    label: string
    isActive: boolean
    onSelect: () => void
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                isActive && 'bg-muted'
            )}
        >
            <span className="text-lg leading-none">{emoji}</span>
            <span className="flex-1">{label}</span>
            {isActive ? <CheckIcon className="size-4 text-muted-foreground" /> : null}
        </button>
    )
}

export default App
