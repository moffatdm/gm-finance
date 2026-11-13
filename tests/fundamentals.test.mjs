import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { orderedPages, validateFundamentals, fundamentalsIndex, fundamentalsPage } from '../assets/fundamentals.js';

const root = new URL('../', import.meta.url);
const course = JSON.parse(await readFile(new URL('data/course.json', root), 'utf8'));
const config = JSON.parse(await readFile(new URL(`data/${course.fundamentalsFile}`, root), 'utf8'));

test('fundamentals follow the four attachments in numerical order', () => {
  validateFundamentals(config);
  assert.deepEqual(orderedPages(config).map(p => p.title), ['Debits & Credits', 'Account Types', 'The Ledger', 'Financial Statements']);
  const shuffled = { ...config, pages: [...config.pages].reverse() };
  assert.deepEqual(orderedPages(shuffled).map(p => p.order), [1,2,3,4]);
  const html = fundamentalsIndex(shuffled);
  assert.ok(html.indexOf('#fundamentals/debits-credits') < html.indexOf('#fundamentals/account-types'));
});

test('each page links a real PDF and existing lessons or exercises', async () => {
  const units = await Promise.all(course.units.map(async u => JSON.parse(await readFile(new URL(`data/${u.file}`, root), 'utf8'))));
  const activities = JSON.parse(await readFile(new URL(`data/${course.activitiesFile}`, root), 'utf8'));
  const valid = new Set([
    ...units.flatMap(u => u.modules.map(m => `lesson/${m.id}`)),
    ...activities.journals.map(a => `journal/${a.id}`),
    ...activities.ledgers.map(a => `ledger/${a.id}`),
    ...activities.trialBalances.map(a => `trial/${a.id}`),
    ...activities.exams.map(a => `exam/${a.id}`)
  ]);
  for (const page of config.pages) {
    const file = await readFile(new URL(page.pdf, root));
    assert.equal(file.subarray(0,5).toString(), '%PDF-');
    assert.ok(page.links.every(link => valid.has(link.route)));
    const html = fundamentalsPage(config, page.id, '', true);
    assert.ok(html.includes(`href="${page.pdf}"`));
    assert.ok(html.includes('EXPLAIN LIKE I’M NEW'));
    assert.ok(!fundamentalsPage(config, page.id, '', false).includes('EXPLAIN LIKE I’M NEW'));
  }
});

test('invalid IDs, order and unsafe PDF links are rejected', () => {
  for (const field of ['id','order','pdf']) {
    const bad = structuredClone(config);
    bad.pages[0][field] = field === 'order' ? 2 : field === 'pdf' ? '../private.pdf' : 'bad id';
    assert.throws(() => validateFundamentals(bad), /invalid fundamentals/);
  }
  assert.equal(fundamentalsPage(config, 'not-a-page', '', false), null);
});
