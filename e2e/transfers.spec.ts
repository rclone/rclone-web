import { expect, type Page, test } from '@playwright/test'
import { getTestEnv } from './helpers'

const rcUrl = 'http://rc.test'

function file(name: string, completedAt = '', error = '') {
    return {
        name,
        completed_at: completedAt,
        error,
        group: 'job/7',
        srcFs: 'Source:',
        dstFs: 'Destination:',
        bytes: 512,
        size: 1024,
    }
}

function running(name: string) {
    return { ...file(name), speed: 128, percentage: 50 }
}

async function mockRc(
    page: Page,
    responses: { transferring?: unknown[]; transferred?: unknown[] },
    onRequest?: (url: URL) => void
) {
    await page.addInitScript((url) => {
        localStorage.setItem(
            'lite-auth-store',
            JSON.stringify({ state: { url, user: 'fixture', pass: 'fixture' }, version: 0 })
        )
    }, rcUrl)

    await page.route(`${rcUrl}/**`, async (route) => {
        const url = new URL(route.request().url())
        onRequest?.(url)

        const json: Record<string, unknown> = {
            '/core/stats': { transferring: responses.transferring ?? [] },
            '/core/transferred': { transferred: responses.transferred ?? [] },
            '/job/status': { id: 7, finished: false, startTime: '2026-09-11T09:00:00Z' },
        }
        await route.fulfill({ json: json[url.pathname] ?? {} })
    })
}

test('sorts running first, then failed, then finished newest first', async ({ page }) => {
    await mockRc(page, {
        transferring: [running('active.bin')],
        transferred: [
            file('old.bin', '2026-09-11T10:00:00Z'),
            file('newest.bin', '2026-09-11T12:00:00Z'),
            file('middle.bin', '2026-09-11T11:00:00Z'),
            file('failed.bin', '2026-09-11T13:00:00Z', 'Fixture failure'),
            file('unknown-time.bin', 'invalid'),
        ],
    })
    await page.goto(getTestEnv().appUrl + '/transfers')

    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(6)

    const expected = [
        'active.bin',
        'failed.bin',
        'newest.bin',
        'middle.bin',
        'old.bin',
        'unknown-time.bin',
    ]
    for (const [index, name] of expected.entries()) {
        await expect(rows.nth(index)).toContainText(name)
    }
})

test('stop sends the job id', async ({ page }) => {
    let stoppedJob: string | null = null
    await mockRc(page, { transferring: [running('active.bin')] }, (url) => {
        if (url.pathname === '/job/stop') {
            stoppedJob = url.searchParams.get('jobid')
        }
    })
    await page.goto(getTestEnv().appUrl + '/transfers')

    await page.getByRole('button', { name: 'Stop', exact: true }).click()
    await expect.poll(() => stoppedJob).toBe('7')
})

test('long paths keep their beginning and filename as the table resizes', async ({ page }) => {
    const directory = 'Projects/Archive/2026/September/Originals/'
    const names = [
        directory + 'report-final.pdf',
        directory + 'a-very-long-filename-with-many-details-and-a-distinctive-ending.tar.gz',
        'short.txt',
    ]
    await mockRc(page, { transferring: names.map(running) })
    await page.goto(getTestEnv().appUrl + '/transfers')

    const labels = names.map((name) =>
        page.locator('tbody').getByTitle('Source:' + name, { exact: true })
    )
    const visible = labels.map((label) => label.locator('[aria-hidden="true"]'))
    await expect(visible[0]).toHaveText(/^Source.*…report-final\.pdf$/)
    await expect(visible[1]).toHaveText(/^Source.*….*ending\.tar\.gz$/)
    await expect(visible[2]).toHaveText('Source:short.txt')

    for (const label of labels) {
        expect(await label.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
            true
        )
    }

    const narrow = await visible[1].textContent()
    await page.setViewportSize({ width: 3000, height: 900 })
    await expect(visible[1]).toHaveText(
        /a-very-long-filename-with-many-details-and-a-distinctive-ending\.tar\.gz$/
    )

    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(visible[1]).toHaveText(narrow ?? '')

    await page.setViewportSize({ width: 390, height: 844 })
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
})
