export const STATIC_RC_URL: string | null = (() => {
    let url = import.meta.env.VITE_RC_URL
    if (!url) {
        return null
    }

    url = url.trim().replace(/\/+$/, '')
    return new URL(url, window.location.href).toString()
})()

export function effectiveRcUrl(url: string): string {
    return STATIC_RC_URL ?? url.trim().replace(/\/+$/, '')
}
