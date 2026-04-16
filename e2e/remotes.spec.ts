import { expect, test } from '@playwright/test'
import { getTestEnv, loginUrl, rcloneRC } from './helpers'

test.beforeAll(async () => {
    await rcloneRC('/config/create', { name: 'test-local', type: 'local', parameters: {} })
})

test.afterAll(async () => {
    await rcloneRC('/config/delete', { name: 'test-local' })
})

test('displays a remote after creating one via RC API', async ({ page }) => {
    await page.goto(loginUrl())
    const { appUrl } = getTestEnv()
    await page.waitForURL(appUrl + '/')
    await page.goto(appUrl + '/remotes')
    const row = page
        .getByRole('row')
        .filter({ has: page.getByRole('link', { name: 'test-local' }) })
    await expect(row).toBeVisible()
    await expect(row.getByText('local', { exact: true })).toBeVisible()
})
