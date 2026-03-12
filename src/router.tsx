import { Spinner } from '@/components/ui/spinner'
import { useAuthStore } from '@/lib/store'
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
import { JobsOldPage } from '@/pages/jobs-old-page'
import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom'
import App from './App'
import { TransfersPage } from './pages/Transfers'

function AuthGate() {
    const url = useAuthStore((state) => state.url)
    const hasHydrated = useAuthStore((state) => state.hasHydrated)

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
    const hasHydrated = useAuthStore((state) => state.hasHydrated)

    if (!hasHydrated) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background">
                <Spinner className="size-6" />
            </div>
        )
    }

    return <LoginPage />
}

export const router = createBrowserRouter([
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
                    { path: 'remotes/:remoteName/edit', element: <RemotesEditPage /> },
                    { path: 'mounts', element: <MountsPage /> },
                    { path: 'mounts/new', element: <MountsNewPage /> },
                    { path: 'serves', element: <ServesPage /> },
                    { path: 'serves/new', element: <ServesNewPage /> },
                    { path: 'transfers', element: <TransfersPage /> },
                    { path: 'jobs-old', element: <JobsOldPage /> },
                    { path: 'settings', element: <SettingsPage /> },
                ],
            },
        ],
    },
])
