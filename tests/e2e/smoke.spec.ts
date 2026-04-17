import { expect, test } from '@playwright/test'

test('login page renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Welcome back.')).toBeVisible()
})

test('demo user can sign in with password', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('founder@serene-executive.app')
  await page.getByLabel('Password').fill('ConciergeDemo123!')
  await page.getByRole('button', { name: 'Sign in with password' }).click()

  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByText(/Your agenda is/i)).toBeVisible()
})
