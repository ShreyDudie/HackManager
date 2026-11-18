const { chromium } = require('D:/Program Files/npm-global/node_modules/@playwright/cli/node_modules/playwright-core');
const path = require('path');

async function testHackathonFlow() {
  console.log('Launching Chrome for Hackathon Flow Verification...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const screenshotDir = path.join(__dirname, 'screenshots');
  const fs = require('fs');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  try {
    // 1. Log in as admin
    console.log('\n--- 1. Logging in as admin@hci ---');
    await page.goto('http://localhost:8080/auth/login?role=admin', { waitUntil: 'networkidle' });
    await page.waitForSelector('#auth-email');
    await page.fill('#auth-email', 'admin@hci');
    await page.fill('#auth-password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin**', { timeout: 10000 });
    console.log('✓ Admin logged in successfully');

    // 2. Navigate to Hackathons listing page
    console.log('\n--- 2. Checking Redesigned Hackathons Page ---');
    await page.goto('http://localhost:8080/hackathons', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(screenshotDir, '01-hackathons-page-initial.png'), fullPage: true });
    console.log('✓ Captured screenshot: 01-hackathons-page-initial.png');

    // 3. Go to Create Hackathon page
    console.log('\n--- 3. Navigating to Create Hackathon ---');
    await page.goto('http://localhost:8080/admin/hackathon/new', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[placeholder*="HackMatrix"]');

    console.log('Filling in Hackathon Details with Multi-Stage Progression...');
    await page.fill('input[placeholder*="HackMatrix"]', 'Agentic AI World Hackathon 2026');
    await page.fill('input[placeholder*="AI & Web3"]', 'Multi-Agent Autonomous Systems');
    await page.fill('textarea[placeholder*="Describe the challenge"]', 'Build production-ready autonomous multi-agent networks capable of self-healing, coordination, and automated delivery.');
    await page.fill('input[placeholder*="Campus Main Auditorium"]', 'Silicon Valley Arena & Online');

    // Dates
    const today = new Date();
    const startDateStr = '2026-12-01';
    const endDateStr = '2026-12-05';
    const regDeadlineStr = '2026-12-01';

    await page.locator('input[type="date"]').nth(0).fill(startDateStr);
    await page.locator('input[type="date"]').nth(1).fill(endDateStr);
    await page.locator('input[type="date"]').nth(2).fill(regDeadlineStr);

    // Take screenshot of creation form
    await page.screenshot({ path: path.join(screenshotDir, '02-create-hackathon-form.png'), fullPage: true });
    console.log('✓ Captured screenshot: 02-create-hackathon-form.png');

    // Submit form
    console.log('Submitting Hackathon Creation Form...');
    await page.click('button[type="submit"]');

    // Wait for redirect to Event Workspace
    await page.waitForURL('**/events/**', { timeout: 15000 });
    console.log(`✓ Successfully redirected to Workspace: ${page.url()}`);

    // Wait for content hydration
    await page.waitForTimeout(2000);
    const bodyText = await page.innerText('body');
    if (!bodyText.includes('Agentic AI World Hackathon 2026')) {
      throw new Error('Created hackathon title not found on workspace page');
    }
    if (!bodyText.includes('Hackathon Stages & Evaluation Timelines')) {
      throw new Error('Stages & Evaluation Timelines roadmap section missing');
    }
    if (!bodyText.includes('Problem Statements & Challenge Tracks')) {
      throw new Error('Problem statements section missing');
    }
    console.log('✓ Verified Stages Roadmap and Problem Statements on Workspace');

    await page.screenshot({ path: path.join(screenshotDir, '03-event-workspace-detail.png'), fullPage: true });
    console.log('✓ Captured screenshot: 03-event-workspace-detail.png');

    // 4. Return to /hackathons to verify the card appearance
    console.log('\n--- 4. Verifying Hackathon Card on /hackathons ---');
    await page.goto('http://localhost:8080/hackathons', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const listText = await page.innerText('body');
    if (!listText.includes('Agentic AI World Hackathon 2026')) {
      throw new Error('Newly created hackathon not visible on /hackathons');
    }
    console.log('✓ Verified "Agentic AI World Hackathon 2026" displayed on listing');

    await page.screenshot({ path: path.join(screenshotDir, '04-hackathons-page-updated.png'), fullPage: true });
    console.log('✓ Captured screenshot: 04-hackathons-page-updated.png');

    console.log('\n======================================================');
    console.log('🎉 HACKATHON CREATION & STAGES ROADMAP FLOW VERIFIED!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    await page.screenshot({ path: path.join(screenshotDir, 'error.png'), fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

testHackathonFlow();

