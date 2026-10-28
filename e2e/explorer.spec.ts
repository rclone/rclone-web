import { expect, test } from '@playwright/test'
import { getTestEnv, loginUrl } from './helpers'

test('explorer opens nothing until a disk is chosen', async ({ page }) => {
    const listedFs: string[] = []
    page.on('request', (request) => {
        const url = new URL(request.url())
        if (url.pathname.endsWith('/operations/list')) {
            listedFs.push(url.searchParams.get('fs') ?? '')
        }
    })

    const { appUrl } = getTestEnv()
    await page.goto(loginUrl())
    await page.waitForURL(appUrl + '/')
    await page.goto(appUrl + '/local')

    await expect(page.getByText('Choose a disk or remote')).toBeVisible()
    const firstDisk = page.locator('a[href^="/local?disk="]').first()
    await expect(firstDisk).toBeVisible()
    await page.waitForTimeout(1000)
    expect(listedFs).toEqual([])
    await expect(page).toHaveURL(/\/local$/)

    await firstDisk.click()
    await expect(page).toHaveURL(/\/local\?disk=/)
    await expect.poll(() => listedFs.length).toBeGreaterThan(0)
})
