import { test, expect } from '@playwright/test';

const BASE_URL = 'https://ucapan-bersama.vercel.app';

test('debug /for/leniayu page content', async ({ page }) => {
  await page.goto(`${BASE_URL}/for/leniayu`, { waitUntil: 'networkidle' });
  
  // Wait a bit for hydration
  await page.waitForTimeout(5000);
  
  // Get full page content
  const content = await page.content();
  console.log('=== PAGE CONTENT (first 5000 chars) ===');
  console.log(content.substring(0, 5000));
  
  // Check for specific elements
  const hasName = content.includes('Leni Ayu Pratiwi');
  console.log('Has "Leni Ayu Pratiwi":', hasName);
  
  const hasSlug = content.includes('leniayu');
  console.log('Has "leniayu":', hasSlug);
});

test('debug /mlebu-le page content', async ({ page }) => {
  await page.goto(`${BASE_URL}/mlebu-le`, { waitUntil: 'networkidle' });
  
  // Wait for hydration
  await page.waitForTimeout(5000);
  
  const content = await page.content();
  console.log('=== LOGIN PAGE CONTENT (first 5000 chars) ===');
  console.log(content.substring(0, 5000));
  
  const hasUsername = content.includes('username');
  console.log('Has "username":', hasUsername);
  
  const hasPassword = content.includes('password');
  console.log('Has "password":', hasPassword);
});