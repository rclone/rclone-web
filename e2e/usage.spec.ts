import { expect, type Page, test } from '@playwright/test'
import { getTestEnv, loginUrl, rcloneRC } from './helpers'

test.beforeAll(async () => {
    await rcloneRC('/config/create', { name: 'test-usage', type: 'local', parameters: {} })
})

test.afterAll(async () => {
    await rcloneRC('/config/delete', { name: 'test-usage' })
})

function countAboutRequests(page: Page) {
    const fsParams: string[] = []
    page.on('request', (request) => {
        const url = new URL(request.url())
        if (url.pathname.endsWith('/operations/about')) {
            fsParams.push(url.searchParams.get('fs') ?? '')
        }
    })
    return fsParams
}

async function openRemotesPage(page: Page) {
    const { appUrl } = getTestEnv()
    await page.goto(loginUrl())
    await page.waitForURL(appUrl + '/')
    await page.goto(appUrl + '/remotes')
    const row = page
        .getByRole('row')
        .filter({ has: page.getByRole('link', { name: 'test-usage' }) })
    await expect(row).toBeVisible()
    return row
}

// Turns the "Check usage automatically" setting off before the app loads.
async function disableUsageChecks(page: Page) {
    await page.addInitScript(() => {
        const key = 'lite-auth-store'
        const stored = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":0}')
        stored.state.checkRemoteUsage = false
        localStorage.setItem(key, JSON.stringify(stored))
    })
}

test('checks remote usage by default', async ({ page }) => {
    const aboutRequests = countAboutRequests(page)
    const row = await openRemotesPage(page)
    await expect.poll(() => aboutRequests).toContain('test-usage:')
    await expect(row.getByRole('button', { name: 'Check usage of test-usage' })).toBeHidden()
})

test('does not check remote usage when disabled', async ({ page }) => {
    await disableUsageChecks(page)
    const aboutRequests = countAboutRequests(page)
    const row = await openRemotesPage(page)
    await page.waitForTimeout(1000)
    expect(aboutRequests).toEqual([])
    await expect(row.getByRole('button', { name: 'Check usage of test-usage' })).toBeVisible()
})

test('checks one remote from its usage cell', async ({ page }) => {
    await disableUsageChecks(page)
    const aboutRequests = countAboutRequests(page)
    const row = await openRemotesPage(page)
    await row.getByRole('button', { name: 'Check usage of test-usage' }).click()
    await expect.poll(() => aboutRequests).toEqual(['test-usage:'])
    await expect(row.getByRole('button', { name: 'Check usage of test-usage' })).toBeHidden()
    await expect(page).toHaveURL(/\/remotes$/)
})

test('checks remote usage once enabled in settings', async ({ page }) => {
    await disableUsageChecks(page)
    const aboutRequests = countAboutRequests(page)
    await openRemotesPage(page)
    await page.locator('header img').first().click()
    await page.getByRole('switch', { name: 'Check usage automatically' }).click()
    await expect.poll(() => aboutRequests).toContain('test-usage:')
})
