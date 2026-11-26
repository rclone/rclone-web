import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { getTestEnv, loginUrl, rcloneRC } from './helpers'

test('explorer opens nothing until a disk is chosen', async ({ page }) => {
    const listedFs: string[] = []
    page.on('request', (request) => {
        const url = new URL(request.url())
        if (url.pathname.endsWith('/operations/list')) {
            listedFs.push(request.postDataJSON()?.fs ?? '')
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

test.describe('sorting the file list', () => {
    let root = ''

    test.beforeAll(async () => {
        root = mkdtempSync(path.join(tmpdir(), 'rclone-web-e2e-'))
        mkdirSync(path.join(root, 'folder'))
        const files = [
            { name: 'a-middle.txt', size: 30, date: '2024-06-01T00:00:00Z' },
            { name: 'b-newest.txt', size: 10, date: '2025-01-01T00:00:00Z' },
            { name: 'c-oldest.txt', size: 20, date: '2023-01-01T00:00:00Z' },
        ]
        for (const file of files) {
            const filePath = path.join(root, file.name)
            writeFileSync(filePath, 'x'.repeat(file.size))
            const date = new Date(file.date)
            utimesSync(filePath, date, date)
        }
        await rcloneRC('/config/create', {
            name: 'test-sort',
            type: 'alias',
            parameters: { remote: root },
        })
    })

    test.afterAll(async () => {
        await rcloneRC('/config/delete', { name: 'test-sort' })
        rmSync(root, { recursive: true, force: true })
    })

    test('sorts by name, size and modification date with folders first', async ({ page }) => {
        const { appUrl } = getTestEnv()
        await page.goto(loginUrl())
        await page.waitForURL(appUrl + '/')
        await page.goto(appUrl + '/remotes/test-sort')

        const names = page.locator('tbody tr td:first-child')
        const header = (name: string) =>
            page.getByRole('columnheader').getByRole('button', { name, exact: true })

        await expect(names).toHaveText(['folder', 'a-middle.txt', 'b-newest.txt', 'c-oldest.txt'])

        await header('Modified').click()
        await expect(names).toHaveText(['folder', 'b-newest.txt', 'a-middle.txt', 'c-oldest.txt'])
        await expect(page.getByRole('columnheader', { name: 'Modified' })).toHaveAttribute(
            'aria-sort',
            'descending'
        )

        await header('Modified').click()
        await expect(names).toHaveText(['folder', 'c-oldest.txt', 'a-middle.txt', 'b-newest.txt'])

        await header('Size').click()
        await expect(names).toHaveText(['folder', 'a-middle.txt', 'c-oldest.txt', 'b-newest.txt'])

        await header('Size').click()
        await expect(names).toHaveText(['folder', 'b-newest.txt', 'c-oldest.txt', 'a-middle.txt'])

        await header('Name').click()
        await expect(names).toHaveText(['folder', 'a-middle.txt', 'b-newest.txt', 'c-oldest.txt'])

        await header('Name').click()
        await expect(names).toHaveText(['folder', 'c-oldest.txt', 'b-newest.txt', 'a-middle.txt'])
    })
})
