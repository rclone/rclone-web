import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
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
