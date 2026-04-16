export function getTestEnv() {
    return {
        rcUrl: 'http://localhost:5573',
        rcUser: 'test',
        rcPass: 'test',
        appUrl: 'http://localhost:5572',
    }
}

export function loginUrl(): string {
    const env = getTestEnv()
    const params = new URLSearchParams({
        url: env.rcUrl,
        user: env.rcUser,
        pass: env.rcPass,
    })
    return `${env.appUrl}/login?${params}`
}

export async function rcloneRC(path: string, body: Record<string, unknown> = {}): Promise<unknown> {
    const env = getTestEnv()
    const response = await fetch(`${env.rcUrl}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${btoa(`${env.rcUser}:${env.rcPass}`)}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        throw new Error(`rclone RC ${path} failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
}
