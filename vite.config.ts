import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// this inlines the asset everywhere it is present, it doesn't dedupe it
function inlinePublicAsset(publicPath: string) {
    const source = fs.readFileSync(path.resolve(__dirname, `public${publicPath}`), 'utf8')
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(source)}`
    const publicAssetPaths = [`.${publicPath}`, publicPath]
    let outDir = path.resolve(__dirname, 'dist')

    function replaceAssetPath(value: string) {
        let nextValue = value

        for (const assetPath of publicAssetPaths) {
            nextValue = nextValue.replaceAll(assetPath, dataUrl)
        }

        return nextValue
    }

    return {
        name: `inline-public-asset:${publicPath}`,
        apply: 'build' as const,
        configResolved(config: { build: { outDir: string } }) {
            outDir = path.resolve(__dirname, config.build.outDir)
        },
        generateBundle(
            _: unknown,
            bundle: Record<string, { type: string; code?: string; source?: string | Uint8Array }>
        ) {
            for (const file of Object.values(bundle)) {
                if (file.type === 'chunk' && file.code) {
                    file.code = replaceAssetPath(file.code)
                }

                if (file.type === 'asset' && typeof file.source === 'string') {
                    file.source = replaceAssetPath(file.source)
                }
            }
        },
        closeBundle() {
            const indexHtmlPath = path.resolve(outDir, 'index.html')

            if (fs.existsSync(indexHtmlPath)) {
                const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8')
                fs.writeFileSync(indexHtmlPath, replaceAssetPath(indexHtml))
            }

            fs.rmSync(path.resolve(outDir, publicPath.slice(1)), { force: true })
        },
    }
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss(), viteSingleFile(), inlinePublicAsset('/icon.svg')],
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
