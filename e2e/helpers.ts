import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface TestEnv {
    rcUrl: string
    rcUser: string
    rcPass: string
    appUrl: string
}

let cachedEnv: TestEnv | null = null

function parseTestEnv(raw: unknown): TestEnv {
    if (raw === null || typeof raw !== 'object') {
        throw new Error('Invalid test env: expected an object')
    }

    const obj = raw as Record<string, unknown>

    for (const key of ['rcUrl', 'rcUser', 'rcPass', 'appUrl'] as const) {
        if (typeof obj[key] !== 'string' || obj[key] === '') {
            throw new Error(`Invalid test env: missing or empty "${key}"`)
        }
    }

    return obj as unknown as TestEnv
}

export function getTestEnv(): TestEnv {
    if (!cachedEnv) {
        const stateFile = join(process.cwd(), 'e2e', 'test-env.json')
        cachedEnv = parseTestEnv(JSON.parse(readFileSync(stateFile, 'utf-8')))
    }
    return cachedEnv
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
