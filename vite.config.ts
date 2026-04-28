import { type ChildProcess, spawn } from 'node:child_process'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

const RC_ADDR = '127.0.0.1'
const RC_PORT = '5572'
const RC_USER = 'dev'
const RC_PASS = 'dev'
const RC_URL = `http://${RC_ADDR}:${RC_PORT}`

function devRclone(): import('vite').Plugin {
    let rclone: ChildProcess | null = null
    return {
        name: 'dev-rclone',
        apply: 'serve',
        configureServer(server) {
            const bin = process.env.RCLONE_BIN ?? 'rclone'
            const origin = `http://localhost:${server.config.server.port ?? 5173}`

            rclone = spawn(
                bin,
                [
                    'rcd',
                    '--rc-addr',
                    `${RC_ADDR}:${RC_PORT}`,
                    '--rc-user',
                    RC_USER,
                    '--rc-pass',
                    RC_PASS,
                    '--rc-allow-origin',
                    origin,
                ],
                { stdio: 'ignore' }
            )

            rclone.on('error', (err) => {
                server.config.logger.error(`[rclone] ${err.message}`)
            })

            server.httpServer?.on('close', () => {
                rclone?.kill()
            })

            const original = server.printUrls
            server.printUrls = () => {
                original()
                const base = server.resolvedUrls?.local[0]
                if (base) {
                    const url = `${base}login?url=${RC_URL}&user=${RC_USER}&pass=${RC_PASS}`
                    server.config.logger.info(
                        `  \x1b[32m➜\x1b[0m  \x1b[1mLogin:\x1b[0m   \x1b[36m${url}\x1b[0m`
                    )
                }
            }
        },
        buildEnd() {
            rclone?.kill()
            rclone = null
        },
    }
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss(), devRclone()],
    define: {
        APP_VERSION: JSON.stringify(pkg.version),
    },
    // server: {
    //     proxy: {
    //         '/rc': {
    //             target: 'http://127.0.0.1:5572',
    //             changeOrigin: true,
    //             rewrite: (pathname) => pathname.replace(/^\/rc/, ''),
    //         },
    //     },
    // },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        chunkSizeWarningLimit: 1000,
    },
})
