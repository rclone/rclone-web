import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Eye, EyeOff, KeyRound, Loader2, LogIn, User } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { clearPersistedQueryCache } from '@/lib/query'
import { useAuthStore } from '@/lib/store'
import { isAuthFailureError, validateConnection } from '@/rclone/client'

export function LoginPage() {
    const location = useLocation()
    const navigate = useNavigate()

    const storedUrl = useAuthStore((state) => state.url)
    const storedUser = useAuthStore((state) => state.user)
    const storedPass = useAuthStore((state) => state.pass)

    const [url, setUrl] = useState(() => useAuthStore.getState().url)
    const [user, setUser] = useState(() => useAuthStore.getState().user)
    const [pass, setPass] = useState(() => useAuthStore.getState().pass)

    const [showPass, setShowPass] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const lastAutoSubmitKeyRef = useRef<string | null>(null)

    const loginSearchState = useMemo(() => {
        const searchParams = new URLSearchParams(location.search)

        return {
            url: searchParams.get('url') ?? '',
            user: searchParams.get('user') ?? '',
            pass: searchParams.get('pass') ?? '',
            reason: searchParams.get('reason'),
            hasConnectionParams:
                searchParams.has('url') || searchParams.has('user') || searchParams.has('pass'),
        }
    }, [location.search])

    const loginMutation = useMutation({
        mutationFn: async ({ url, user, pass }: { url: string; user: string; pass: string }) => {
            return validateConnection({ url, user, pass })
        },
        onMutate: () => {
            setErrorMessage('')
        },
        onSuccess: (authFields) => {
            clearPersistedQueryCache()
            useAuthStore.setState(authFields)
            navigate('/', { replace: true })
        },
        onError: (error, variables) => {
            if (isAuthFailureError(error)) {
                setErrorMessage(
                    variables.user.trim()
                        ? 'Invalid rclone RC credentials.'
                        : 'This rclone RC requires credentials.'
                )
                return
            }

            setErrorMessage(
                error instanceof Error ? error.message : 'Could not connect to rclone RC.'
            )
        },
    })

    useEffect(() => {
        if (loginSearchState.hasConnectionParams) {
            return
        }

        setUrl(storedUrl)
        setUser(storedUser)
        setPass(storedPass)
    }, [loginSearchState.hasConnectionParams, storedPass, storedUrl, storedUser])

    useEffect(() => {
        if (!loginSearchState.hasConnectionParams) {
            return
        }

        setUrl(loginSearchState.url)
        setUser(loginSearchState.user)
        setPass(loginSearchState.pass)
        setErrorMessage('')

        const searchParams = new URLSearchParams(location.search)
        searchParams.delete('url')
        searchParams.delete('user')
        searchParams.delete('pass')

        const search = searchParams.toString()
        navigate(
            {
                pathname: location.pathname,
                search: search ? `?${search}` : '',
            },
            { replace: true }
        )

        if (!loginSearchState.url) {
            return
        }

        const autoSubmitKey = JSON.stringify({
            url: loginSearchState.url,
            user: loginSearchState.user,
            pass: loginSearchState.pass,
        })

        if (lastAutoSubmitKeyRef.current === autoSubmitKey) {
            return
        }

        lastAutoSubmitKeyRef.current = autoSubmitKey
        loginMutation.mutate({
            url: loginSearchState.url,
            user: loginSearchState.user,
            pass: loginSearchState.pass,
        })
    }, [location.pathname, location.search, loginMutation, loginSearchState, navigate])

    useEffect(() => {
        if (loginSearchState.hasConnectionParams || !storedUrl || storedUser || storedPass) {
            return
        }

        const autoSubmitKey = JSON.stringify({
            url: storedUrl,
            user: storedUser,
            pass: storedPass,
        })

        if (lastAutoSubmitKeyRef.current === autoSubmitKey) {
            return
        }

        lastAutoSubmitKeyRef.current = autoSubmitKey
        loginMutation.mutate({
            url: storedUrl,
            user: storedUser,
            pass: storedPass,
        })
    }, [loginMutation, loginSearchState.hasConnectionParams, storedPass, storedUrl, storedUser])

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        loginMutation.mutate({ url, user, pass })
    }

    const reasonMessage = useMemo(() => {
        return loginSearchState.reason === 'auth'
            ? 'Your saved rclone RC session is no longer valid. Enter the connection details again.'
            : ''
    }, [loginSearchState.reason])

    return (
        <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
            {/* Animated background blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 animate-[blob-drift-3_15s_ease-in-out_infinite] rounded-full bg-chart-3/10 blur-3xl" />
            </div>

            {/* DVD bounce */}
            <div className="pointer-events-none absolute inset-0 animate-[dvd-x_13s_linear_infinite]">
                <div className="animate-[dvd-y_9s_linear_infinite]">
                    <img alt="" className="h-14 w-auto" src="/icon.svg" />
                </div>
            </div>

            <div className="relative w-full max-w-sm animate-[fadeInUp_0.5s_ease-out]">
                <Card className="border-0 bg-card/80 shadow-2xl shadow-primary/5 ring-1 ring-foreground/8 backdrop-blur-xl">
                    <CardHeader className="items-center pb-0">
                        <div className="text-center">
                            <h1 className="text-lg font-semibold tracking-tight">
                                Connect to rclone
                            </h1>
                            <p className="mt-1 text-xs text-muted-foreground">
                                User and password are optional for no-auth setups.
                            </p>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            {!url && (
                                <div className="flex items-start gap-2 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>
                                        URL is not configured. Start the GUI launcher again.
                                    </span>
                                </div>
                            )}

                            {reasonMessage && !errorMessage && (
                                <div className="flex items-start gap-2 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{reasonMessage}</span>
                                </div>
                            )}

                            {errorMessage && (
                                <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{errorMessage}</span>
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <label className="text-sm leading-none font-medium" htmlFor="user">
                                    User
                                </label>
                                <div className="relative">
                                    <User className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        autoComplete="username"
                                        className="pl-9"
                                        disabled={loginMutation.isPending}
                                        id="user"
                                        name="user"
                                        placeholder="admin"
                                        onChange={(event) => {
                                            setUser(event.target.value)
                                            setErrorMessage('')
                                        }}
                                        value={user}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm leading-none font-medium" htmlFor="pass">
                                    Password
                                </label>
                                <div className="relative">
                                    <KeyRound className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        autoComplete="current-password"
                                        className="pl-9 pr-9"
                                        disabled={loginMutation.isPending}
                                        id="pass"
                                        name="pass"
                                        placeholder="••••••••"
                                        onChange={(event) => {
                                            setPass(event.target.value)
                                            setErrorMessage('')
                                        }}
                                        type={showPass ? 'text' : 'password'}
                                        value={pass}
                                    />
                                    <button
                                        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowPass((v) => !v)}
                                        tabIndex={-1}
                                        type="button"
                                    >
                                        {showPass ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <Button
                                className="w-full gap-2 bg-primary font-medium shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:brightness-110 active:scale-[0.98]"
                                disabled={loginMutation.isPending || !url}
                                type="submit"
                            >
                                {loginMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="h-4 w-4" />
                                        Connect
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
