export function formatDuration(seconds: number) {
    if (seconds < 1) return '<1s'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
}

export function formatTime(iso: string) {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString()
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${Math.round(bytes)} B`
    const kb = bytes / 1024
    if (kb < 1024) return `${Math.round(kb)} KB`
    const mb = kb / 1024
    if (mb < 1024) return `${mb.toFixed(1)} MB`
    const gb = mb / 1024
    if (gb < 1024) return `${gb.toFixed(1)} GB`
    const tb = gb / 1024
    return `${tb.toFixed(1)} TB`
}
