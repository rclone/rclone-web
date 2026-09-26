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

test('keeps ?url= after a failed attempt so credentials can be entered', async ({ page }) => {
    const { appUrl, rcUrl, rcUser, rcPass } = getTestEnv()
    await page.goto(`${appUrl}/login?${new URLSearchParams({ url: rcUrl })}`)

    await expect(page.getByText('This rclone RC requires credentials.')).toBeVisible()
    await expect(page).not.toHaveURL(/url=/)

    await page.getByLabel('User').fill(rcUser)
    await page.getByLabel('Password').fill(rcPass)
    await page.getByRole('button', { name: 'Connect' }).click()

    await page.waitForURL(appUrl + '/')
    await expect(page.getByRole('link', { name: 'Remotes' })).toBeVisible()
})
