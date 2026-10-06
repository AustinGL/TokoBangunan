import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'app-screenshot.png', fullPage: true });

console.log('Screenshot saved to app-screenshot.png');
await browser.close();
