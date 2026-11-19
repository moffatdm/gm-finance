import { escapeHtml as e } from './engine.js';

export function validateAccountQuiz(config) {
  const ids = new Set();
  const fail = () => { throw new Error('Account quiz configuration: invalid stages or questions.'); };
  if (!Array.isArray(config?.stages) || !config.stages.length) fail();
  for (const stage of config.stages) {
    if (!stage.id || ids.has(stage.id) || !stage.title || !stage.description || !stage.questions?.length) fail();
    ids.add(stage.id);
    for (const q of stage.questions) {
      if (!/^[a-z0-9-]+$/.test(q.id) || ids.has(q.id) || !q.q || q.options?.length !== 4 || new Set(q.options).size !== 4 || q.options.some(o => typeof o !== 'string' || !o) || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3 || !q.hint || !q.explain) fail();
      ids.add(q.id);
    }
  }
}

export function accountQuizQuestions(config) {
  return config.stages.flatMap(stage => stage.questions);
}

export function stageUnlocked(config, state, index) {
  return config.stages.slice(0, index).every(stage => stage.questions.every(q => state.responses[q.id]?.selected != null));
}

export function accountQuizMarkup(config, state) {
  const questions = accountQuizQuestions(config);
  const attempted = questions.filter(q => state.responses[q.id]?.selected != null);
  const correct = attempted.filter(q => state.responses[q.id].selected === q.answer).length;
  const stages = `<div class="filters account-quiz-stages" role="group" aria-label="Quiz stages">${config.stages.map((stage, i) => {
    const done = stage.questions.every(q => state.responses[q.id]?.selected != null);
    const active = questions.slice(state.index, state.index + 1).some(q => stage.questions.includes(q));
    return `<button data-action="account-stage" data-stage="${i}" ${stageUnlocked(config, state, i) ? '' : 'disabled'} aria-pressed="${active}">${i + 1}. ${e(stage.title)}${done ? ' ✓' : ''}</button>`;
  }).join('')}</div>`;
  const intro = `<h2>Your account-decoding quiz</h2><p>Four stages, from account names to multi-step stories. Answer every question in a stage to unlock the next; mistakes do not lock you out. Each question has one optional hint. Answers, used hints and your place save as you go on this device.</p><p class="small muted">${attempted.length} of ${questions.length} answered · ${correct} correct. Separate from lesson quiz scores and revision. Review earlier answers whenever you like. Use My progress to export a backup or reset all progress.</p>`;
  if (state.index === questions.length) {
    return `${intro}${stages}<section class="card quiz-result"><span class="eyebrow">ALL STAGES EXPLORED</span><h2>You have worked from names to narratives.</h2><p>${correct} of ${questions.length} answers correct. Revisit the explanations for the tricky ones; finishing is not the same as mastery.</p><button class="btn" data-action="account-stage" data-stage="0">Review from stage 1</button></section>`;
  }
  const q = questions[state.index];
  const stageIndex = config.stages.findIndex(stage => stage.questions.includes(q));
  const stage = config.stages[stageIndex];
  const response = state.responses[q.id] || { selected: null, hint: false };
  const answered = response.selected !== null;
  const correctAnswer = response.selected === q.answer;
  const lastInStage = stage.questions.at(-1) === q;
  return `${intro}${stages}<section class="card question-card"><div class="question-top"><span>STAGE ${stageIndex + 1} OF ${config.stages.length} · QUESTION ${stage.questions.indexOf(q) + 1} OF ${stage.questions.length}</span><span>${state.index + 1} / ${questions.length}</span></div>
    <h3>${e(stage.title)}</h3><p class="small muted">${e(stage.description)}</p><h2 id="account-question-heading" tabindex="-1">${e(q.q)}</h2>
    <div class="answers" role="group" aria-label="Account quiz answer choices">${q.options.map((option, i) => `<button class="answer ${answered && i === q.answer ? 'correct' : answered && i === response.selected ? 'incorrect' : ''}" data-action="account-answer" data-choice="${i}" ${answered ? 'disabled' : ''}><span class="answer-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span>${e(option)}${answered && i === q.answer ? ' ✓ Correct answer' : answered && i === response.selected ? ' · Your answer' : ''}</span></button>`).join('')}</div>
    ${response.hint ? `<div class="hint"><strong>Your hint:</strong> ${e(q.hint)}</div>` : ''}
    ${answered ? `<div class="feedback ${correctAnswer ? '' : 'wrong'}" id="account-answer-feedback" tabindex="-1" role="status"><strong>${correctAnswer ? 'That’s right. Here’s the reasoning.' : 'Not quite — let’s unpack the wording.'}</strong><p>${e(q.explain)}</p><p class="small">Your answer is saved. You can review it later without changing your original result.</p></div>` : ''}
    <div class="quiz-actions"><button class="text-link" data-action="account-hint" ${response.hint || answered ? 'disabled' : ''}>${response.hint ? 'Hint used · 1 of 1' : 'A little hint · 1 available'}</button><div class="button-row"><button class="btn outline" data-action="account-previous" ${state.index === 0 ? 'disabled' : ''}>Previous</button><button class="btn" data-action="account-next" ${answered ? '' : 'disabled'}>${state.index === questions.length - 1 ? 'Finish quiz' : lastInStage ? 'Next stage →' : 'Next question →'}</button></div></div></section>`;
}
