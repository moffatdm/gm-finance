import { escapeHtml as e } from './engine.js';

export function validateAccountReference(config, activities) {
  const fail = message => { throw new Error(`Account reference configuration: ${message}`); };
  const groupIds = ['assets', 'equity', 'liabilities', 'revenue', 'expenses'];
  if (!Array.isArray(config?.groups) || config.groups.length !== groupIds.length || !Array.isArray(config.specialAccounts)) fail('five groups and special accounts are required.');
  const names = new Set();
  for (const [i, group] of config.groups.entries()) {
    if (group.id !== groupIds[i] || !group.title || !group.description || !group.accounts?.length) fail('invalid account group.');
  }
  for (const account of [...config.groups.flatMap(g => g.accounts), ...config.specialAccounts]) {
    if (!account.name || names.has(account.name) || !account.balance || !account.meaning || !account.clues || (account.aliases && (!Array.isArray(account.aliases) || account.aliases.some(a => typeof a !== 'string' || !a)))) fail('incomplete or duplicate account.');
    names.add(account.name);
  }
  const required = new Set([
    ...activities.accounts,
    ...activities.journals.flatMap(j => j.expected.map(line => line.account)),
    ...activities.ledgers.map(l => l.account),
    ...activities.trialBalances.flatMap(tb => tb.balances.map(b => b.account))
  ]);
  for (const name of required) if (!names.has(name)) fail(`missing exercise account "${name}".`);
}

function accountTable(accounts, caption) {
  return `<div class="scroll-table" role="region" aria-label="${e(caption)}" tabindex="0"><table class="account-reference-table">
    <caption>${e(caption)}</caption>
    <thead><tr><th scope="col">Account name in the site</th><th scope="col">What it represents</th><th scope="col">Clues in the transaction</th><th scope="col">Normal balance</th></tr></thead>
    <tbody>${accounts.map(a => `<tr><th scope="row"><span class="account-name">${e(a.name)}</span>${a.aliases?.length ? `<span class="account-aliases">Also called: ${a.aliases.map(e).join('; ')}</span>` : ''}</th><td>${e(a.meaning)}</td><td>${e(a.clues)}</td><td>${e(a.balance)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

export function accountReferencePage(config, tab = 'overview', quizHtml = '') {
  const tabs = [['overview', 'Overview'], ['categories', 'Account categories'], ['quiz', 'Quiz']];
  return `<div class="breadcrumb"><a href="#fundamentals">Fudamentals</a> / Account reference</div>
    <div class="page-head"><div><span class="eyebrow">FROM THE STORY TO THE ACCOUNT</span><h1>Which account do I choose?</h1><p>A reference for every account in the journal dropdown, ledgers and trial balances, plus account names used in the lessons. Match the meaning first; choose Dr or Cr second.</p></div></div>
    <div class="reference-tabs" role="tablist" aria-label="Account reference">${tabs.map(([id, title]) => `<button role="tab" id="account-tab-${id}" aria-controls="account-panel-${id}" aria-selected="${tab === id}" tabindex="${tab === id ? '0' : '-1'}" data-account-tab="${id}">${title}</button>`).join('')}</div>
    <div role="tabpanel" id="account-panel-overview" aria-labelledby="account-tab-overview" tabindex="0" ${tab === 'overview' ? '' : 'hidden'}>
    <div class="callout"><strong>Read “we” as the business.</strong> “Receivable” means owed TO us; “payable” means owed BY us. “Income” means earned by us; “expense” means a cost we used. An account's category is not determined by whether cash moved.</div>
    <section class="card worked-example" aria-labelledby="narrative-example"><span class="eyebrow">TRANSLATE THE WORDS, ONE PIECE AT A TIME</span><h2 id="narrative-example">Electricity used, but not yet billed or paid</h2>
    <p>“At year-end, £275 of electricity has been used but not yet billed, paid or recorded. Enter the adjustment.”</p>
    <ol class="steps"><li><strong>“Electricity has been used”</strong> → a cost belongs to this year → <strong>Electricity expense (Expense)</strong>.</li><li><strong>“Not yet billed, paid or recorded”</strong> → we still owe for that cost and it is missing from the accounts → <strong>Accruals (Liability)</strong>.</li><li>Increase the expense with <strong>Dr Electricity expense £275</strong>. Increase the liability with <strong>Cr Accruals £275</strong>.</li><li>There is no payment now, so <strong>no Bank entry</strong>. In this exercise the bill is still missing, so use Accruals rather than a recorded supplier invoice in Trade payables.</li></ol>
    <div class="formula">What was used or earned? What is still owed, held or paid in advance? Those answers identify the accounts.</div><a class="text-link" href="#journal/j-accrual">Try this journal →</a></section>
    <p>Start by identifying what was used, earned, received or still owed. Then use the <strong>Account categories</strong> tab to choose specific names. When ready, the <strong>Quiz</strong> tab builds this skill in four stages.</p></div>
    <div role="tabpanel" id="account-panel-categories" aria-labelledby="account-tab-categories" tabindex="0" ${tab === 'categories' ? '' : 'hidden'}>
    <div class="account-category-guide">
    <p class="small muted">The five headings below are the main families. “Normal balance” means the usual balance, not an instruction to always debit or credit that account. A decrease uses the opposite side. Accumulated depreciation, drawings and dividends have deliberately highlighted exceptions. Extra lesson names appear as separate rows or “also called” labels.</p>
    <div class="button-row" role="group" aria-label="Jump to account category">${config.groups.map(g => `<button class="btn secondary small" data-account-section="${e(g.id)}">${e(g.title)}</button>`).join('')}<button class="btn outline small" data-account-section="special">Disposal: special case</button></div>
    </div>
    ${config.groups.map(g => `<section class="lesson-section" id="account-group-${e(g.id)}" tabindex="-1" aria-labelledby="heading-${e(g.id)}"><h2 id="heading-${e(g.id)}">${e(g.title)}</h2><p>${e(g.description)}</p>${accountTable(g.accounts, `${g.title}: account names, meanings and narrative clues`)}</section>`).join('')}
    <section class="lesson-section" id="account-group-special" tabindex="-1" aria-labelledby="heading-special"><h2 id="heading-special">Special case: a temporary clearing account</h2><p>Forcing Disposal into one of the five families would be misleading. Its final gain or loss belongs in the relevant income or expense account.</p>${accountTable(config.specialAccounts, 'Disposal: why this account is different')}</section>
    <div class="callout"><strong>Common near-matches:</strong> Prepayments = an asset; income received in advance = a liability. Accrued income = an asset; Accruals = a liability. Depreciation expense = this year's cost; accumulated depreciation = the total reduction against asset cost. Loan principal is not interest. Preference shares, mentioned in the fundamentals terminology guide, may be equity or liabilities depending on their terms, so their name alone is not enough.</div>
    <a class="text-link" href="#fundamentals/account-types">Revisit the five account types →</a></div>
    <div role="tabpanel" id="account-panel-quiz" aria-labelledby="account-tab-quiz" tabindex="0" ${tab === 'quiz' ? '' : 'hidden'}><div id="account-quiz-slot">${quizHtml}</div></div>`;
}
