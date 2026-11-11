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

test('mobile explorer opens sidebar drawer and responds to viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    const { appUrl } = getTestEnv()
    await page.goto(loginUrl())
    await page.waitForURL(appUrl + '/')
    await page.goto(appUrl + '/local')

    // On mobile, the sidebar drawer is initially closed (translated off-screen)
    const sidebar = page.locator('aside')
    await expect(sidebar).toHaveClass(/-translate-x-full/)

    // Mobile sidebar toggle button should be visible
    const openButton = page.getByRole('button', { name: 'Open sidebar' }).first()
    await expect(openButton).toBeVisible()
    await openButton.click()

    // Sidebar drawer opens and backdrop overlay is displayed
    await expect(sidebar).toHaveClass(/translate-x-0/)
    const backdrop = page.getByRole('button', { name: 'Close sidebar' })
    await expect(backdrop).toBeVisible()

    // Clicking a disk navigates and closes the drawer
    const firstDisk = sidebar.locator('a[href^="/local?disk="]').first()
    await expect(firstDisk).toBeVisible()
    await firstDisk.click()

    await expect(page).toHaveURL(/\/local\?disk=/)
    await expect(sidebar).toHaveClass(/-translate-x-full/)

    // When browsing a disk on mobile, the header toggle button is accessible
    await expect(openButton).toBeVisible()
    await openButton.click()
    await expect(sidebar).toHaveClass(/translate-x-0/)

    // Clicking the backdrop closes the drawer
    await backdrop.click()
    await expect(sidebar).toHaveClass(/-translate-x-full/)
})
