import { test, expect } from '@playwright/test';

test('crawler opt-out directives are served in the built site before JavaScript runs', async ({request}) => {
  const html = await request.get('./');
  expect(html.status()).toBe(200);
  expect(await html.text()).toContain('<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">');
  const robots = await request.get('./robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toContain('text/plain');
  expect((await robots.text()).replaceAll('\r\n', '\n')).toBe('User-agent: *\nDisallow: /\n');
});
