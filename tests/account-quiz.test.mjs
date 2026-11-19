import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateAccountQuiz, accountQuizQuestions, stageUnlocked, accountQuizMarkup } from '../assets/account-quiz.js';
import { freshProgress, validateProgress } from '../assets/engine.js';

const read = async name => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const course = await read('course.json');
const config = await read(course.accountQuizFile);
const activities = await read(course.activitiesFile);
const modules = (await Promise.all(course.units.map(u => read(u.file)))).flatMap(u => u.modules);
const questions = accountQuizQuestions(config);

test('four stages move from names to multi-step narrative judgement with one hint and explanation per question', () => {
  validateAccountQuiz(config);
  assert.equal(config.stages.length, 4);
  assert.equal(questions.length, 24);
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length);
  assert.ok(config.stages.every(s => s.questions.length === 6));
  const answer = id => { const q = questions.find(q => q.id === id); return q.options[q.answer]; };
  assert.equal(answer('ar-electricity-pair'), 'Dr Electricity expense £275; Cr Accruals £275');
  assert.equal(answer('ar-disposal-result'), 'Loss on disposal £200 (expense)');
  assert.equal(answer('ar-two-adjustments'), 'Accruals liability £275 and Prepayments asset £120; net profit falls £155');
});

test('stages unlock after all previous answers, including incorrect ones, not after just using hints', () => {
  const state = freshProgress().accountQuiz;
  assert.equal(stageUnlocked(config, state, 0), true);
  assert.equal(stageUnlocked(config, state, 1), false);
  for (const q of config.stages[0].questions) state.responses[q.id] = { hint: true, selected: null };
  assert.equal(stageUnlocked(config, state, 1), false);
  for (const q of config.stages[0].questions) state.responses[q.id].selected = (q.answer + 1) % 4;
  assert.equal(stageUnlocked(config, state, 1), true);
  assert.equal(stageUnlocked(config, state, 2), false);
});

test('account quiz answers, hints and cursor survive export/import without modifying lesson results', () => {
  const progress = freshProgress();
  for (const q of config.stages[0].questions) progress.accountQuiz.responses[q.id] = { hint: true, selected: q.answer };
  progress.accountQuiz.index = 6;
  const restored = validateProgress(JSON.parse(JSON.stringify(progress)), modules, activities, config);
  assert.deepEqual(restored, progress);
  assert.deepEqual(restored.answers, {});
  assert.equal(accountQuizMarkup(config, restored.accountQuiz).includes('STAGE 2 OF 4'), true);
});

test('old backups migrate to an empty account quiz and invalid answers or skipped cursors are rejected', () => {
  const old = freshProgress();
  delete old.accountQuiz;
  assert.deepEqual(validateProgress(old, modules, activities, config).accountQuiz, { index:0, responses:{} });
  for (const quiz of [
    {index:25,responses:{}}, {index:1,responses:{}},
    {index:0,responses:{'ar-bank':{hint:true,selected:4}}},
    {index:0,responses:{'ar-bank':{hint:'yes',selected:null}}},
    {index:0,responses:{'unknown':{hint:false,selected:0}}}
  ]) {
    assert.throws(() => validateProgress({...old, accountQuiz:quiz}, modules, activities, config), /valid version 1/);
  }
});

test('completion retains all original answers and review remains available', () => {
  const state = freshProgress().accountQuiz;
  for (const q of questions) state.responses[q.id] = {hint:false,selected:q.answer};
  state.index = questions.length;
  const html = accountQuizMarkup(config,state);
  assert.ok(html.includes('24 of 24 answers correct'));
  assert.ok(html.includes('Review from stage 1'));
  assert.equal(stageUnlocked(config,state,3),true);
});
