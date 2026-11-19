import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const read = async path => JSON.parse(await readFile(new URL(`../../data/${path}`, import.meta.url), 'utf8'));
const course = await read('course.json');
const units = await Promise.all(course.units.map(u => read(u.file)));
const modules = units.flatMap(u => u.modules);
const activities = await read(course.activitiesFile);
const key = 'accounting-understood:v1';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name:'You can make sense of this.' })).toBeVisible();
  page.on('close', () => expect(errors).toEqual([]));
});

test('home, all lessons and modes work under a repository subpath', async ({page}, testInfo) => {
  await page.screenshot({path:`test-results/home-${testInfo.project.name}.png`,fullPage:true});
  await page.goto('./#learn');
  await expect(page.locator('.module-card')).toHaveCount(modules.length);
  await page.getByRole('button',{name:"I'm new to accounting",exact:true}).click();
  for (const module of modules) {
    await page.goto(`./#lesson/${module.id}`);
    await expect(page.getByRole('heading',{name:module.title,exact:true})).toBeVisible();
    await expect(page.locator('.new-explanation')).toHaveCount(module.sections.length);
    await expect(page.getByRole('heading',{name:'A worked example',exact:true})).toBeVisible();
    await expect(page.getByText(`Chapters ${module.reading.chapters}`,{exact:true})).toBeVisible();
  }
  await page.goto('./#lesson/equation');
  await page.getByRole('button',{name:'Challenge me',exact:true}).click();
  await page.getByRole('link',{name:'Try the questions'}).click();
  await expect(page.getByText('QUESTION 1 OF 2',{exact:true})).toBeVisible();
  await expect(page.getByText('✦ Applied thinking',{exact:true})).toBeVisible();
  await page.goto('./#guide');
  await expect(page.getByRole('heading',{name:'Your Frank Wood reading guide',exact:true})).toBeVisible();
  await expect(page.getByText(/16th edition \(2025\)/).first()).toBeVisible();
});

test('one hint, feedback, confidence, quiz resume and module completion persist', async ({page}) => {
  const module = modules[0];
  await page.goto('./#lesson/equation');
  await page.getByRole('button',{name:'Mark lesson as read',exact:true}).click();
  await page.getByRole('link',{name:'Try the questions'}).click();
  await page.getByRole('button',{name:'A little hint'}).click();
  await expect(page.getByRole('button',{name:'Hint used'})).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button',{name:'Hint used'})).toBeDisabled();
  for (let i=0;i<module.questions.length;i++) {
    await expect(page.getByText(`QUESTION ${i+1} OF 8`,{exact:true})).toBeVisible();
    await page.locator('.answer').nth(module.questions[i].answer).click();
    await expect(page.locator('#quiz-feedback')).toContainText('That’s right');
    await expect(page.getByRole('button',{name:i===7?'Finish this session':'Next question'})).toBeDisabled();
    await page.getByRole('button',{name:'Feeling confident',exact:true}).click();
    await page.getByRole('button',{name:i===7?'Finish this session':'Next question'}).click();
  }
  await expect(page.getByRole('heading',{name:'Practice, not perfection.'})).toBeVisible();
  await page.goto('./#progress');
  await expect(page.locator('.progress-row').first()).toContainText('Complete');
  await expect(page.locator('.stat').nth(2)).toContainText('100%');
  await page.reload();
  await expect(page.locator('.progress-row').first()).toContainText('Complete');
  const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)),key);
  expect(saved.answers.eq1.attempts).toBe(1);
  expect(saved.answers.eq1.confidence).toBe(3);
  expect(saved.activeQuiz.responses.eq1.hint).toBe(true);
});

test('missed answers enter due revision and return to it after other practice', async ({page}) => {
  await page.clock.install();
  await page.goto('./#quiz/equation');
  await page.locator('.answer').nth(0).click();
  await expect(page.locator('#quiz-feedback')).toContainText('Not quite');
  await page.getByRole('button',{name:'Still unsure',exact:true}).click();
  await page.clock.fastForward(601000);
  await page.goto('./#revision');
  await expect(page.getByRole('heading',{name:'1 question is ready to revisit.'})).toBeVisible();
  await page.getByRole('button',{name:'Start a short revision'}).click();
  await expect(page.getByText('QUESTION 1 OF 1',{exact:true})).toBeVisible();
  await page.goto('./#quiz/sales');
  await page.goto('./#revision/run');
  await expect(page.getByText('QUESTION 1 OF 1',{exact:true})).toBeVisible();
  await page.locator('.answer').nth(1).click();
  await page.getByRole('button',{name:'Getting there',exact:true}).click();
  await page.getByRole('button',{name:'Finish this session'}).click();
  await page.goto('./#revision');
  await expect(page.getByRole('heading',{name:'Nothing due right now. Breathe easy.'})).toBeVisible();
});

