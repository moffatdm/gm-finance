import {
  STORAGE_KEY, freshProgress, pounds, escapeHtml as e, recordAnswer, rateAnswer,
  dueQuestions, moduleStats, confidenceScore, ledgerBalances, parseAmount,
  checkJournal, validateCourse, validateProgress
} from './engine.js';
import { validateFundamentals, fundamentalsIndex, fundamentalsPage } from './fundamentals.js';

const main = document.querySelector('#main');
let course, units, modules, questions, activities, progress, fundamentals;
let canSave = true;
let unitFilter = 'all';
let practiceDraft = null;
const modeNames = { standard: 'Step by step', new: "I'm new to accounting", challenge: 'Challenge me' };

function showStorageNotice(message) {
  const notice = document.querySelector('#storage-notice');
  notice.textContent = message;
  notice.hidden = false;
  document.querySelector('#save-label').textContent = 'Not saved on this device';
}

function save() {
  if (!canSave) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    document.querySelector('#save-label').textContent = 'Saved on this device';
  } catch {
    canSave = false;
    showStorageNotice('Your browser could not save progress (storage may be blocked or full). You can keep studying, but changes will be lost on refresh. Export a backup from My progress.');
  }
}

async function loadJson(path) {
  const response = await fetch(new URL(path, document.baseURI));
  if (!response.ok) throw new Error(`Could not load ${path} (HTTP ${response.status}).`);
  return response.json();
}

async function boot() {
  try {
    course = await loadJson('data/course.json');
    [units, activities, fundamentals] = await Promise.all([
      Promise.all(course.units.map(unit => loadJson(`data/${unit.file}`))),
      loadJson(`data/${course.activitiesFile}`),
      loadJson(`data/${course.fundamentalsFile}`)
    ]);
    validateCourse(course, units, activities);
    validateFundamentals(fundamentals);
    modules = units.flatMap(unit => unit.modules.map(module => ({ ...module, unitId: unit.id })));
    questions = modules.flatMap(module => module.questions.map(q => ({ ...q, moduleId: module.id, unitId: module.unitId })));
    progress = freshProgress();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) progress = validateProgress(JSON.parse(saved), modules, activities);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      canSave = false;
      showStorageNotice('Saved progress could not be read or browser storage is unavailable. The old data has not been overwritten. You can study without saving, import a valid backup, or reset storage from My progress.');
    }
    document.title = `Accounting, understood · ${course.subtitle}`;
    document.querySelector('#course-label').textContent = `${course.title} · ${course.subtitle}`;
    render();
    window.addEventListener('hashchange', () => { practiceDraft = null; render(true); });
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    window.addEventListener('storage', event => {
      if (event.key === STORAGE_KEY || event.key === null) {
        canSave = false;
        showStorageNotice('Progress changed in another tab. This tab has stopped saving to avoid overwriting it. Export any work you want to keep, then reload to use the other tab’s progress.');
      }
    });
  } catch (error) {
    main.innerHTML = `<div class="empty-state"><span class="eyebrow">Let’s get this working</span><h1>Your course could not load.</h1><p>${e(error.message)}</p><p>Serve the complete folder using a local web server, or publish it to GitHub Pages. Opening index.html directly cannot load the JSON lessons.</p><button class="btn" id="reload">Try again</button></div>`;
    document.querySelector('#reload').addEventListener('click', () => location.reload());
  }
}

function route() {
  try { return decodeURIComponent(location.hash.slice(1) || 'home').split('/'); }
  catch { return ['not-found']; }
}

function stats() {
  const attempted = questions.filter(q => progress.answers[q.id]);
  return {
    complete: modules.filter(m => moduleStats(m, progress).complete).length,
    attempted: attempted.length,
    correct: attempted.filter(q => progress.answers[q.id].correct).length,
    confidence: confidenceScore(questions, progress),
    due: dueQuestions(questions, progress).length
  };
}

function modes() {
  return `<div class="mode-switch" role="group" aria-label="Learning mode">${Object.entries(modeNames).map(([id, name]) => `<button data-action="mode" data-mode="${id}" aria-pressed="${progress.mode === id}">${e(name)}</button>`).join('')}</div>`;
}

function filters() {
  return `<div class="filters" role="group" aria-label="Filter by unit"><button data-action="filter" data-unit="all" aria-pressed="${unitFilter === 'all'}">All units</button>${course.units.map(unit => `<button data-action="filter" data-unit="${e(unit.id)}" aria-pressed="${unitFilter === unit.id}">${e(unit.subtitle.split(' · ')[0])}</button>`).join('')}</div>`;
}

function pageHead(label, title, description, extra = '') {
  return `<div class="page-head"><div><span class="eyebrow">${e(label)}</span><h1>${e(title)}</h1>${description ? `<p>${e(description)}</p>` : ''}</div>${extra}</div>`;
}

function summaryStats() {
  const s = stats();
  return `<div class="stats-grid">
    <div class="stat"><div class="stat-top">Modules complete <span class="stat-icon" aria-hidden="true">▤</span></div><strong>${s.complete} <small>/ ${modules.length}</small></strong><small>Little steps, real understanding</small></div>
    <div class="stat"><div class="stat-top">Questions explored <span class="stat-icon" aria-hidden="true">✎</span></div><strong>${s.attempted} <small>/ ${questions.length}</small></strong><small>${s.attempted ? `${Math.round(s.correct / s.attempted * 100)}% correct on latest answers` : 'Every attempt helps you learn'}</small></div>
    <div class="stat"><div class="stat-top">Your confidence <span class="stat-icon" aria-hidden="true">✳</span></div><strong>${s.confidence === null ? '—' : `${s.confidence}%`}</strong><small>${s.confidence === null ? 'Rate how sure you feel after a question' : 'Self-rated, not an exam prediction'}</small></div>
    <div class="stat"><div class="stat-top">Ready to revisit <span class="stat-icon" aria-hidden="true">↻</span></div><strong>${s.due}</strong><small>Keep ideas fresh, a few at a time</small></div>
  </div>`;
}

