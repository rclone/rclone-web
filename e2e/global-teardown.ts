import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const stateFile = join(process.cwd(), 'e2e', '.test-env.json')
const pidFile = join(process.cwd(), 'e2e', '.test-pid')

export default async function globalTeardown() {
    try {
        const pid = Number(readFileSync(pidFile, 'utf-8').trim())
        process.kill(pid, 'SIGTERM')
    } catch {}

    try {
        rmSync(stateFile)
    } catch {}
    try {
        rmSync(pidFile)
    } catch {}
}
