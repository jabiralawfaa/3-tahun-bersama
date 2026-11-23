import { test, expect } from '@playwright/test';

const BASE_URL = 'https://ucapan-bersama.vercel.app';

test.describe('Memory Archive - leniayu', () => {
  test('loads /for/leniayu without JSON parsing errors (via gateway)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    // First, go through the gateway to unlock
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="text"]', { timeout: 15000 });
    
    // Enter the code
    await page.fill('input[type="text"]', 'leniayu');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to /for/leniayu
    await page.waitForURL('**/for/leniayu', { timeout: 15000 });
    
    // Wait for hydration
    await page.waitForSelector('main', { timeout: 15000 });
    
    // Check for the specific error
    const jsonError = errors.find(e => e.includes('Unexpected end of JSON input'));
    expect(jsonError, `Found JSON parsing error: ${jsonError}`).toBeUndefined();

    // Check that the page is not showing an error state
    const notFound = await page.locator('text=404').isVisible().catch(() => false);
    expect(notFound).toBeFalsy();

    // Verify content elements - the name is NOT in the UI, but role is
    await expect(page.locator('text=Orang yang aku cinta')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=Pandangan Pertama')).toBeVisible();
    await expect(page.locator('text=RAN').last()).toBeVisible();
  });

  test('audio file loads correctly', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/audio/leniayu.mp3`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('audio');
  });

  test('API returns memory data with correct structure', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/memories/by-slug/leniayu`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.memory).toBeDefined();
    expect(data.memory.slug).toBe('leniayu');
    expect(data.memory.name).toBe('Leni Ayu Pratiwi');
    // decoration is nested under theme
    expect(data.memory.theme.decoration).toBe('bokeh');
    expect(data.memory.theme.accent).toBe('#ff6b6b');
    expect(data.memory.lineConfig.length).toBeGreaterThanOrEqual(7);
    expect(data.memory.svgIcons.length).toBe(3);
    expect(data.memory.finalMessage).toContain('Leni, terima kasih');
  });

  test('admin login page loads and form appears', async ({ page }) => {
    await page.goto(`${BASE_URL}/mlebu-le`, { waitUntil: 'networkidle' });
    // Wait for client-side rendering and the "booted" state (250ms delay + animation)
    // Use aria-label since inputs don't have name attributes
    await page.waitForSelector('input[aria-label="Username admin"]', { timeout: 30000 });
    await expect(page.locator('input[aria-label="Username admin"]')).toBeVisible();
    await expect(page.locator('input[aria-label="Password admin"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Masuk")')).toBeVisible();
  });

  test('admin login and dashboard work', async ({ page }) => {
    await page.goto(`${BASE_URL}/mlebu-le`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[aria-label="Username admin"]', { timeout: 30000 });
    
    // Login
    await page.fill('input[aria-label="Username admin"]', 'jabiralawfaa');
    await page.fill('input[aria-label="Password admin"]', '3TahunBersama');
    await page.click('button[type="submit"]:has-text("Masuk")');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/mlebu-le/dashboard', { timeout: 15000 });
    
    // Verify dashboard loads
    await expect(page.locator('text=Leni Ayu Pratiwi')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=leniayu')).toBeVisible();
  });
});