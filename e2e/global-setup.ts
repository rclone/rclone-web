import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const stateFile = join(process.cwd(), 'e2e', '.test-env.json')
const pidFile = join(process.cwd(), 'e2e', '.test-pid')

export default async function globalSetup() {
    const child = spawn('node', ['rclone'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
    })

    let rcUrl = ''
    let rcUser = ''
    let rcPass = ''
    let appUrl = ''

    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            child.kill('SIGTERM')
            reject(new Error('Timed out waiting for servers to start (120s)'))
        }, 120_000)

        let buffer = ''

        function processLine(line: string) {
            if (line.startsWith('RC URL: ')) {
                rcUrl = line.slice('RC URL: '.length).trim()
            } else if (line.startsWith('RC user: ')) {
                rcUser = line.slice('RC user: '.length).trim()
            } else if (line.startsWith('RC pass: ')) {
                rcPass = line.slice('RC pass: '.length).trim()
            } else if (line.startsWith('Opening ')) {
                const loginUrlStr = line.slice('Opening '.length).trim()
                appUrl = new URL(loginUrlStr).origin
                clearTimeout(timeout)
                resolve()
            }
        }

        child.stdout.on('data', (chunk: Buffer) => {
            buffer += chunk.toString()
            const lines = buffer.split('\n')
            buffer = lines.pop()!
            for (const line of lines) {
                processLine(line)
            }
        })

        child.stderr.on('data', (chunk: Buffer) => {
            process.stderr.write(chunk)
        })

        child.on('error', (err) => {
            clearTimeout(timeout)
            reject(err)
        })

        child.on('exit', (code) => {
            if (!rcUrl) {
                clearTimeout(timeout)
                reject(new Error(`rclone script exited unexpectedly with code ${code}`))
            }
        })
    })

    writeFileSync(stateFile, JSON.stringify({ rcUrl, rcUser, rcPass, appUrl }))
    writeFileSync(pidFile, String(child.pid))
}