test('journal builder checks blank, unbalanced and balanced-but-wrong compound entries', async ({page}) => {
  await page.goto('./#journal/j-loan');
  await page.getByRole('button',{name:'Check my work',exact:true}).click();
  await expect(page.locator('#activity-feedback')).toContainText('Choose an account');
  await page.getByRole('button',{name:'+ Add a line',exact:true}).click();
  const fill = async (i,account,side,amount) => {
    await page.locator(`#account-${i}`).selectOption(account);
    await page.locator(`#side-${i}`).selectOption(side);
    await page.locator(`#amount-${i}`).fill(String(amount));
  };
  await fill(0,'Loan payable','dr',200);
  await fill(1,'Interest expense','dr',20);
  await fill(2,'Bank','cr',210);
  await page.getByRole('button',{name:'Check my work',exact:true}).click();
  await expect(page.locator('#activity-feedback')).toContainText('Not balanced');
  await page.locator('#amount-2').fill('220');
  await page.locator('#account-1').selectOption('Drawings');
  await page.getByRole('button',{name:'Check my work',exact:true}).click();
  await expect(page.locator('#activity-feedback')).toContainText('It balances, but');
  await page.locator('#account-1').selectOption('Interest expense');
  await page.getByRole('button',{name:'One hint available',exact:true}).click();
  await expect(page.getByRole('button',{name:'Hint used'})).toBeDisabled();
  await page.getByRole('button',{name:'Check my work',exact:true}).click();
  await expect(page.locator('#activity-feedback')).toContainText('correctly posted');
  await page.reload();
  await expect(page.locator('#activity-select option:checked')).toHaveText(/✓ Split the repayment/);
});

test('ledgers handle overdrafts, nil balances and show solutions without marking completion', async ({page}) => {
  await page.goto('./#ledger/l-overdraft');
  await page.getByRole('button',{name:'Show worked solution',exact:true}).click();
  await expect(page.locator('#activity-feedback')).toContainText('£200.00 Cr');
  const before = await page.evaluate(k => JSON.parse(localStorage.getItem(k)),key);
  expect(before.practice['l-overdraft']).toBeUndefined();
  for (const [i,amount] of [200,100,250,350].entries()) {
    await page.getByLabel(`Balance after row ${i+1}`,{exact:true}).fill(String(amount));
    await page.getByLabel(`Balance side after row ${i+1}`,{exact:true}).selectOption(i===3?'dr':'cr');
  }
  await page.getByRole('button',{name:'Check my work',exact:true}).click();
  await expect(page.locator('#activity-feedback')).toContainText('Every running balance is correct');
  await page.goto('./#ledger/l-disposal');
  for (const [i,amount] of [6000,2000,500,0].entries()) await page.getByLabel(`Balance after row ${i+1}`,{exact:true}).fill(String(amount));
  await page.getByRole('button',{name:'Check my work',exact:true}).click();
  await expect(page.locator('#activity-feedback')).toContainText('Every running balance is correct');
});

test('trial balance requires correct balances, not merely equal totals', async ({page}) => {
  const activity = activities.trialBalances[1];
  await page.goto(`./#trial/${activity.id}`);
  for (const balance of activity.balances) {
    await page.getByLabel(`${balance.account} amount`,{exact:true}).fill(String(balance.amount));
    await page.getByLabel(`${balance.account} column`,{exact:true}).selectOption(balance.side);
  }
  await expect(page.locator('#trial-totals')).toContainText('£15,800.00');
  await page.getByLabel('Bank amount',{exact:true}).fill('2100');
  await page.getByLabel('Capital amount',{exact:true}).fill('8100');
  await page.getByRole('button',{name:'Check my work',exact:true}).click();
  await expect(page.locator('#activity-feedback')).toContainText('Matching totals alone is not enough');
  await page.getByLabel('Bank amount',{exact:true}).fill('2000');
  await page.getByLabel('Capital amount',{exact:true}).fill('8000');
  await page.getByRole('button',{name:'Check my work',exact:true}).click();
  await expect(page.locator('#activity-feedback')).toContainText('Every account is correctly placed');
});

