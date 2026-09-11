import { expect, test } from '@playwright/test'
import { getTestEnv } from './helpers'

const file = (name: string, completed_at: string, error = '') => ({
    name,
    completed_at,
    error,
    group: 'job/7',
    srcFs: 'Source:',
    dstFs: 'Destination:',
    bytes: 512,
    size: 1024,
})

test('compact activity keeps running files visible and sorts completions by file timestamp', async ({
    page,
}) => {
    let active = true
    let stoppedJob: number | undefined
    await page.addInitScript(() => {
        localStorage.setItem(
            'lite-auth-store',
            JSON.stringify({
                state: { url: 'http://rc.test', user: 'fixture', pass: 'fixture' },
                version: 0,
            })
        )
    })
    await page.route('http://rc.test/**', async (route) => {
        const path = new URL(route.request().url()).pathname
        if (path === '/job/stop') {
            const requestUrl = new URL(route.request().url())
            const body = route.request().postData()
            stoppedJob = Number(
                requestUrl.searchParams.get('jobid') ?? (body ? JSON.parse(body).jobid : undefined)
            )
        }
        const responses: Record<string, unknown> = {
            '/core/stats': {
                transferring: active
                    ? [
                          {
                              ...file('Projects/2026/September/large-archive.bin', ''),
                              speed: 128,
                              percentage: 50,
                          },
                      ]
                    : [],
            },
            '/core/transferred': {
                transferred: [
                    file('old.bin', '2026-09-11T10:00:00Z'),
                    file('newest.bin', '2026-09-11T12:00:00Z'),
                    file('middle.bin', '2026-09-11T11:00:00Z'),
                    file('failed.bin', '2026-09-11T13:00:00Z', 'Fixture failure'),
                    file('unknown-time.bin', 'invalid'),
                ],
            },
            '/job/status': { id: 7, finished: false, startTime: '2026-09-11T09:00:00Z' },
            '/config/listremotes': { remotes: [] },
            '/config/dump': {},
            '/core/command': { result: '' },
            '/core/disks': { disks: [] },
        }
        await route.fulfill({ json: responses[path] ?? {} })
    })
    await page.goto(getTestEnv().appUrl + '/transfers')
    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(6)
    for (const [index, name] of [
        'Projects/2026/September/large-archive.bin',
        'failed.bin',
        'newest.bin',
        'middle.bin',
        'old.bin',
        'unknown-time.bin',
    ].entries()) {
        await expect(rows.nth(index)).toContainText(name)
    }
    await expect(
        rows.first().getByTitle('Source:Projects/2026/September/large-archive.bin', { exact: true })
    ).toHaveAttribute('title', 'Source:Projects/2026/September/large-archive.bin')
    expect((await rows.first().boundingBox())?.height).toBeLessThanOrEqual(42)
    await page.screenshot({ path: 'test-results/transfers-desktop.png', fullPage: true })
    await rows.first().getByRole('button', { name: 'Stop', exact: true }).click()
    await expect.poll(() => stoppedJob).toBe(7)
    const toggle = page.getByRole('button', { name: /Transfer activity/ })
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Projects/2026/September/large-archive.bin')
    active = false
    await expect(page.getByText('No active transfers. Expand to see history.')).toBeVisible()
    await toggle.click()
    await expect(rows).toHaveCount(5)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(toggle).toBeVisible()
    await page.screenshot({ path: 'test-results/transfers-mobile.png', fullPage: true })
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
})

test('long paths preserve their beginning and filename ending as the table resizes', async ({
    page,
}) => {
    const directory = 'Projects/Archive/2026/September/Originals/'
    const names = [
        directory + 'report-final.pdf',
        directory + 'a-very-long-filename-with-many-details-and-a-distinctive-ending.tar.gz',
        'short.txt',
    ]
    await page.addInitScript(() =>
        localStorage.setItem(
            'lite-auth-store',
            JSON.stringify({
                state: { url: 'http://rc.test', user: 'fixture', pass: 'fixture' },
                version: 0,
            })
        )
    )
    await page.route('http://rc.test/**', async (route) => {
        const responses: Record<string, unknown> = {
            '/core/stats': {
                transferring: names.map((name) => ({
                    ...file(name, ''),
                    speed: 128,
                    percentage: 50,
                })),
            },
            '/core/transferred': { transferred: [] },
            '/job/status': { id: 7, finished: false, startTime: '2026-09-11T09:00:00Z' },
            '/config/listremotes': { remotes: ['Source'] },
            '/config/dump': {},
        }
        await route.fulfill({ json: responses[new URL(route.request().url()).pathname] ?? {} })
    })
    await page.goto(getTestEnv().appUrl + '/transfers')
    const labels = names.map((name) =>
        page.locator('tbody').getByTitle('Source:' + name, { exact: true })
    )
    const visible = labels.map((label) => label.locator('[aria-hidden="true"]'))
    await expect(visible[0]).toHaveText(/^Source.*\.\.\.report-final\.pdf$/)
    await expect(visible[1]).toHaveText(/^Source.*\.\.\..*ending\.tar\.gz$/)
    await expect(visible[2]).toHaveText('Source:short.txt')
    for (const label of labels) {
        await label.hover()
        expect(await label.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
            true
        )
    }
    const narrow = await visible[1].textContent()
    await page.setViewportSize({ width: 3000, height: 900 })
    await expect.poll(() => visible[1].textContent()).not.toBe(narrow)
    await expect(visible[1]).toHaveText(
        /a-very-long-filename-with-many-details-and-a-distinctive-ending\.tar\.gz$/
    )
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(visible[1]).toHaveText(narrow!)
    await page.screenshot({ path: 'test-results/filename-ellipsis.png', fullPage: true })
})
