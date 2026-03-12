import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { clearPersistedQueryCache } from '@/lib/query'
import { useAuthStore } from '@/lib/store'
import { isAuthFailureError, validateConnection } from '@/rclone/client'
import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export function LoginPage() {
    const location = useLocation()
    const navigate = useNavigate()

    const storedUrl = useAuthStore((state) => state.url)
    const storedUser = useAuthStore((state) => state.user)
    const storedPass = useAuthStore((state) => state.pass)

    const [url, setUrl] = useState(() => useAuthStore.getState().url)
    const [user, setUser] = useState(() => useAuthStore.getState().user)
    const [pass, setPass] = useState(() => useAuthStore.getState().pass)

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
        mutationFn: async ({
            url,
            user,
            pass,
        }: {
            url: string
            user: string
            pass: string
        }) => {
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
        <div className="flex min-h-dvh items-center justify-center bg-background px-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Sign in</CardTitle>
                    <CardDescription>
                        User and password are optional for no-auth setups.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        {!url && (
                            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
                                Rclone RC URL is not configured. Start the GUI launcher again.
                            </div>
                        )}

                        {reasonMessage && !errorMessage && (
                            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
                                {reasonMessage}
                            </div>
                        )}

                        {errorMessage && (
                            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {errorMessage}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm leading-none font-medium" htmlFor="user">
                                User
                            </label>
                            <Input
                                autoComplete="username"
                                disabled={loginMutation.isPending}
                                id="user"
                                name="user"
                                onChange={(event) => {
                                    setUser(event.target.value)
                                    setErrorMessage('')
                                }}
                                value={user}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm leading-none font-medium" htmlFor="pass">
                                Password
                            </label>
                            <Input
                                autoComplete="current-password"
                                disabled={loginMutation.isPending}
                                id="pass"
                                name="pass"
                                onChange={(event) => {
                                    setPass(event.target.value)
                                    setErrorMessage('')
                                }}
                                type="password"
                                value={pass}
                            />
                        </div>

                        <Button
                            className="w-full"
                            disabled={loginMutation.isPending || !url}
                            type="submit"
                        >
                            {loginMutation.isPending ? 'Connecting…' : 'Connect'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
