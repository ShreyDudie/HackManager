async (page) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('http://localhost:8080/');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const scene = page.locator('.build-scene');
  await scene.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Explore cube', exact: true }).click();
  if (await page.getByRole('button', { name: 'Assemble cube' }).getAttribute('aria-pressed') !== 'true') throw new Error('Cube did not expand');
  await page.getByRole('button', { name: 'Pause 3D animation' }).click();
  const paused = await scene.locator('.code-cube-float').evaluate((element) => getComputedStyle(element).animationPlayState);
  if (paused !== 'paused') throw new Error('Pause did not stop the animation');
  await page.screenshot({ path: 'test-results/landing-scene-expanded.png' });
  await page.getByRole('button', { name: 'Assemble cube' }).click();
  await page.getByRole('button', { name: 'Play 3D animation' }).click();
  const bounds = await scene.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.3);
  await page.waitForFunction(() => {
    const value = getComputedStyle(document.querySelector('.scene-objects')).transform;
    return value !== 'none' && value.startsWith('matrix3d');
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await scene.scrollIntoViewIfNeeded();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Overflow at ${width}`);
    await page.getByRole('button', { name: 'Explore cube', exact: true }).click();
    await page.getByRole('button', { name: 'Assemble cube', exact: true }).click();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('.scene-caption button:last-child')?.disabled === true);
  const animation = await scene.locator('.code-cube-float').evaluate((element) => getComputedStyle(element).animationName);
  if (animation !== 'none') throw new Error('Animation continues with reduced motion');
  await page.getByRole('button', { name: 'Explore cube', exact: true }).click();
  await page.getByRole('button', { name: 'Assemble cube', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await scene.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/landing-scene-mobile.png' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return 'PASS: cube expansion, pointer depth, pause/resume, reduced motion, and interaction without horizontal overflow at 320/390/768/1440px.';
}
