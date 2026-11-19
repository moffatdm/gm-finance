import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../../data/account-quiz.json', import.meta.url), 'utf8'));
const key = 'accounting-understood:v1';

test('account tabs isolate content, support keyboard navigation and deep links', async ({page}) => {
  await page.goto('./#accounts');
  await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('heading',{name:'Electricity used, but not yet billed or paid'})).toBeVisible();
  await expect(page.locator('#account-group-assets')).toBeHidden();
  await page.getByRole('tab',{name:'Overview',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'Account categories',exact:true})).toBeFocused();
  await expect(page.locator('#account-group-assets')).toBeVisible();
  await expect(page.locator('#narrative-example')).toBeHidden();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab',{name:'Quiz',exact:true})).toBeFocused();
  await expect(page.getByRole('heading',{name:'Your account-decoding quiz'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab',{name:'Quiz',exact:true})).toHaveAttribute('aria-selected','true');
  await page.goBack();
  await expect(page.getByRole('tab',{name:'Account categories',exact:true})).toHaveAttribute('aria-selected','true');
});

test('staged account quiz saves wrong answers, hints and place, unlocks stages and preserves completion', async ({page}) => {
  await page.goto('./#accounts/quiz');
  await expect(page.getByRole('button',{name:'2. Translate the wording'})).toBeDisabled();
  await page.getByRole('button',{name:'A little hint'}).click();
  await page.reload();
  await expect(page.getByRole('button',{name:'Hint used'})).toBeDisabled();
  const questions = config.stages.flatMap(s=>s.questions);
  for (const [i,q] of questions.entries()) {
    await expect(page.locator('#account-question-heading')).toHaveText(q.q);
    await expect(page.getByRole('button',{name:i === 23 ? 'Finish quiz' : (i+1)%6===0 ? 'Next stage' : 'Next question'})).toBeDisabled();
    await page.locator('#account-quiz-slot .answer').nth(i === 0 ? (q.answer+1)%4 : q.answer).click();
    await expect(page.locator('#account-answer-feedback')).toContainText(i === 0 ? 'Not quite' : 'That’s right');
    await expect(page.locator('#account-quiz-slot .answer').first()).toBeDisabled();
    if (i===0) {
      await page.getByRole('tab',{name:'Account categories',exact:true}).click();
      await page.getByRole('tab',{name:'Quiz',exact:true}).click();
      await expect(page.locator('#account-answer-feedback')).toContainText('Not quite');
      await page.reload();
      await expect(page.locator('#account-answer-feedback')).toContainText('Not quite');
    }
    await page.getByRole('button',{name:i === 23 ? 'Finish quiz' : (i+1)%6===0 ? 'Next stage' : 'Next question'}).click();
    if (i===5) {
      await expect(page.getByRole('button',{name:'2. Translate the wording'})).toBeEnabled();
      await page.reload();
      await expect(page.locator('#account-question-heading')).toHaveText(questions[6].q);
    }
  }
  await expect(page.getByText('23 of 24 answers correct.',{exact:false})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'Review from stage 1'})).toBeVisible();
  await page.getByRole('button',{name:'Review from stage 1'}).click();
  await expect(page.locator('#account-answer-feedback')).toContainText('Not quite');
  const state = await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  expect(Object.keys(state.accountQuiz.responses)).toHaveLength(24);
  expect(state.accountQuiz.responses['ar-bank'].hint).toBe(true);
  expect(state.answers).toEqual({});
});

test('account quiz participates in backups, rejects malformed imports and resets with course progress', async ({page}) => {
  await page.goto('./#accounts/quiz');
  await page.locator('#account-quiz-slot .answer').nth(0).click();
  await page.goto('./#progress');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export progress',exact:true}).click();
  const stream = await (await downloadEvent).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.accountQuiz.responses['ar-bank'].selected).toBe(0);
  const invalid = structuredClone(backup);
  invalid.accountQuiz.responses['ar-bank'].selected = 7;
  await page.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
  await expect(page.locator('#backup-feedback')).toContainText('Import failed');
  await page.getByRole('button',{name:'Reset progress',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Reset progress',exact:true}).click();
  await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.getByRole('button',{name:'Replace progress',exact:true}).click();
  await page.goto('./#accounts/quiz');
  await expect(page.locator('#account-answer-feedback')).toContainText('That’s right');
  await page.goto('./#progress');
  await page.getByRole('button',{name:'Reset progress',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Reset progress',exact:true}).click();
  await page.goto('./#accounts/quiz');
  await expect(page.locator('#account-quiz-slot .answer').first()).toBeEnabled();
  await expect(page.getByRole('button',{name:'2. Translate the wording'})).toBeDisabled();
});
