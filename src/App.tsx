import { useQuery } from '@tanstack/react-query'
import { LogOutIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { clearAuthSession, useAuthStore } from '@/lib/store'
import rclone from '@/rclone/client'
import { updateCheckQueryOptions } from '@/rclone/update'

const navItems = [
    { label: 'Dashboard', to: '/', end: true },
    { label: 'Remotes', to: '/remotes' },
    { label: 'Mounts', to: '/mounts' },
    { label: 'Serves', to: '/serves' },
    { label: 'Transfers', to: '/transfers' },
    { label: 'Settings', to: '/settings' },
]

const MESSAGES = [
    { path: '/', message: 'Enable more features in the native UI' },
    { path: '/remotes', message: 'Browse remotes on external servers with the native UI' },
    { path: '/mounts', message: 'Mounts can be started on boot using Rclone UI' },
    {
        path: '/transfers',
        message: 'Schedule tasks using your OS scheduler, or the native UI',
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
        () => MESSAGES.find(({ path }) => location.pathname === path)?.message,
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
                // @ts-expect-error
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
                    <img
                        alt=""
                        className="size-6"
                        src="/icon.svg"
                        onClick={(e) => {
                            const el = e.currentTarget
                            el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
                            el.style.transform = 'rotate(360deg)'
                            setTimeout(() => {
                                el.style.transition = ''
                                el.style.transform = ''
                            }, 500)
                        }}
                    />
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
                    <div className="ml-auto flex items-center gap-2">
                        {latestVersion && (
                            <button
                                type="button"
                                onClick={() => handleRcloneUpdate()}
                                disabled={isUpdating}
                                className="px-3 py-1.5 text-sm text-blue-800 transition-colors hover:bg-muted hover:text-blue-700 disabled:opacity-50"
                            >
                                {isUpdating ? 'Updating…' : 'Update available'}
                            </button>
                        )}
                        {hasAuthCredentials && (
                            <button
                                type="button"
                                onClick={handleExit}
                                aria-label="Log out"
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

                {footerMessage ? (
                    <footer className="mt-auto shrink-0 px-6 py-4 text-center text-sm text-muted-foreground">
                        <a
                            href="https://rcloneui.com/web"
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
