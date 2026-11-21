import { createHashRouter, Navigate, Outlet } from 'react-router-dom'
import { Spinner } from '@/components/ui/spinner'
import { useStore } from '@/lib/store'
import { DashboardPage } from '@/pages/Dashboard'
import { LoginPage } from '@/pages/Login'
import { MountsPage } from '@/pages/Mounts'
import { MountsNewPage } from '@/pages/MountsNew'
import { RemotesPage } from '@/pages/Remotes'
import { RemotesDetailsPage } from '@/pages/RemotesDetails'
import { RemotesEditPage } from '@/pages/RemotesEdit'
import { RemotesNewPage } from '@/pages/RemotesNew'
import { ServesPage } from '@/pages/Serves'
import { ServesNewPage } from '@/pages/ServesNew'
import { SettingsPage } from '@/pages/Settings'
import App from './App'
import { TransfersPage } from './pages/Transfers'

function AuthGate() {
    const url = useStore((state) => state.url)
    const hasHydrated = useStore((state) => state.hasHydrated)

    if (!hasHydrated) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background">
                <Spinner className="size-6" />
            </div>
        )
    }

    if (!url) {
        return <Navigate replace={true} to="/login" />
    }

    return <Outlet />
}

function LoginGate() {
    const hasHydrated = useStore((state) => state.hasHydrated)

    if (!hasHydrated) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background">
                <Spinner className="size-6" />
            </div>
        )
    }

    return <LoginPage />
}

// Moves paths such as /login?url=... into the hash. rclone gui and old bookmarks still open them.
// The folder of the page is the GUI root, because the assets load from relative URLs.
function moveLegacyPathToHash() {
    const { hash, pathname, search } = window.location
    if (hash || pathname.endsWith('/')) {
        return
    }

    const root = new URL('.', window.location.href).pathname
    window.history.replaceState(null, '', `${root}#/${pathname.slice(root.length)}${search}`)
}

moveLegacyPathToHash()

export const router = createHashRouter([
    {
        path: '/login',
        element: <LoginGate />,
    },
    {
        element: <AuthGate />,
        children: [
            {
                path: '/',
                element: <App />,
                children: [
                    { index: true, element: <DashboardPage /> },
                    { path: 'remotes', element: <RemotesPage /> },
                    { path: 'remotes/new', element: <RemotesNewPage /> },
                    { path: 'remotes/:remoteName', element: <RemotesDetailsPage /> },
                    { path: 'local', element: <RemotesDetailsPage /> },
                    { path: 'remotes/:remoteName/edit', element: <RemotesEditPage /> },
                    { path: 'mounts', element: <MountsPage /> },
                    { path: 'mounts/new', element: <MountsNewPage /> },
                    { path: 'serves', element: <ServesPage /> },
                    { path: 'serves/new', element: <ServesNewPage /> },
                    { path: 'transfers', element: <TransfersPage /> },
                    { path: 'settings', element: <SettingsPage /> },
                ],
            },
        ],
    },
])
