import { clearAuthSession, useAuthStore } from '@/lib/store'
import rclone from '@/rclone/client'
import { updateCheckQueryOptions } from '@/rclone/update'
import { useQuery } from '@tanstack/react-query'
import { CloudIcon, LogOutIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

const navItems = [
    { label: 'Dashboard', to: '/', end: true },
    { label: 'Remotes', to: '/remotes' },
    { label: 'Mounts', to: '/mounts' },
    { label: 'Serves', to: '/serves' },
    { label: 'Transfers', to: '/transfers' },
    { label: 'Settings', to: '/settings' },
]

const MESSAGES = [
    { path: '/', message: 'Looking for the native UI?' },
    { path: '/remotes', message: 'Browse remotes on external servers with the native UI' },
    { path: '/mounts', message: 'Mounts can be started on boot using Rclone UI' },
    {
        path: '/transfers',
        message: "You can schedule tasks using your operating system's scheduler or the native UI",
    },
] as const

export function App() {
    const location = useLocation()
    const navigate = useNavigate()
    const [isUpdating, setIsUpdating] = useState(false)
    const hasAuthCredentials = useAuthStore((state) => Boolean(state.user && state.pass))

    const updateCheckQuery = useQuery(updateCheckQueryOptions())

    const latestVersion = useMemo(() => updateCheckQuery.data, [updateCheckQuery.data])
    const footerMessage = useMemo(
        () =>
            [...MESSAGES]
                .reverse()
                .find(({ path }) =>
                    path === '/'
                        ? location.pathname === '/'
                        : location.pathname === path || location.pathname.startsWith(`${path}/`)
                )?.message,
        [location.pathname]
    )

    const handleExit = useCallback(() => {
        clearAuthSession()
        navigate('/login', { replace: true })
    }, [navigate])

    const handleRcloneUpdate = useCallback(async () => {
        const shouldUpdate = window.confirm(
            'Are you sure you want to update rclone? This will run rclone selfupdate.'
        )
        if (!shouldUpdate || isUpdating) {
            return
        }

        setIsUpdating(true)

        try {
            await rclone('/core/command', {
                // @ts-ignore
                body: { command: 'selfupdate' },
            })
            toast.success('rclone updated. Restart rclone to use the new version.')
            updateCheckQuery.refetch()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred'
            toast.error(`Could not update rclone: ${message}`)
        } finally {
            setIsUpdating(false)
        }
    }, [isUpdating, updateCheckQuery])

    return (
        <div className="flex h-dvh min-h-screen flex-col overflow-hidden overscroll-none bg-background text-foreground">
            <header className="sticky top-0 z-10 border-b bg-background/95">
                <div className="mx-auto flex items-center gap-4 px-4 py-4 sm:px-6">
                    {hasAuthCredentials && (
                        <button
                            type="button"
                            onClick={handleExit}
                            aria-label="Log out"
                            className="group relative inline-flex size-6 items-center justify-center rounded-sm text-foreground transition-colors hover:text-red-600"
                        >
                            <CloudIcon className="size-6 transition duration-150 group-hover:scale-75 group-hover:opacity-0" />
                            <LogOutIcon className="pointer-events-none absolute size-5 scale-75 text-red-600 opacity-0 transition duration-150 group-hover:scale-100 group-hover:opacity-100" />
                        </button>
                    )}
                    <nav className="flex">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.label}
                                end={item.end}
                                to={item.to}
                                className={({ isActive }) =>
                                    isActive
                                        ? 'px-3 py-1.5 text-sm text-foreground'
                                        : 'px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                    {latestVersion && (
                        <button
                            type="button"
                            onClick={() => handleRcloneUpdate()}
                            disabled={isUpdating}
                            className="ml-auto px-3 py-1.5 text-sm text-primary transition-colors hover:bg-muted hover:text-primary/80 disabled:opacity-50"
                        >
                            {isUpdating ? 'Updating…' : 'Update available'}
                        </button>
                    )}
                </div>
            </header>

            <main className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-none">
                <Outlet />

                {footerMessage ? (
                    <footer className="mt-auto shrink-0 px-6 py-4 text-center text-xs text-muted-foreground">
                        <a
                            href="https://rcloneui.com/github"
                            target="_blank"
                            rel="noreferrer"
                            className="transition-colors hover:text-foreground"
                        >
                            {footerMessage}
                        </a>
                    </footer>
                ) : null}
            </main>
        </div>
    )
}

export default App