function homePage() {
  const next = modules.find(m => !moduleStats(m, progress).complete) || modules[0];
  const due = stats().due;
  return `${pageHead('A LITTLE PRACTICE. A LOT MORE CLARITY.', 'You can make sense of this.', 'Your calm corner for financial accounting. Build understanding one small step at a time.', '<span class="pill">✦ &nbsp; YOUR PACE. YOUR PROGRESS.</span>')}
    <section class="hero" aria-label="Continue learning"><div><span class="eyebrow">${progress.read.length ? 'YOUR NEXT SMALL STEP' : 'LET’S START WITH THE BASICS'}</span><h2>Big ideas.<br>Small, manageable steps.</h2><p>No assumed knowledge. Clear explanations, worked examples and room to try again.</p><a class="btn" href="#lesson/${e(next.id)}">${stats().attempted || progress.read.length ? 'Continue learning' : 'Start learning'} <span aria-hidden="true">→</span></a><span class="tiny-label" style="color:#d2dfc9">Up next: ${e(next.title)} · ${next.minutes} min</span></div>
    <div class="hero-art" aria-hidden="true"><div class="art-circle"></div><span class="art-star">✳</span><div class="ledger-art"><div class="art-title">ONE ENTRY AT A TIME</div><div class="art-grid"><span>Debit</span><span>Credit</span><span>£250</span><span>£250</span><span>+ clarity</span><span>− guesswork</span></div></div><span class="art-badge">It’s starting to add up. ✓</span></div></section>
    ${summaryStats()}
    <div class="two-columns"><section><div class="section-head"><div><h2>Your learning path</h2><p>A strong foundation, then the finer details.</p></div><a class="text-link" href="#learn">View all modules →</a></div>
    ${course.units.map((unit, i) => {
      const list = modules.filter(m => m.unitId === unit.id);
      const complete = list.filter(m => moduleStats(m, progress).complete).length;
      return `<article class="unit-card"><div class="unit-header"><span class="unit-symbol ${i % 2 ? 'purple' : ''}" aria-hidden="true">${i % 2 ? '◷' : '▥'}</span><div><span class="eyebrow">${e(unit.subtitle)}</span><h3>${e(unit.title)}</h3></div></div><p>${e(list.slice(0, 3).map(m => m.title).join(' · '))} and more.</p><div class="progress-track" role="progressbar" aria-label="${e(unit.title)} completion" aria-valuenow="${complete}" aria-valuemin="0" aria-valuemax="${list.length}"><span style="width:${complete / list.length * 100}%"></span></div><div class="unit-bottom"><span>${complete} of ${list.length} modules complete</span><a href="#unit/${e(unit.id)}">Explore unit →</a></div></article>`;
    }).join('')}</section>
    <aside class="dashboard-side"><div class="card revision-card"><span class="eyebrow">A LITTLE RECALL GOES A LONG WAY</span><h3>Make it stick,<br>not just make it through.</h3><p>${due ? `${due} questions are ready for a fresh look. Revisit them while the ideas are still growing.` : 'Short revision sessions bring tricky ideas back just when you need them.'}</p><a class="btn" href="#revision">Your revision space <span aria-hidden="true">↗</span></a><span class="tiny-label">Spaced repetition · Built around your answers</span></div>
    <div class="card note-card"><h3>↗ &nbsp; Meet your textbook halfway.</h3><p>Every module points you to relevant Frank Wood chapters and topics, so you know where to look next.</p><a class="text-link" href="#guide">Open the reading guide →</a></div></aside></div>`;
}

function learnPage() {
  const filtered = modules.filter(m => unitFilter === 'all' || m.unitId === unitFilter);
  return `${pageHead('YOUR LEARNING PATH', 'A little clearer, every module.', 'Read a short lesson, follow an example, then try it yourself. A module is complete when you mark it read and attempt all of its questions.')}
    ${filters()}${modes()}
    <p class="small muted">${progress.mode === 'new' ? 'Extra plain-language explanations are switched on. Start here if the vocabulary feels unfamiliar.' : progress.mode === 'challenge' ? 'Challenge mode selects the harder, applied questions in each module. All question levels are available in Step by step.' : 'Step by step includes the full question set, with harder questions towards the end.'}</p>
    <div class="module-grid">${filtered.map(m => {
      const s = moduleStats(m, progress);
      return `<a class="card module-card" href="#lesson/${e(m.id)}"><div class="module-number"><span>${String(modules.indexOf(m) + 1).padStart(2, '0')}</span><span>${s.complete ? '✓ Complete' : s.attempted ? 'In progress' : e(course.units.find(u => u.id === m.unitId).subtitle.split(' · ')[0])}</span></div><h3>${e(m.title)}</h3><p>${e(m.summary)}</p><div class="module-meta"><span>${m.minutes} min · ${m.questions.length} questions</span><span>${s.attempted ? `${s.correct}/${s.attempted} latest correct` : 'Let’s explore →'}</span></div></a>`;
    }).join('')}</div>`;
}

function lessonPage(id) {
  const module = modules.find(m => m.id === id);
  if (!module) return notFound();
  const index = modules.indexOf(module);
  const read = progress.read.includes(id);
  const linked = activities.journals.filter(j => j.moduleId === id);
  return `<div class="breadcrumb"><a href="#learn">Learning path</a> / Module ${index + 1}</div>
    ${pageHead(course.units.find(u => u.id === module.unitId).subtitle, module.title, module.summary, `<span class="pill">${module.minutes} MIN · ${module.questions.length} QUESTIONS</span>`)}
    ${modes()}
    <div class="lesson-layout"><article>
    ${module.sections.map((s, i) => `<section class="lesson-section"><span class="eyebrow">0${i + 1}</span><h2>${e(s.title)}</h2><p>${e(s.text)}</p>${progress.mode === 'new' ? `<div class="new-explanation"><span class="eyebrow">EXPLAIN LIKE I’M NEW</span>${e(s.new)}</div>` : ''}</section>`).join('')}
    <section class="card worked-example"><span class="eyebrow">LET’S WORK IT THROUGH</span><h2>A worked example</h2><p>${e(module.example.prompt)}</p><ol class="steps">${module.example.steps.map(step => `<li>${e(step)}</li>`).join('')}</ol><div class="formula">${e(module.example.result)}</div></section>
    <div class="callout"><strong>A useful thing to watch:</strong> ${e(module.watch)}</div>
    <div class="button-row"><button class="btn ${read ? 'secondary' : ''}" data-action="read" data-id="${e(id)}">${read ? '✓ Marked as read' : 'Mark lesson as read'}</button><a class="btn" href="#quiz/${e(id)}">Try the questions →</a></div>
    ${modules[index + 1] ? `<a class="text-link" href="#lesson/${e(modules[index + 1].id)}">Next: ${e(modules[index + 1].title)} →</a>` : '<a class="text-link" href="#progress">See how far you’ve come →</a>'}
    </article><aside class="lesson-aside"><div class="card"><span class="eyebrow">WORDS, MADE CLEAR</span><dl class="glossary">${module.terms.map(t => `<dt>${e(t.term)}</dt><dd>${e(t.definition)}</dd>`).join('')}</dl></div>
    <div class="card"><span class="eyebrow">YOUR FRANK WOOD POINTER</span><h3 class="small" style="margin-top:14px">Chapters ${e(module.reading.chapters)}</h3><p>${e(module.reading.topics)}</p><p>Mapped to ${e(course.book.edition)}. Check your copy’s edition.</p><a class="text-link" href="#guide">About these references →</a></div>
    ${linked.length ? `<div class="card"><span class="eyebrow">PUT IT INTO PRACTICE</span><ul class="module-list-small">${linked.map(j => `<li><a href="#journal/${e(j.id)}">${e(j.title)} →</a></li>`).join('')}</ul></div>` : ''}</aside></div>`;
}