test('written exam answers persist and solutions remain self-marked', async ({page}) => {
  await page.goto('./#exam/ex-timing');
  await page.locator('#draft-a').fill('£2,400 / 12 = £200 per month. Eight unused months = £1,600.');
  await page.reload();
  await expect(page.locator('#draft-a')).toHaveValue(/£1,600/);
  await page.locator('summary').first().click();
  await expect(page.locator('.solution').first()).toContainText('£1,600');
  await expect(page.getByText('There is no automatic grading',{exact:false})).toBeVisible();
});

test('invalid backups, export and confirmed reset preserve user control', async ({page}) => {
  await page.goto('./#lesson/equation');
  await page.getByRole('button',{name:'Mark lesson as read',exact:true}).click();
  await page.goto('./#progress');
  await page.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await expect(page.locator('#backup-feedback')).toContainText('Import failed');
  await expect(page.locator('.progress-row').first()).toContainText('Read');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export progress',exact:true}).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.read).toContain('equation');
  await page.getByRole('button',{name:'Reset progress',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.locator('.progress-row').first()).toContainText('Read');
  await page.getByRole('button',{name:'Reset progress',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Reset progress',exact:true}).click();
  await expect(page.locator('.progress-row').first()).toContainText('Not yet marked read');
  await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  await page.getByRole('button',{name:'Replace progress',exact:true}).click();
  await expect(page.locator('#backup-feedback')).toContainText('Backup restored');
  await expect(page.locator('.progress-row').first()).toContainText('Read');
});

test('blocked storage and corrupt saved data show explicit warnings', async ({page}) => {
  await page.evaluate(k => localStorage.setItem(k,'{bad json'),key);
  await page.reload();
  await expect(page.locator('#storage-notice')).toContainText('could not be read');
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('{bad json');
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('blocked','SecurityError'); }; });
  await page.reload();
  await expect(page.locator('#storage-notice')).toBeVisible();
  await page.goto('./#quiz/equation');
  await page.locator('.answer').nth(1).click();
  await expect(page.locator('#quiz-feedback')).toContainText('That’s right');
});

test('a second tab cannot silently overwrite the first tab’s work', async ({page,context}) => {
  await page.goto('./#lesson/equation');
  await page.getByRole('button',{name:'Mark lesson as read',exact:true}).click();
  const other = await context.newPage();
  await other.goto('./#progress');
  await expect(other.locator('.progress-row').first()).toContainText('Read');
  await other.goto('./#lesson/purchases');
  await other.getByRole('button',{name:'Mark lesson as read',exact:true}).click();
  await expect(page.locator('#storage-notice')).toContainText('Progress changed in another tab');
  await page.goto('./#lesson/sales');
  await page.getByRole('button',{name:'Mark lesson as read',exact:true}).click();
  const saved = await other.evaluate(k => JSON.parse(localStorage.getItem(k)),key);
  expect(saved.read).toContain('equation');
  expect(saved.read).not.toContain('sales');
  await other.close();
});

test('small phones and intermediate widths do not overflow the page', async ({page},testInfo) => {
  test.skip(testInfo.project.name === 'mobile','Desktop Chromium can resize across all breakpoint widths.');
  for (const width of [320,375,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    for (const hash of ['home','lesson/valuation','journal/j-loan','trial/tb-adjusted']) {
      await page.goto(`./#${hash}`);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth+1),`${width}px: ${hash}`).toBe(true);
    }
  }
});

