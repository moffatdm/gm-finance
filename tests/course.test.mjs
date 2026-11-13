import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DAY, freshProgress, recordAnswer, rateAnswer, dueQuestions, moduleStats,
  confidenceScore, ledgerBalances, parseAmount, checkJournal,
  validateCourse, validateProgress, escapeHtml
} from '../assets/engine.js';

const read = async path => JSON.parse(await readFile(new URL(`../data/${path}`, import.meta.url), 'utf8'));
const course = await read('course.json');
const units = await Promise.all(course.units.map(u => read(u.file)));
const activities = await read(course.activitiesFile);
const modules = units.flatMap(u => u.modules);
const questions = modules.flatMap(m => m.questions);
const q = id => questions.find(q => q.id === id);

test('complete, linked content and 100+ original questions', () => {
  validateCourse(course, units, activities);
  const suppliedModules = units.filter(u => ['unit-2','unit-3'].includes(u.id)).flatMap(u => u.modules);
  assert.ok(suppliedModules.length >= 5 && suppliedModules.length <= 20);
  assert.ok(questions.length >= 100);
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length);
  assert.ok(modules.every(m => m.questions.some(q => q.level === 'challenge')));
  const allIds = new Set(modules.map(m => m.id));
  assert.ok(activities.journals.every(j => allIds.has(j.moduleId)));
});

test('numerical MCQ answers agree with independent workings', () => {
  const expected = {
    eq1:[12000-4500], eq7:[20000-8000-1000], de6:[300+50],
    pu5:[1200+800-900], sa4:[1000-700], sa7:[500+1800-1650],
    sa8:[400+900], fu7:[1000,30], fu8:[4000-600],
    tr7:[100+200], tg1:[(50-35)*6], tg2:[2400-1500],
    tg3:[300+1200-400], tg6:[40*(9-5)], tg7:[5000-(700+2800-900)],
    re1:[400+250-100], re7:[Math.abs(200-350)],
    pp3:[2400*6/12], pp7:[1500+200-350], pp8:[900*4/6,900*4/6],
    ac7:[8000-500+700], ac8:[2000+300-500], dp1:[(5000-500)/5],
    dp3:[8000-3200], dp7:[12000/4*3/12], dp8:[4000*.25],
    di1:[9000-6000-2500], di6:[1800-(4000-2500)],
    di7:[4600-(5000-500)], iv2:[10*2+2*3],
    iv3:[(10*2+30*4)/40], iv5:[Math.min(700,620)],
    iv7:[(20*5+10*8)/30*6], iv8:[(5*4+5*6)/10],
    pr1:[500*.04*30], pr5:[12000/3], pr7:[900-(1000-300)],
    pr8:[15000-2*(15000/5)], lo1:[150+20], lo3:[2300-2000],
    lo4:[240/24], lo5:[125-15], lo7:[1000*1.01-110],
    nt1:[4000+1500], nt2:[200+350+450], nt3:[10000+3000-2000],
    nt4:[4000+1500-800], nt5:[18000-7000], nt7:[6000-800-500],
    nt8:[(30000+4000-6000)-(12000+3000-4500)]
  };
  for (const [id, amounts] of Object.entries(expected)) {
    const option = q(id).options[q(id).answer];
    const actual = [...option.matchAll(/£([\d,]+(?:\.\d+)?)/g)].map(m => Number(m[1].replaceAll(',', '')));
    assert.deepEqual(actual, amounts, `${id}: ${option}`);
  }
});

test('accounting guardrails are explicit and not silently taught as universal rules', () => {
  assert.equal(q('tr2').options[q('tr2').answer], 'A distribution of equity');
  assert.equal(q('iv4').options[q('iv4').answer], 'No');
  assert.match(modules.find(m => m.id === 'loans').watch, /effective interest/);
  assert.match(course.scope, /not past papers/);
  assert.match(course.book.note, /other Frank Wood titles and editions/);
});

test('all configured journal answers balance and checker rejects wrong-account balanced entries', () => {
  for (const j of activities.journals) {
    const lines = j.expected.map(l => ({ account:l.account, side:l.dr ? 'dr':'cr', amount:l.dr || l.cr }));
    assert.equal(checkJournal(lines.reverse(), j.expected).correct, true, j.id);
    lines[0].account = 'Unrelated account';
    assert.equal(checkJournal(lines, j.expected).correct, false, j.id);
  }
  const expected = activities.journals[0].expected;
  assert.equal(checkJournal([{account:'Bank',side:'dr',amount:1500},{account:'Bank',side:'dr',amount:1000},{account:'Capital',side:'cr',amount:2500}], expected).correct, true);
  assert.match(checkJournal([{account:'Bank',side:'dr',amount:20},{account:'Capital',side:'cr',amount:10}], expected).message, /Not balanced/);
});

test('amount entry handles pence and rejects empty, negative, nonfinite or overprecise values', () => {
  assert.equal(parseAmount('12.34'), 1234);
  assert.equal(parseAmount('0'), 0);
  for (const value of ['', ' ', '-1', 'Infinity', 'NaN', '12.345', 'hello']) assert.equal(parseAmount(value), null, value);
  assert.equal(checkJournal([{account:'Bank',side:'dr',amount:0},{account:'Capital',side:'cr',amount:0}], activities.journals[0].expected).correct, false);
});

