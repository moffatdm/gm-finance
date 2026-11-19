import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { accountReferencePage, validateAccountReference } from '../assets/account-reference.js';

const read = async file => JSON.parse(await readFile(new URL(`../data/${file}`, import.meta.url), 'utf8'));
const course = await read('course.json');
const config = await read(course.accountReferenceFile);
const activities = await read(course.activitiesFile);

test('every selectable, journal, ledger and trial-balance account appears once under a category or explicit exception', () => {
  validateAccountReference(config, activities);
  const rows = [...config.groups.flatMap(g => g.accounts), ...config.specialAccounts];
  assert.equal(new Set(rows.map(r => r.name)).size, rows.length);
  const html = accountReferencePage(config);
  for (const name of activities.accounts) assert.ok(rows.some(r => r.name === name), name);
  assert.ok(html.includes('Electricity expense (Expense)'));
  assert.ok(html.includes('Accruals (Liability)'));
  assert.ok(html.includes('no Bank entry'));
});

test('contra-balances and temporary clearing accounts are not misclassified', () => {
  const group = id => config.groups.find(g => g.id === id).accounts;
  assert.equal(group('assets').find(a => a.name === 'Accumulated depreciation').balance, 'Cr');
  assert.equal(group('equity').find(a => a.name === 'Drawings').balance, 'Dr');
  assert.equal(group('equity').find(a => a.name === 'Dividends (equity distribution)').balance, 'Dr');
  assert.ok(group('liabilities').some(a => a.name === 'Bank (overdraft)'));
  assert.ok(group('revenue').some(a => a.name === 'Gain on disposal'));
  assert.ok(group('expenses').some(a => a.name === 'Loss on disposal'));
  assert.ok(!config.groups.some(g => g.accounts.some(a => a.name === 'Disposal')));
  assert.equal(config.specialAccounts.find(a => a.name === 'Disposal').balance, 'Either, then nil');
});

test('a newly added exercise account cannot silently be missing from the guide', () => {
  const updated = structuredClone(activities);
  updated.accounts.push('New account');
  assert.throws(() => validateAccountReference(config, updated), /missing exercise account "New account"/);
  const missingOverdraft = structuredClone(config);
  missingOverdraft.groups.find(g => g.id === 'liabilities').accounts = missingOverdraft.groups.find(g => g.id === 'liabilities').accounts.filter(a => a.name !== 'Bank (overdraft)');
  assert.throws(() => validateAccountReference(missingOverdraft, activities), /Bank \(overdraft\)/);
});

test('duplicate account names and absent narrative clues fail validation; strings are escaped', () => {
  const duplicate = structuredClone(config);
  duplicate.groups[1].accounts.push(duplicate.groups[0].accounts[0]);
  assert.throws(() => validateAccountReference(duplicate, activities), /duplicate account/);
  const incomplete = structuredClone(config);
  incomplete.groups[0].accounts[0].clues = '';
  assert.throws(() => validateAccountReference(incomplete, activities), /incomplete/);
  const escaped = structuredClone(config);
  escaped.groups[0].accounts[0].meaning = '<script>alert(1)</script>';
  assert.ok(!accountReferencePage(escaped).includes('<script>'));
});
