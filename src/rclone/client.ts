import type { paths } from 'rclone-openapi'
import createRCDClient, {
    type OpenApiClientPathsWithMethod,
    type OpenApiMaybeOptionalInit,
    type OpenApiMethodResponse,
    type OpenApiRequiredKeysOf,
    type RCDClient,
} from 'rclone-sdk'
import { clearAuthSession, useAuthStore } from '@/lib/store'

type InitParam<Init> =
    OpenApiRequiredKeysOf<Init> extends never
        ? [(Init & { [key: string]: unknown })?]
        : [Init & { [key: string]: unknown }]

let isRedirectingToLogin = false

class RcloneError extends Error {
    readonly isAuthFailure: boolean
    readonly status?: number

    constructor(message: string, status?: number) {
        super(message)
        this.isAuthFailure = status === 401 || status === 403
        this.status = status
    }
}

function throwRcloneError(message: string, status?: number, redirectOnAuthFailure = false): never {
    const error = new RcloneError(message, status)

    if (redirectOnAuthFailure && error.isAuthFailure) {
        redirectToLogin()
    }

    throw error
}

function redirectToLogin() {
    if (isRedirectingToLogin) {
        return
    }

    isRedirectingToLogin = true
    clearAuthSession()

    if (window.location.pathname === '/login') {
        const searchParams = new URLSearchParams(window.location.search)
        searchParams.set('reason', 'auth')
        const search = searchParams.toString()
        window.history.replaceState(
            window.history.state,
            '',
            search ? `${window.location.pathname}?${search}` : window.location.pathname
        )
        return
    }

    window.location.replace('/login?reason=auth')
}

function resolveAuth({ url, user, pass }: { url: string; user: string; pass: string }) {
    const normalizedUrl = url.trim().replace(/\/+$/, '')
    const normalizedUser = user.trim()

    if (!normalizedUrl) {
        throwRcloneError('Rclone RC URL is required.')
    }

    if (Boolean(normalizedUser) !== Boolean(pass)) {
        throwRcloneError('User and password must both be provided.')
    }

    return { url: normalizedUrl, user: normalizedUser, pass }
}

function createClient({ url, user, pass }: { url: string; user: string; pass: string }) {
    return createRCDClient({
        baseUrl: url,
        headers: user && pass ? { Authorization: `Basic ${btoa(`${user}:${pass}`)}` } : undefined,
    })
}

function stringifyError(error: unknown): string {
    if (typeof error === 'string') {
        return error
    }

    try {
        return JSON.stringify(error)
    } catch {
        return 'Unknown error occurred'
    }
}

function checkResult(
    result: { error?: unknown; data?: unknown; response: Response },
    redirectOnAuthFailure = false
) {
    if (result.error) {
        throwRcloneError(
            stringifyError(result.error),
            result.response.status,
            redirectOnAuthFailure
        )
    }

    const data = result.data as { error?: unknown } | undefined
    if (data?.error) {
        throwRcloneError(stringifyError(data.error), result.response.status, redirectOnAuthFailure)
    }

    if (!result.response.ok) {
        throwRcloneError(
            `${result.response.status} ${result.response.statusText}`,
            result.response.status,
            redirectOnAuthFailure
        )
    }
}

export function isAuthFailureError(error: unknown): error is RcloneError & { isAuthFailure: true } {
    return error instanceof RcloneError && error.isAuthFailure
}

export async function validateConnection({
    url,
    user,
    pass,
}: {
    url: string
    user: string
    pass: string
}) {
    const auth = resolveAuth({ url, user, pass })

    try {
        const result = await createClient(auth).POST('/rc/noopauth')
        checkResult(result)
        isRedirectingToLogin = false
        return auth
    } catch (error) {
        if (error instanceof RcloneError) throw error
        throw new RcloneError(error instanceof Error ? error.message : 'Request failed')
    }
}

export async function rcloneUploadFile({
    fs,
    remote,
    filename,
    contents,
}: {
    fs: string
    remote: string
    filename: string
    contents: string
}) {
    const auth = resolveAuth(useAuthStore.getState())

    if (!auth.url) {
        throwRcloneError('No rclone RC connection configured.')
    }

    const url = new URL(auth.url.replace(/^\//, ''), '/operations/uploadfile')
    url.searchParams.set('fs', fs)
    url.searchParams.set('remote', remote)

    const formData = new FormData()
    formData.append('file', new Blob([contents], { type: 'text/plain' }), filename)

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers:
                auth.user && auth.pass
                    ? { Authorization: `Basic ${btoa(`${auth.user}:${auth.pass}`)}` }
                    : undefined,
            body: formData,
        })

        if (!response.ok) {
            const text = await response.text()

            if (text) {
                try {
                    const data = JSON.parse(text) as { error?: unknown }
                    if (data?.error) {
                        throwRcloneError(stringifyError(data.error), response.status, true)
                    }
                } catch {}

                throwRcloneError(text, response.status, true)
            }

            throwRcloneError(`${response.status} ${response.statusText}`, response.status, true)
        }

        const contentType = response.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
            const text = await response.text()

            if (text) {
                try {
                    const data = JSON.parse(text) as { error?: unknown } | null
                    if (data?.error) {
                        throwRcloneError(stringifyError(data.error), response.status, true)
                    }
                } catch {}
            }
        }
    } catch (error) {
        if (error instanceof RcloneError) throw error
        throw new RcloneError(error instanceof Error ? error.message : 'Request failed')
    }
}

export default async function rclone<
    Path extends OpenApiClientPathsWithMethod<RCDClient, 'post'>,
    Init extends OpenApiMaybeOptionalInit<paths[Path], 'post'> = OpenApiMaybeOptionalInit<
        paths[Path],
        'post'
    >,
>(
    path: Path,
    ...init: InitParam<Init>
): Promise<OpenApiMethodResponse<RCDClient, 'post', Path, Init>> {
    const auth = resolveAuth(useAuthStore.getState())

    if (!auth.url) {
        throwRcloneError('No rclone RC connection configured.')
    }

    try {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const result = await createClient(auth).POST(
            path,
            ...(init as InitParam<OpenApiMaybeOptionalInit<paths[Path], 'post'>>)
        )

        checkResult(result, true)

        return result.data as OpenApiMethodResponse<RCDClient, 'post', Path, Init>
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        if (error instanceof RcloneError) throw error
        throw new RcloneError(error instanceof Error ? error.message : 'Request failed')
    }
}