test('all ledger balances are independently calculated, including overdrafts and disposal closing', () => {
  const expected = {
    'l-bank':[3000,2550,3150,2250,750],
    'l-payables':[-1300,-600,-850,0],
    'l-overdraft':[-200,-100,-250,350],
    'l-disposal':[6000,2000,500,0]
  };
  for (const l of activities.ledgers) if (expected[l.id]) assert.deepEqual(ledgerBalances(l), expected[l.id]);
});

test('trial balances agree at independently checked totals', () => {
  const totals = { 'tb-start':10400, 'tb-adjusted':15800, 'tb-overdraft':4850 };
  for (const tb of activities.trialBalances) {
    if (!totals[tb.id]) continue;
    for (const side of ['dr','cr']) assert.equal(tb.balances.filter(b => b.side === side).reduce((sum,b) => sum+b.amount,0), totals[tb.id]);
  }
});

test('spaced repetition distinguishes incorrect, unsure and confident, and rating does not add attempts', () => {
  const now = 1000000;
  const missed = recordAnswer(null, false, 3, now);
  assert.equal(missed.due, now+600000);
  assert.equal(missed.streak, 0);
  const unsure = recordAnswer(null, true, 1, now);
  assert.equal(unsure.due, now+DAY);
  const answer = recordAnswer(null, true, 2, now);
  const confident = rateAnswer(answer, 3);
  assert.equal(confident.due, now+3*DAY);
  assert.equal(confident.attempts, 1);
  const again = recordAnswer(confident, true, 3, now+3*DAY);
  assert.equal(again.due, now+10*DAY);
  const fail = recordAnswer(again, false, 2, now+10*DAY);
  assert.equal(fail.streak, 0);
  assert.equal(fail.attempts, 3);
});

test('due queue orders by deadline, excludes new/future questions and uses exact boundary', () => {
  const p = freshProgress();
  p.answers.eq1 = { ...recordAnswer(null,false,1,1000), due:50 };
  p.answers.eq2 = { ...recordAnswer(null,false,1,1000), due:25 };
  p.answers.eq3 = { ...recordAnswer(null,true,3,1000), due:51 };
  assert.deepEqual(dueQuestions(questions,p,50).map(q => q.id), ['eq2','eq1']);
});

test('completion requires reading and all attempts; accuracy is latest; confidence is separate', () => {
  const p = freshProgress(), m = modules[0];
  assert.equal(confidenceScore(questions,p), null);
  for (const q of m.questions) p.answers[q.id] = recordAnswer(null,true,3,1000);
  assert.equal(moduleStats(m,p).complete, false);
  p.read.push(m.id);
  assert.equal(moduleStats(m,p).complete, true);
  p.answers.eq1 = recordAnswer(p.answers.eq1,false,1,2000);
  assert.equal(moduleStats(m,p).correct, 7);
  assert.equal(confidenceScore(questions,p), 88);
});

test('validated backup round-trips progress, quiz state, practice and written drafts', () => {
  const p = freshProgress();
  p.mode = 'new'; p.read = [modules[0].id];
  p.answers.eq1 = recordAnswer(null,true,2,1000);
  p.practice['j-owner'] = true;
  p.drafts['ex-trader:a'] = '<script>not executable</script>';
  p.activeQuiz = { key:'equation:new', ids:['eq1','eq2'], index:1, responses:{eq1:{selected:1,hint:true,confidence:2}} };
  assert.deepEqual(validateProgress(JSON.parse(JSON.stringify(p)),modules,activities),p);
  assert.equal(escapeHtml(p.drafts['ex-trader:a']), '&lt;script&gt;not executable&lt;/script&gt;');
});

test('bad backups and inconsistent resumed quiz state are rejected before replacement', () => {
  for (const bad of [null, [], {}, {...freshProgress(),version:2}, {...freshProgress(),answers:{eq1:{correct:true}}}, {...freshProgress(),activeQuiz:{key:'all:standard',ids:['eq1'],index:1,responses:{}}}]) {
    assert.throws(() => validateProgress(bad,modules,activities), /valid version 1/);
  }
  const p = freshProgress();
  p.activeQuiz = { key:'all:standard',ids:['eq1'],index:0,responses:{eq1:{hint:true,selected:1,confidence:null}} };
  assert.throws(() => validateProgress(p,modules,activities));
});

test('a later unit can be added solely through configuration', () => {
  const extendedCourse = structuredClone(course), extendedUnits = structuredClone(units);
  extendedCourse.units.push({id:'unit-4',title:'Later',subtitle:'Unit 4',file:'unit-4.json'});
  const module = structuredClone(modules[0]);
  module.id = 'later-topic';
  module.questions = module.questions.map((q,i) => ({...q,id:`later-q${i+1}`}));
  extendedUnits.push({id:'unit-4',modules:[module]});
  validateCourse(extendedCourse,extendedUnits,activities);
  const p = freshProgress(); p.answers.eq1 = recordAnswer(null,true,2,1000);
  assert.deepEqual(validateProgress(p,extendedUnits.flatMap(u => u.modules),activities).answers,p.answers);
});

test('bad content is surfaced instead of quietly dropping questions', () => {
  const bad = structuredClone(units);
  bad[0].modules[0].questions[0].answer = 4;
  assert.throws(() => validateCourse(course,bad,activities), /invalid question eq1/);
  const unbalanced = structuredClone(activities);
  unbalanced.trialBalances[0].balances[0].amount++;
  assert.throws(() => validateCourse(course,units,unbalanced), /unbalanced trial balance/);
});
