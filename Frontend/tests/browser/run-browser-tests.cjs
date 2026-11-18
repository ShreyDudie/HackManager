const { chromium } = require('D:/Program Files/npm-global/node_modules/@playwright/cli/node_modules/playwright-core');

async function testBrowser() {
  console.log('Launching Chrome...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Landing Page
    console.log('\n--- 1. Testing Landing Page ---');
    await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
    const title = await page.title();
    console.log(`Page title: "${title}"`);
    if (!title.includes('HackManager')) throw new Error(`Unexpected title: ${title}`);
    console.log('✓ Landing page loaded successfully');

    // Helper to log in and verify
    async function testLogin(email, role, expectedUrlFragment, expectedContent) {
      console.log(`\n--- Testing ${role.toUpperCase()} Login (${email}) ---`);
      await page.goto(`http://localhost:8080/auth/login?role=${role}`, { waitUntil: 'networkidle' });

      // Fill in credentials
      await page.waitForSelector('#auth-email');
      await page.fill('#auth-email', email);
      await page.fill('#auth-password', 'password123');

      // Click submit
      await page.click('button[type="submit"]');

      // Wait for navigation
      await page.waitForURL(`**${expectedUrlFragment}**`, { timeout: 10000 });
      console.log(`✓ Navigated to: ${page.url()}`);

      // Verify content is on the page
      await page.waitForTimeout(1000);
      const pageText = await page.innerText('body');
      if (!pageText.includes(expectedContent)) {
        throw new Error(`Expected text "${expectedContent}" not found on page for role ${role}`);
      }
      console.log(`✓ Verified page content contains: "${expectedContent}"`);

      // Clear tokens
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      console.log(`✓ Session cleared for ${role}`);
    }

    // 2. Student Login
    await testLogin('student@hci', 'student', '/student', 'Manage face profile');

    // 3. Judge Login
    await testLogin('judge@hci', 'judge', '/judge', 'Your judging assignments');

    // 4. Admin Login
    await testLogin('admin@hci', 'admin', '/admin', 'Create event');

    console.log('\n===========================================');
    console.log('🎉 ALL BROWSER & LOGIN TESTS PASSED CLEANLY!');
    console.log('===========================================\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

testBrowser();
