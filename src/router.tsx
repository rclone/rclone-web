import { useCallback, useEffect, useState } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useT } from '@/lib/i18n'
import { clearPersistedQueryCache } from '@/lib/query'
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
import { isAuthFailureError, validateConnection } from '@/rclone/client'
import App from './App'
import { TransfersPage } from './pages/Transfers'

type ConnectionProbeState = 'checking' | 'ok' | 'credentials' | 'unreachable'

function useConnectionProbe(enabled: boolean) {
    const authenticated = useStore((state) => state.authenticated)

    const [state, setState] = useState<ConnectionProbeState>('checking')

    const run = useCallback(async () => {
        setState('checking')
        try {
            await validateConnection(useStore.getState())
            useStore.setState({ authenticated: true })
            setState('ok')
        } catch (error) {
            setState(isAuthFailureError(error) ? 'credentials' : 'unreachable')
        }
    }, [])

    useEffect(() => {
        if (!enabled) {
            return
        }

        if (authenticated) {
            setState('ok')
            return
        }

        void run()
    }, [authenticated, run, enabled])

    return { state, retry: run }
}

function AuthGate() {
    const t = useT()
    const url = useStore((state) => state.url)
    const user = useStore((state) => state.user)
    const hasHydrated = useStore((state) => state.hasHydrated)
    const { state, retry } = useConnectionProbe(hasHydrated && Boolean(url))

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

    if (state === 'checking') {
        ;<div className="flex min-h-dvh items-center justify-center bg-background">
            <Spinner className="size-6" />
        </div>
    }

    if (state === 'credentials') {
        if (user) {
            clearPersistedQueryCache()
            useStore.setState({ user: '', pass: '', authenticated: false })
            return <Navigate replace={true} to="/login?reason=auth" />
        } else {
            return <Navigate replace={true} to="/login" />
        }
    }

    if (state === 'unreachable') {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
                <p className="max-w-sm text-sm text-muted-foreground">{t('login.unreachable')}</p>
                <Button onClick={retry} type="button">
                    {t('login.retry')}
                </Button>
            </div>
        )
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
