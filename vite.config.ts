import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

function devLoginUrl(): import('vite').Plugin {
    return {
        name: 'dev-login-url',
        configureServer(server) {
            const original = server.printUrls
            server.printUrls = () => {
                original()
                const base = server.resolvedUrls?.local[0]
                if (base) {
                    const url = `${base}login?url=http://127.0.0.1:5572&user=dev&pass=dev`
                    server.config.logger.info(
                        `  \x1b[32m➜\x1b[0m  \x1b[1mLogin:\x1b[0m   \x1b[36m${url}\x1b[0m`
                    )
                }
            }
        },
    }
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss(), devLoginUrl()],
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
