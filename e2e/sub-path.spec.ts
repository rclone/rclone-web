import { createServer, request, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from '@playwright/test'
import { getTestEnv } from './helpers'

// Acts as a reverse proxy that strips the sub-path, like Open OnDemand /rnode/ or Caddy handle_path
const upstreamPorts: Record<string, number> = { '/node/gui/': 5572, '/node/rc/': 5573 }

let proxy: Server
let proxyUrl: string

test.beforeAll(async () => {
    proxy = createServer((req, res) => {
        const prefix = Object.keys(upstreamPorts).find((p) => req.url?.startsWith(p))
        if (!prefix || !req.url) {
            res.writeHead(404).end()
            return
        }

        const upstream = request(
            {
                host: '127.0.0.1',
                port: upstreamPorts[prefix],
                path: req.url.slice(prefix.length - 1),
                method: req.method,
                headers: req.headers,
            },
            (upstreamRes) => {
                res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
                upstreamRes.pipe(res)
            }
        )
        req.pipe(upstream)
    })
    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
    proxyUrl = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`
})

test.afterAll(async () => {
    proxy.closeAllConnections()
    await new Promise((resolve) => proxy.close(resolve))
})

function loginParams() {
    const { rcUser, rcPass } = getTestEnv()
    return new URLSearchParams({ url: `${proxyUrl}/node/rc/`, user: rcUser, pass: rcPass })
}

test('works under a sub-path and keeps the page after a reload', async ({ page }) => {
    const guiUrl = `${proxyUrl}/node/gui/`
    await page.goto(`${guiUrl}#/login?${loginParams()}`)
    await page.waitForURL(`${guiUrl}#/`)

    const remotesLink = page.getByRole('link', { name: 'Remotes', exact: true })
    await remotesLink.click()
    await page.waitForURL(`${guiUrl}#/remotes`)

    await page.reload()
    await expect(remotesLink).toHaveAttribute('aria-current', 'page')
})

test('moves a /login link under a sub-path into the hash', async ({ page }) => {
    const guiUrl = `${proxyUrl}/node/gui/`
    await page.goto(`${guiUrl}login?${loginParams()}`)
    await page.waitForURL(`${guiUrl}#/`)
    await expect(page.getByRole('link', { name: 'Remotes' })).toBeVisible()
})