function startQuiz(key, pool) {
  if (progress.activeQuiz?.key === key) return;
  const selected = progress.mode === 'challenge' && !key.startsWith('revision')
    ? pool.filter(q => q.level === 'challenge') : pool;
  progress.activeQuiz = selected.length ? { key, ids: selected.map(q => q.id), index: 0, responses: {} } : null;
  save();
}

function quizPage(id) {
  const module = modules.find(m => m.id === id);
  if (id !== 'all' && !module) return notFound();
  const key = `${id}:${progress.mode}`;
  startQuiz(key, id === 'all' ? questions : questions.filter(q => q.moduleId === id));
  return `${pageHead('PRACTISE WITHOUT PRESSURE', module ? module.title : 'The question collection', 'Choose one answer, use your one hint if you need it, then tell yourself how sure you feel. Mistakes are useful information.')}
    <div class="button-row"><span class="pill mint">${e(modeNames[progress.mode])}</span><a class="text-link" href="${module ? `#lesson/${e(id)}` : '#practice'}">Back to ${module ? 'lesson' : 'practice'}</a></div><div id="quiz-slot">${quizMarkup()}</div>`;
}

function quizMarkup() {
  const quiz = progress.activeQuiz;
  if (!quiz) return '<div class="empty-state"><h2>No questions at this level yet.</h2><p>Choose Step by step in Learn to explore the full question set.</p><a class="btn" href="#learn">Go to learning path</a></div>';
  if (quiz.index >= quiz.ids.length) {
    const attempted = quiz.ids.filter(id => quiz.responses[id]?.selected != null);
    const correct = attempted.filter(id => questions.find(q => q.id === id).answer === quiz.responses[id].selected).length;
    return `<section class="card quiz-result"><span class="eyebrow">THAT’S ANOTHER STEP FORWARD</span><h2>Practice, not perfection.</h2><span class="result-number">${correct} <small>of ${quiz.ids.length}</small></span><p>${correct === quiz.ids.length ? 'A lovely foundation to build on. Come back after a little time to check what has stuck.' : 'Every tricky answer points to something worth revisiting. Your latest answers and confidence ratings shape your revision queue.'}</p><p class="small muted">Finishing a quiz is not the same as mastery. Uncertain ideas return sooner.</p><div class="button-row" style="justify-content:center"><a class="btn" href="#progress">See my progress</a><button class="btn secondary" data-action="restart-quiz">Try a fresh attempt</button><a class="text-link" href="#learn">Back to learning</a></div></section>`;
  }
  const q = questions.find(q => q.id === quiz.ids[quiz.index]);
  const module = modules.find(m => m.id === q.moduleId);
  const response = quiz.responses[q.id] || { hint: false, selected: null, confidence: null };
  const answered = response.selected !== null;
  const correct = response.selected === q.answer;
  return `<section class="card question-card"><div class="question-top"><span>QUESTION ${quiz.index + 1} OF ${quiz.ids.length}</span><span>${q.level === 'challenge' ? '✦ Applied thinking' : 'Build the basics'}</span></div>
    <div class="progress-track" role="progressbar" aria-label="Quiz progress" aria-valuemin="0" aria-valuemax="${quiz.ids.length}" aria-valuenow="${quiz.index}"><span style="width:${quiz.index / quiz.ids.length * 100}%"></span></div>
    <p class="small muted">${e(module.title)}</p><h2 tabindex="-1" id="question-heading">${e(q.q)}</h2>
    <div class="answers" role="group" aria-label="Answer choices">${q.options.map((option, i) => `<button class="answer ${answered && i === q.answer ? 'correct' : answered && i === response.selected ? 'incorrect' : ''}" data-action="answer" data-choice="${i}" ${answered ? 'disabled' : ''}><span class="answer-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span>${e(option)}${answered && i === q.answer ? ' ✓ Correct answer' : answered && i === response.selected ? ' · Your answer' : ''}</span></button>`).join('')}</div>
    ${response.hint ? `<div class="hint"><strong>Your hint:</strong> ${e(q.hint)}</div>` : ''}
    ${answered ? `<div class="feedback ${correct ? '' : 'wrong'}" id="quiz-feedback" tabindex="-1" role="status"><strong>${correct ? 'That’s right. Here’s why.' : 'Not quite — and that’s okay. Here’s the missing piece.'}</strong><p>${e(q.explain)}</p>${progress.mode === 'new' ? `<p class="small">Take it slowly: name the accounts or quantities first, then follow the explanation one step at a time. <a href="#lesson/${e(q.moduleId)}">Revisit the plain-language lesson</a>.</p>` : ''}
    <strong class="small">How confident do you feel about this idea now?</strong><div class="confidence-buttons" role="group" aria-label="Confidence rating">${[[1,'Still unsure'],[2,'Getting there'],[3,'Feeling confident']].map(([value,label]) => `<button data-action="confidence" data-value="${value}" aria-pressed="${response.confidence === value}">${label}</button>`).join('')}</div><span class="tiny-label">${response.confidence ? `Next revisit: ${formatDue(progress.answers[q.id].due)}. ${correct ? '' : 'A missed answer returns soon whatever your confidence.'}` : 'Choose a rating to continue. Confidence is separate from correctness.'}</span></div>` : ''}
    <div class="quiz-actions"><button class="text-link" data-action="quiz-hint" ${response.hint || answered ? 'disabled' : ''}>${response.hint ? 'Hint used · 1 of 1' : 'A little hint · 1 available'}</button>${answered ? `<button class="btn" data-action="next-question" ${!response.confidence ? 'disabled' : ''}>${quiz.index + 1 === quiz.ids.length ? 'Finish this session' : 'Next question'} →</button>` : '<span class="small muted">No time limit. Think it through.</span>'}</div></section>`;
}

function updateQuiz(focusId) {
  document.querySelector('#quiz-slot').innerHTML = quizMarkup();
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  updateDueCount();
}

function revisionPage(run = false) {
  const due = dueQuestions(questions, progress);
  if (run) {
    if (progress.activeQuiz?.key !== 'revision') startQuiz('revision', due.slice(0, 10));
    return `${pageHead('SPACED REPETITION', 'A fresh look at familiar ideas.', 'Up to ten questions, oldest due first. Your confidence matters, but an incorrect answer always returns soon.')}<a class="text-link" href="#revision">Back to revision</a><div id="quiz-slot">${quizMarkup()}</div>`;
  }
  const future = questions.filter(q => progress.answers[q.id]?.due > Date.now()).sort((a,b) => progress.answers[a.id].due - progress.answers[b.id].due);
  return `${pageHead('REMEMBER MORE, CRAM LESS', 'Make it stick.', 'Your answers create a personal revision queue. Missed questions return in 10 minutes; uncertain correct answers tomorrow. Confident correct answers spread further apart.')}
    <div class="card revision-card"><span class="eyebrow">YOUR NEXT REVISION SESSION</span><h2 style="margin-top:18px">${due.length ? `${due.length} question${due.length === 1 ? ' is' : 's are'} ready to revisit.` : 'Nothing due right now. Breathe easy.'}</h2><p>${due.length ? 'Try up to ten at a time. You can stop and return to your session on this device.' : future.length ? `Your next question is due ${formatDue(progress.answers[future[0].id].due)}.` : 'Answer a few lesson questions and rate your confidence to start building your revision queue.'}</p>${due.length ? '<button class="btn" data-action="begin-revision">Start a short revision →</button>' : '<a class="btn" href="#learn">Explore a lesson →</a>'}
    ${progress.activeQuiz?.key === 'revision' && progress.activeQuiz.index < progress.activeQuiz.ids.length ? '<a class="btn outline" href="#revision/run">Resume revision session</a>' : ''}</div>
    <section class="lesson-section"><h2>What happens between sessions?</h2><p>Incorrect: 10 minutes. Correct but unsure: 1 day. Correct and “getting there”: 1, 3, 7, 14, then 30 days across consecutive correct attempts. Correct and confident: 3, 7, 14, 30, then 60 days. Each missed answer resets the streak. This is a simple study schedule, not an assessment of ability.</p></section>
    ${due.length ? `<section class="card"><h2>Ready for a little attention</h2><ul class="module-list-small">${due.slice(0, 10).map(q => `<li>${e(modules.find(m => m.id === q.moduleId).title)} · ${e(q.q)}</li>`).join('')}</ul></section>` : ''}`;
}

function formatDue(timestamp) {
  const delta = timestamp - Date.now();
  if (delta <= 0) return 'now';
  if (delta < 60 * 60_000) return `in ${Math.max(1, Math.ceil(delta / 60_000))} minutes`;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

function practicePage() {
  const cards = [
    { title: 'Build a journal', icon: '⇄', tag: `${activities.journals.length} EXERCISES`, description: 'Choose accounts, debit or credit, and amounts. See why a journal can balance but still be wrong.', type: 'journal', list: activities.journals },
    { title: 'Keep a running balance', icon: '≡', tag: `${activities.ledgers.length} SIMULATIONS`, description: 'Follow a bank account, a supplier balance or a disposal. Update the balance after every entry.', type: 'ledger', list: activities.ledgers },
    { title: 'Build a trial balance', icon: '⚖', tag: `${activities.trialBalances.length} PRACTICE SETS`, description: 'Place each closing balance on its Dr or Cr side, enter the amount and check your column totals.', type: 'trial', list: activities.trialBalances },
    { title: 'Think like an exam candidate', icon: '▤', tag: `${activities.exams.length} ORIGINAL SCENARIOS`, description: 'Bring the topics together with structured, first-year UK questions. Show workings, then self-mark.', type: 'exam', list: activities.exams }
  ];
  return `${pageHead('TURN “I THINK” INTO “I UNDERSTAND”', 'Your practice desk.', 'Try the process, not just the answer. These exercises have worked solutions and no penalties for a fresh attempt.')}
    <div class="practice-grid">${cards.map(c => `<section class="card"><div class="section-head"><span class="practice-icon" aria-hidden="true">${c.icon}</span><span class="eyebrow">${c.tag}</span></div><h2>${c.title}</h2><p>${c.description}</p><a class="btn secondary" href="#${c.type}/${e(c.list[0].id)}">Try it →</a></section>`).join('')}</div>
    <div class="card" style="margin-top:20px"><span class="eyebrow">${questions.length} MULTIPLE-CHOICE QUESTIONS</span><h2 style="margin-top:12px">A little of everything</h2><p class="small muted">Use Step by step for the full bank, or Challenge me for applied questions. For a smaller session, choose a module in Learn.</p>${modes()}<a class="btn" href="#quiz/all">Open the question collection →</a></div>`;
}

function activitySelect(type, list, selected) {
  return `<div class="activity-select field"><label for="activity-select">Choose an exercise</label><select id="activity-select" data-route="${type}">${list.map(a => `<option value="${e(a.id)}" ${a.id === selected ? 'selected' : ''}>${progress.practice[a.id] ? '✓ ' : ''}${e(a.title)}</option>`).join('')}</select></div>`;
}

function getDraft(type, activity, defaults) {
  const key = `${type}:${activity.id}`;
  if (practiceDraft?.key !== key) practiceDraft = { key, hint: false, feedback: null, ...defaults };
  return practiceDraft;
}

function activityFeedback() {
  if (!practiceDraft?.feedback) return '';
  return `<div class="feedback ${practiceDraft.feedback.correct ? '' : 'wrong'}" id="activity-feedback" tabindex="-1" role="status"><strong>${e(practiceDraft.feedback.message)}</strong>${practiceDraft.feedback.detail ? `<p>${e(practiceDraft.feedback.detail)}</p>` : ''}</div>`;
}

function activityHint(activity) {
  return `${practiceDraft.hint ? `<div class="hint"><strong>Your one hint:</strong> ${e(activity.hint)}</div>` : ''}<button class="text-link" data-action="activity-hint" ${practiceDraft.hint ? 'disabled' : ''}>${practiceDraft.hint ? 'Hint used · 1 of 1' : 'One hint available'}</button>`;
}

function exerciseEnd(activity, action) {
  return `${activityHint(activity)}<div class="button-row"><button class="btn" data-action="${action}">Check my work</button><button class="btn outline" data-action="show-solution">Show worked solution</button><button class="text-link" data-action="reset-activity">Clear this attempt</button></div><p class="small muted">A solution is a learning aid, not a completed exercise. Complete it by entering the correct work.</p>${activityFeedback()}`;
}

function journalPage(id) {
  const activity = activities.journals.find(a => a.id === id);
  if (!activity) return notFound();
  const draft = getDraft('journal', activity, { lines: [{ account: '', side: 'dr', amount: '' }, { account: '', side: 'cr', amount: '' }] });
  return `${pageHead('JOURNAL BUILDER', 'Two sides. One story.', 'Work out what changed, then choose the accounts and sides. Line order does not matter.')}
    ${activitySelect('journal', activities.journals, id)}<section class="card"><span class="eyebrow">${e(activity.title)}</span><p>${e(activity.prompt)}</p>
    <div class="journal-lines">${draft.lines.map((line, i) => `<div class="journal-line">
      <div class="field"><label for="account-${i}">Account · line ${i + 1}</label><select id="account-${i}" data-line="${i}" data-field="account"><option value="">Choose account</option>${activities.accounts.map(a => `<option ${a === line.account ? 'selected' : ''}>${e(a)}</option>`).join('')}</select></div>
      <div class="field"><label for="side-${i}">Side</label><select id="side-${i}" data-line="${i}" data-field="side"><option value="dr" ${line.side === 'dr' ? 'selected' : ''}>Debit (Dr)</option><option value="cr" ${line.side === 'cr' ? 'selected' : ''}>Credit (Cr)</option></select></div>
      <div class="field"><label for="amount-${i}">Amount (£)</label><input id="amount-${i}" type="number" min="0.01" step="0.01" inputmode="decimal" data-line="${i}" data-field="amount" value="${e(line.amount)}"></div>
      <button class="icon-btn" data-action="remove-line" data-index="${i}" aria-label="Remove line ${i + 1}" ${draft.lines.length <= 2 ? 'disabled' : ''}>×</button></div>`).join('')}</div>
    <button class="btn secondary small" data-action="add-line" ${draft.lines.length >= 8 ? 'disabled' : ''}>+ Add a line</button>
    <div class="totals" id="journal-totals" style="margin-top:18px" aria-live="polite">${journalTotals()}</div>
    ${exerciseEnd(activity, 'check-journal')}</section><a class="text-link" href="#lesson/${e(activity.moduleId)}">Revisit the related lesson →</a>`;
}

function journalTotals() {
  const total = side => practiceDraft.lines.filter(l => l.side === side).reduce((sum, l) => sum + (parseAmount(l.amount) || 0), 0) / 100;
  return `<span>Debits <strong>${pounds(total('dr'))}</strong></span><span>Credits <strong>${pounds(total('cr'))}</strong></span><span>Difference <strong>${pounds(Math.abs(total('dr') - total('cr')))}</strong></span>`;
}

function balanceDisplay(balance) {
  return `${pounds(Math.abs(balance))} ${balance < 0 ? 'Cr' : 'Dr'}`;
}

function ledgerPage(id) {
  const activity = activities.ledgers.find(a => a.id === id);
  if (!activity) return notFound();
  const draft = getDraft('ledger', activity, { rows: activity.rows.map(() => ({ amount: '', side: 'dr' })) });
  return `${pageHead('RUNNING-BALANCE LEDGER', 'Follow the account’s story.', 'Update the balance after every entry. Enter a positive amount and choose Dr or Cr. For a nil balance, either side is accepted.')}
    ${activitySelect('ledger', activities.ledgers, id)}<section class="card"><span class="eyebrow">${e(activity.title)}</span><h2 style="margin-top:14px">${e(activity.account)}</h2><p class="small">${e(activity.intro)}</p><div class="pill mint">Opening balance: ${balanceDisplay(activity.opening)}</div>
    <div class="scroll-table"><table><caption class="small" style="text-align:left;padding-bottom:12px">Enter the balance after each posted movement. All amounts are £.</caption><thead><tr><th>Date</th><th>Description / Ref</th><th class="money">Dr £</th><th class="money">Cr £</th><th>Balance £</th><th>Side</th></tr></thead><tbody>${activity.rows.map((row,i) => `<tr><td>${e(row.date)}</td><td>${e(row.description)}<br><small class="muted">${e(row.ref)}</small></td><td class="money">${row.dr ? pounds(row.dr) : '—'}</td><td class="money">${row.cr ? pounds(row.cr) : '—'}</td><td><input type="number" min="0" step="0.01" inputmode="decimal" aria-label="Balance after row ${i+1}" data-row="${i}" data-field="amount" value="${e(draft.rows[i].amount)}"></td><td><select aria-label="Balance side after row ${i+1}" data-row="${i}" data-field="side"><option value="dr" ${draft.rows[i].side === 'dr' ? 'selected' : ''}>Dr</option><option value="cr" ${draft.rows[i].side === 'cr' ? 'selected' : ''}>Cr</option></select></td></tr>`).join('')}</tbody></table></div>
    ${exerciseEnd(activity, 'check-ledger')}</section>`;
}

function trialPage(id) {
  const activity = activities.trialBalances.find(a => a.id === id);
  if (!activity) return notFound();
  const draft = getDraft('trial', activity, { rows: activity.balances.map(() => ({ amount: '', side: '' })) });
  return `${pageHead('TRIAL BALANCE PRACTICE', 'Give every balance a home.', 'Choose the Dr or Cr column and enter the closing amount. Equal totals are necessary, but the accounts and amounts must also be right.')}
    ${activitySelect('trial', activities.trialBalances, id)}<section class="card"><span class="eyebrow">${e(activity.title)}</span><p class="small">${e(activity.intro)}</p><div class="scroll-table"><table><caption class="small" style="text-align:left;padding-bottom:12px">Ledger closing balances to enter in the trial balance</caption><thead><tr><th>Account</th><th class="money">Given £</th><th>Your amount £</th><th>Your column</th></tr></thead><tbody>${activity.balances.map((row,i) => `<tr><td>${e(row.account)}</td><td class="money">${pounds(row.amount)}</td><td><input type="number" min="0" step="0.01" inputmode="decimal" aria-label="${e(row.account)} amount" data-row="${i}" data-field="amount" value="${e(draft.rows[i].amount)}"></td><td><select aria-label="${e(row.account)} column" data-row="${i}" data-field="side"><option value="">Choose</option><option value="dr" ${draft.rows[i].side === 'dr' ? 'selected' : ''}>Debit</option><option value="cr" ${draft.rows[i].side === 'cr' ? 'selected' : ''}>Credit</option></select></td></tr>`).join('')}</tbody></table></div>
    <div class="totals" id="trial-totals" aria-live="polite">${trialTotals()}</div>${exerciseEnd(activity, 'check-trial')}</section>`;
}

function trialTotals() {
  const total = side => practiceDraft.rows.filter(r => r.side === side).reduce((sum, r) => sum + (parseAmount(r.amount) || 0), 0) / 100;
  return `<span>Dr column <strong>${pounds(total('dr'))}</strong></span><span>Cr column <strong>${pounds(total('cr'))}</strong></span><span>Difference <strong>${pounds(Math.abs(total('dr') - total('cr')))}</strong></span>`;
}

function examPage(id) {
  const exam = activities.exams.find(a => a.id === id);
  if (!exam) return notFound();
  return `${pageHead('ORIGINAL EXAM-STYLE PRACTICE', 'Bring the pieces together.', 'First-year UK accounting practice aligned to the supplied Glasgow lecture topics. These are not official University of Glasgow questions or marking schemes.')}
    ${activitySelect('exam', activities.exams, id)}<section class="card"><div class="section-head"><h2>${e(exam.title)}</h2><span class="pill">${exam.minutes} MIN · ${exam.marks} MARKS</span></div><p>${e(exam.scenario)}</p><div class="callout">Suggested approach: work without the solution for about ${exam.minutes} minutes. Show your workings and explain the accounting treatment. Then self-mark using the indicative guide. Your written answers save on this device.</div>
    ${exam.parts.map((part,i) => `<section class="exam-part"><h3>${String.fromCharCode(97+i)}) ${e(part.prompt)} <span class="muted">[${part.marks} marks]</span></h3><label for="draft-${e(part.id)}">Your answer and workings</label><textarea id="draft-${e(part.id)}" maxlength="20000" data-exam-draft="${e(exam.id)}:${e(part.id)}" placeholder="Start with what you know. Workings matter.">${e(progress.drafts[`${exam.id}:${part.id}`] || '')}</textarea><details><summary>Reveal indicative answer &amp; mark guide</summary><div class="solution">${e(part.solution)}</div></details></section>`).join('')}
    <p class="small muted">Self-marked written practice is kept separate from auto-checked quiz and exercise scores. There is no automatic grading of these written answers.</p></section>`;
}

function progressPage() {
  const completedPractice = Object.keys(progress.practice).length;
  return `${pageHead('NOTICE HOW FAR YOU’VE COME', 'Understanding is growing.', 'Your progress belongs to this browser and device. Export a backup before changing devices or clearing browser data.')}
    ${summaryStats()}<p class="confidence-summary">Confidence uses your latest self-rating on each attempted question: unsure = 0%, getting there = 50%, confident = 100%. The average is not a grade. Question accuracy uses latest answers, not your best-ever result.</p>
    <section class="card"><h2>Your learning, module by module</h2>${modules.map(m => {
      const s = moduleStats(m, progress);
      return `<div class="progress-row"><div><a href="#lesson/${e(m.id)}">${e(m.title)}</a><br><span class="muted small">${progress.read.includes(m.id) ? 'Read' : 'Not yet marked read'} · ${s.attempted}/${m.questions.length} tried${s.complete ? ' · Complete' : ''}</span></div><div class="progress-track" role="progressbar" aria-label="${e(m.title)} questions attempted" aria-valuenow="${s.attempted}" aria-valuemin="0" aria-valuemax="${m.questions.length}"><span style="width:${s.attempted/m.questions.length*100}%"></span></div><small>${s.attempted ? `${s.accuracy}% correct` : 'Not yet'}</small></div>`;
    }).join('')}</section>
    <section class="card" style="margin-top:20px"><h2>Your practical toolkit</h2><p>${completedPractice} of ${activities.journals.length + activities.ledgers.length + activities.trialBalances.length} auto-checked exercises completed correctly.</p><p class="small muted">This records successful completion, not a confidence score. Hints and worked solutions are learning aids. Unsubmitted journal, ledger and trial-balance drafts stay only while you are on that exercise; completed exercises, quizzes and exam writing are saved.</p><a class="btn secondary" href="#practice">Back to the practice desk →</a></section>
    <section class="card" style="margin-top:20px"><h2>Your progress, safely kept</h2><div class="settings-row"><div><strong class="small">Export a backup</strong><p class="muted">Download your progress and written answers as JSON. Keep it private; it includes your learning history and anything you type.</p></div><button class="btn secondary" data-action="export">Export progress</button></div>
    <div class="settings-row"><div><strong class="small">Restore a backup</strong><p class="muted">Replaces this browser’s progress after validation. It does not merge two backups.</p></div><label class="btn outline import-label" for="import-file">Import progress</label><input id="import-file" type="file" accept=".json,application/json" style="max-width:230px" aria-label="Select progress backup"></div>
    <div class="settings-row"><div><strong class="small">Start again</strong><p class="muted">Remove this course’s progress from this browser only. Export first if you may want it later.</p></div><button class="btn danger" data-action="confirm-reset">Reset progress</button></div><div id="backup-feedback" role="status"></div></section>`;
}

function guidePage() {
  return `${pageHead('A COMPANION, NOT ANOTHER TEXTBOOK', 'A little context helps.', 'How this study space connects to your notes, your course and your Frank Wood book.')}
    <section class="card"><h2>Made around your Unit 2 &amp; 3 notes</h2><p>${e(course.source)}</p><p>${e(course.scope)}</p><p>All explanations and exercises here are original study material. No textbook pages, official past papers or lecturer slides are reproduced. Use official course materials for assessment rules, terminology and accounting policies.</p></section>
    <section class="lesson-section"><h2>Your Frank Wood reading guide</h2><p><strong>${e(course.book.title)}, ${e(course.book.edition)}</strong> · Print ISBN ${e(course.book.isbn)}</p><p>${e(course.book.note)}</p><a class="text-link" href="${e(course.book.url)}" target="_blank" rel="noopener noreferrer">Check Pearson’s published table of contents ↗</a>
    <div class="scroll-table"><table class="reading-map"><caption class="small" style="text-align:left;padding-bottom:12px">Chapter/topic pointers checked against the publisher’s 16th-edition contents</caption><thead><tr><th>Learning module</th><th>Chapter(s)</th><th>Topic / index terms</th></tr></thead><tbody>${modules.map(m => `<tr><td><a href="#lesson/${e(m.id)}">${e(m.title)}</a></td><td>${e(m.reading.chapters)}</td><td>${e(m.reading.topics)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="card"><h2>Where lecture shorthand needs care</h2><ol class="steps">${course.clarifications.map(c => `<li>${e(c)}</li>`).join('')}</ol></section>
    <section class="lesson-section"><h2>Study modes</h2><p><strong>Step by step:</strong> full lessons and the full question bank. <strong>I'm new to accounting:</strong> extra everyday-language explanations, with the same core content and all questions. <strong>Challenge me:</strong> the applied question subset, including multi-step calculations. Every MCQ attempt still has one optional hint.</p><p>Revision is based on your saved answers and always includes due questions regardless of mode. You must rate your confidence before moving on. Neither confidence nor completion predicts exam performance.</p></section>
    <section class="lesson-section"><h2>Privacy &amp; accessibility</h2><p>No sign-in, tracking, paid services or server database. Progress stays in local storage on your browser. The hosting provider still serves the website normally. Browser storage can be cleared or unavailable in private browsing; export backups from My progress. Quiz feedback uses words as well as colour. Keyboard controls and reduced-motion preferences are supported.</p><p>Currency is GBP and terminology is UK: trade receivables, trade payables, inventory, statement of financial position and income statement. The site needs an internet connection to load; it does not install an offline app.</p></section>`;
}

function notFound() {
  return '<div class="empty-state"><span class="eyebrow">A SMALL DETOUR</span><h1>That page isn’t here.</h1><p>The link may refer to a module or activity that is no longer in the course.</p><a class="btn" href="#home">Back to your study space</a></div>';
}

function updateDueCount() {
  const count = dueQuestions(questions, progress).length;
  document.querySelector('#due-count').textContent = count;
}

function render(focus = false) {
  const [page, id] = route();
  let html;
  switch (page) {
    case 'home': html = homePage(); break;
    case 'fundamentals':
      html = id ? fundamentalsPage(fundamentals, id, modes(), progress.mode === 'new') || notFound() : fundamentalsIndex(fundamentals);
      break;
    case 'learn': html = learnPage(); break;
    case 'unit':
      if (!course.units.some(u => u.id === id)) { html = notFound(); break; }
      unitFilter = id; html = learnPage(); break;
    case 'lesson': html = lessonPage(id); break;
    case 'quiz': html = quizPage(id); break;
    case 'revision': html = revisionPage(id === 'run'); break;
    case 'practice': html = practicePage(); break;
    case 'journal': html = journalPage(id); break;
    case 'ledger': html = ledgerPage(id); break;
    case 'trial': html = trialPage(id); break;
    case 'exam': html = examPage(id); break;
    case 'progress': html = progressPage(); break;
    case 'guide': html = guidePage(); break;
    default: html = notFound();
  }
  main.innerHTML = html;
  const nav = ['lesson', 'unit'].includes(page) ? 'learn' : ['quiz', 'journal', 'ledger', 'trial', 'exam'].includes(page) ? 'practice' : page;
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === nav);
    if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  updateDueCount();
  if (focus) { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}

function currentActivity() {
  const [type, id] = route();
  const list = { journal: activities.journals, ledger: activities.ledgers, trial: activities.trialBalances }[type];
  return list?.find(a => a.id === id);
}

function showActivityFeedback(feedback) {
  practiceDraft.feedback = feedback;
  const oldScroll = window.scrollY;
  render();
  window.scrollTo(0, oldScroll);
  document.querySelector('#activity-feedback')?.focus({ preventScroll: true });
}

function checkedActivity(correct, message, activity) {
  if (correct) { progress.practice[activity.id] = true; save(); }
  showActivityFeedback({ correct, message, detail: correct ? activity.explanation : '' });
}

function onClick(event) {
  if (event.target.closest('.skip-link')) {
    event.preventDefault();
    main.focus();
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'mode') {
    progress.mode = button.dataset.mode; save(); render(); return;
  }
  if (action === 'filter') {
    unitFilter = button.dataset.unit;
    if (route()[0] === 'unit') location.hash = 'learn';
    else render();
    return;
  }
  if (action === 'read') {
    if (!progress.read.includes(button.dataset.id)) progress.read.push(button.dataset.id);
    save(); render(); return;
  }
  if (['answer','quiz-hint','confidence','next-question','restart-quiz'].includes(action)) {
    const quiz = progress.activeQuiz;
    if (!quiz) return;
    if (action === 'restart-quiz') {
      const key = quiz.key;
      const pool = key === 'revision' ? dueQuestions(questions, progress).slice(0, 10) : questions.filter(q => key.startsWith('all:') || q.moduleId === key.split(':')[0]);
      progress.activeQuiz = null;
      startQuiz(key, pool);
      updateQuiz('question-heading'); return;
    }
    const q = questions.find(q => q.id === quiz.ids[quiz.index]);
    if (!q) return;
    const response = quiz.responses[q.id] ||= { hint: false, selected: null, confidence: null };
    if (action === 'quiz-hint' && response.selected === null && !response.hint) response.hint = true;
    if (action === 'answer' && response.selected === null) {
      response.selected = Number(button.dataset.choice);
      progress.answers[q.id] = recordAnswer(progress.answers[q.id], response.selected === q.answer);
    }
    if (action === 'confidence' && response.selected !== null) {
      response.confidence = Number(button.dataset.value);
      progress.answers[q.id] = rateAnswer(progress.answers[q.id], response.confidence);
    }
    if (action === 'next-question' && response.confidence) quiz.index++;
    save();
    updateQuiz(action === 'answer' ? 'quiz-feedback' : action === 'next-question' ? 'question-heading' : null);
    return;
  }
  if (action === 'begin-revision') {
    progress.activeQuiz = null;
    location.hash = 'revision/run'; return;
  }
  if (action === 'export') { exportBackup(); return; }
  if (action === 'confirm-reset') { confirmReset(); return; }
  const activity = currentActivity();
  if (!activity || !practiceDraft) return;
  if (action === 'activity-hint') { practiceDraft.hint = true; render(); return; }
  if (action === 'add-line') { if (practiceDraft.lines.length < 8) practiceDraft.lines.push({ account:'', side:'dr', amount:'' }); render(); return; }
  if (action === 'remove-line') { if (practiceDraft.lines.length > 2) practiceDraft.lines.splice(Number(button.dataset.index), 1); render(); return; }
  if (action === 'reset-activity') { practiceDraft = null; render(); return; }
  if (action === 'show-solution') {
    let detail = activity.explanation;
    if (route()[0] === 'ledger') detail += ` Running balances: ${ledgerBalances(activity).map(balanceDisplay).join('; ')}.`;
    if (route()[0] === 'trial') detail += ` ${activity.balances.map(b => `${b.account}: ${pounds(b.amount)} ${b.side === 'dr' ? 'Dr' : 'Cr'}`).join('; ')}.`;
    showActivityFeedback({ correct: true, message: 'Worked solution — compare the reasoning with your attempt.', detail }); return;
  }
  if (action === 'check-journal') {
    const result = checkJournal(practiceDraft.lines, activity.expected);
    checkedActivity(result.correct, result.message, activity); return;
  }
  if (action === 'check-ledger') {
    const expected = ledgerBalances(activity);
    const invalid = practiceDraft.rows.findIndex(r => parseAmount(r.amount) === null);
    if (invalid >= 0) { showActivityFeedback({ correct:false, message:`Enter a valid non-negative balance (up to two decimal places) on row ${invalid+1}.` }); return; }
    const incorrect = expected.flatMap((balance,i) => {
      const row = practiceDraft.rows[i];
      return parseAmount(row.amount) === Math.round(Math.abs(balance)*100) && (balance === 0 || row.side === (balance < 0 ? 'cr' : 'dr')) ? [] : [i+1];
    });
    checkedActivity(!incorrect.length, incorrect.length ? `Revisit row${incorrect.length > 1 ? 's' : ''} ${incorrect.join(', ')}. Carry the preceding balance forward, add debits and subtract credits. Check the Dr/Cr side.` : 'Every running balance is correct. You followed the whole story.', activity); return;
  }
  if (action === 'check-trial') {
    const invalid = practiceDraft.rows.findIndex(r => parseAmount(r.amount) === null || !['dr','cr'].includes(r.side));
    if (invalid >= 0) { showActivityFeedback({ correct:false, message:`Enter an amount (up to two decimal places) and choose a column for ${activity.balances[invalid].account}.` }); return; }
    const wrong = activity.balances.filter((b,i) => parseAmount(practiceDraft.rows[i].amount) !== Math.round(b.amount*100) || practiceDraft.rows[i].side !== b.side);
    checkedActivity(!wrong.length, wrong.length ? `Check these accounts: ${wrong.map(b => b.account).join(', ')}. Matching totals alone is not enough.` : 'Every account is correctly placed and both columns agree.', activity);
  }
}

function syncPracticeField(target) {
  if (!practiceDraft || !target.dataset.field) return;
  if (target.dataset.line !== undefined) practiceDraft.lines[Number(target.dataset.line)][target.dataset.field] = target.value;
  if (target.dataset.row !== undefined) practiceDraft.rows[Number(target.dataset.row)][target.dataset.field] = target.value;
  const totals = document.querySelector('#journal-totals');
  if (totals) totals.innerHTML = journalTotals();
  const trial = document.querySelector('#trial-totals');
  if (trial) trial.innerHTML = trialTotals();
  if (practiceDraft.feedback) {
    practiceDraft.feedback = null;
    document.querySelector('#activity-feedback')?.remove();
  }
}

function onChange(event) {
  const target = event.target;
  if (target.matches('[data-route]')) { location.hash = `${target.dataset.route}/${target.value}`; return; }
  if (target.id === 'import-file') { importBackup(target.files[0]); return; }
  syncPracticeField(target);
}

function onInput(event) {
  const target = event.target;
  if (target.dataset.examDraft) {
    progress.drafts[target.dataset.examDraft] = target.value;
    save();
    return;
  }
  syncPracticeField(target);
}

function exportBackup() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(progress, null, 2)], { type:'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = `accounting-progress-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importBackup(file) {
  if (!file) return;
  const feedback = document.querySelector('#backup-feedback');
  try {
    if (file.size > 2_000_000) throw new Error('That file is too large. Choose a progress JSON backup smaller than 2 MB.');
    const restored = validateProgress(JSON.parse(await file.text()), modules, activities);
    const confirmed = await confirmDialog('Replace saved progress?', 'This will replace this browser’s course progress and written answers with the backup. Export your current work first if you need it.', 'Replace progress');
    if (!confirmed) { feedback.textContent = 'Import cancelled. Your progress is unchanged.'; return; }
    restored.activeQuiz = null;
    progress = restored; canSave = true; save();
    document.querySelector('#storage-notice').hidden = canSave;
    render();
    document.querySelector('#backup-feedback').textContent = canSave ? 'Backup restored and saved on this device.' : 'Backup loaded for this session, but browser storage is still unavailable. Export again before leaving.';
  } catch (error) {
    feedback.textContent = `Import failed: ${error.message}`;
  }
}

function confirmDialog(title, message, action) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'dialog-title');
    dialog.innerHTML = `<h2 id="dialog-title">${e(title)}</h2><p>${e(message)}</p><form method="dialog"><div class="button-row"><button class="btn outline" value="cancel" autofocus>Cancel</button><button class="btn danger" value="confirm">${e(action)}</button></div></form>`;
    dialog.addEventListener('close', () => { const result = dialog.returnValue === 'confirm'; dialog.remove(); resolve(result); }, { once:true });
    document.body.append(dialog); dialog.showModal();
  });
}

async function confirmReset() {
  const confirmed = await confirmDialog('Start again on this device?', 'This removes your saved quiz progress, confidence ratings, revision schedule and written answers for this course. It cannot be undone without a backup.', 'Reset progress');
  if (!confirmed) return;
  progress = freshProgress(); practiceDraft = null; canSave = true; save();
  document.querySelector('#storage-notice').hidden = canSave;
  render();
  document.querySelector('#backup-feedback').textContent = canSave ? 'Progress reset. Your fresh start is saved.' : 'The current session was reset, but browser storage could not be updated. Previously stored data may return on reload.';
}

boot();
