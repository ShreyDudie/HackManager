async (page) => {
  await page.goto('http://localhost:8080/auth/login?role=student');
  await page.getByLabel('Email', { exact: true }).fill('missing-account@example.test');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Invalid email, password, or role' }).waitFor();
  await page.route('**/api/hackathons', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'The event service is unavailable' } }) }));
  try {
    await page.goto('http://localhost:8080/hackathons');
    await page.getByRole('alert').filter({ hasText: 'The event service is unavailable' }).waitFor();
  } finally { await page.unroute('**/api/hackathons'); }
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('link', { name: 'View event', exact: true }).first().waitFor();
  return 'PASS: invalid credentials, API unavailable error, and retry recovery.';
}