test('Fudamentals opens four ordered subpages with working PDF links', async ({page}) => {
  await page.getByRole('link',{name:'Fudamentals',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Fudamentals',exact:true})).toBeVisible();
  await expect(page.locator('.module-card h2')).toHaveText(['Debits & Credits','Account Types','The Ledger','Financial Statements']);
  const config = await read('fundamentals.json');
  for (const foundation of config.pages) {
    await page.goto(`./#fundamentals/${foundation.id}`);
    await expect(page.getByRole('heading',{name:foundation.title,exact:true})).toBeVisible();
    await expect(page.locator('[data-nav="fundamentals"]')).toHaveAttribute('aria-current','page');
    const pdf = page.getByRole('link',{name:`Open PDF: ${foundation.order}. ${foundation.title}`});
    await expect(pdf).toHaveAttribute('target','_blank');
    const response = await page.request.get(await pdf.getAttribute('href'));
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/pdf');
    expect((await response.body()).subarray(0,5).toString()).toBe('%PDF-');
    await page.getByRole('button',{name:"I'm new to accounting",exact:true}).click();
    await expect(page.locator('.new-explanation')).toHaveCount(foundation.sections.length);
    await page.getByRole('button',{name:'Step by step',exact:true}).click();
    await expect(page.locator('.new-explanation')).toHaveCount(0);
  }
  await page.goto('./#fundamentals/debits-credits');
  await page.locator('.foundation-pagination').getByRole('link',{name:'2. Account Types'}).click();
  await expect(page).toHaveURL(/#fundamentals\/account-types$/);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Account Types',exact:true})).toBeVisible();
  await page.goto('./#fundamentals/missing');
  await expect(page.getByRole('heading',{name:'That page isn’t here.'})).toBeVisible();
});

test('account reference covers exercise accounts, explains the narrative and preserves journal work', async ({page,context}) => {
  await page.goto('./#fundamentals');
  await page.getByRole('link',{name:'Open the account reference'}).click();
  await expect(page.getByRole('heading',{name:'Which account do I choose?',exact:true})).toBeVisible();
  await expect(page.locator('[data-nav="fundamentals"]')).toHaveAttribute('aria-current','page');
  const config = await read(course.accountReferenceFile);
  const names = [...config.groups.flatMap(g => g.accounts), ...config.specialAccounts].map(a => a.name);
  await expect(page.locator('.account-name')).toHaveText(names);
  expect([...activities.accounts, 'Bank (overdraft)'].every(name => names.includes(name))).toBe(true);
  await page.getByRole('tab',{name:'Account categories',exact:true}).click();
  await page.getByRole('button',{name:'Liabilities',exact:true}).click();
  await expect(page.locator('#account-group-liabilities')).toBeFocused();
  await expect(page.locator('#account-group-liabilities')).toContainText('Accruals');
  await page.getByRole('tab',{name:'Overview',exact:true}).click();
  await expect(page.locator('#narrative-example').locator('..')).toContainText('no Bank entry');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Which account do I choose?',exact:true})).toBeVisible();
  await page.goto('./#journal/j-accrual');
  await page.locator('#account-0').selectOption('Electricity expense');
  await page.locator('#amount-0').fill('275');
  const opened = context.waitForEvent('page');
  await page.getByRole('link',{name:'Which account do I choose? Open the account reference (new tab)'}).click();
  const reference = await opened;
  await expect(reference.getByRole('heading',{name:'Which account do I choose?',exact:true})).toBeVisible();
  await reference.close();
  await expect(page.locator('#account-0')).toHaveValue('Electricity expense');
  await expect(page.locator('#amount-0')).toHaveValue('275');
});

test('mobile layout, keyboard access and WCAG automated checks cover key screens', async ({page}, testInfo) => {
  for (const hash of ['home','accounts','accounts/categories','accounts/quiz','fundamentals','fundamentals/account-types','learn','lesson/prepayments','quiz/equation','journal/j-loan','ledger/l-overdraft','trial/tb-adjusted','exam/ex-timing','progress','guide']) {
    await page.goto(`./#${hash}`);
    await expect(page.locator('h1')).toBeVisible();
    const overflow = await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+1);
    expect(overflow,`page overflow on ${hash}`).toBe(false);
    const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(results.violations.map(v=>({id:v.id,description:v.description,nodes:v.nodes.map(n=>n.target)})),`accessibility on ${hash}`).toEqual([]);
  }
  await page.goto('./#home');
  await page.reload();
  await expect(page.getByRole('heading',{name:'You can make sense of this.'})).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await expect(page.getByRole('heading',{name:'You can make sense of this.'})).toBeVisible();
  if (testInfo.project.name === 'mobile') {
    await page.screenshot({path:'test-results/mobile-verified.png',fullPage:true});
  }
});
