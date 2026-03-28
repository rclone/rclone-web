import { expect, test } from '@playwright/test'
import { getTestEnv, loginUrl } from './helpers'

test('logs in via URL params and redirects to dashboard', async ({ page }) => {
    await page.goto(loginUrl())
    const { appUrl } = getTestEnv()
    await page.waitForURL(appUrl + '/')
    await expect(page.getByRole('link', { name: 'Remotes' })).toBeVisible()
})

test('shows login form when no credentials provided', async ({ page }) => {
    const { appUrl } = getTestEnv()
    await page.goto(appUrl + '/login')
    await expect(page.getByRole('heading', { name: 'Connect to rclone' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible()
})
