export const STORAGE_KEY = 'accounting-understood:v1';
export const DAY = 86_400_000;
export const MODES = ['standard', 'new', 'challenge'];

export function freshProgress() {
  return { version: 1, mode: 'standard', read: [], answers: {}, practice: {}, drafts: {}, activeQuiz: null, accountQuiz: { index: 0, responses: {} } };
}

export function pounds(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(amount);
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function revisionDelay(correct, confidence, streak) {
  if (!correct) return 10 * 60_000;
  if (confidence === 1) return DAY;
  const intervals = confidence === 3 ? [3, 7, 14, 30, 60] : [1, 3, 7, 14, 30];
  return intervals[Math.min(Math.max(streak - 1, 0), intervals.length - 1)] * DAY;
}

export function recordAnswer(previous, correct, confidence = 2, now = Date.now()) {
  const streak = correct ? (previous?.streak || 0) + 1 : 0;
  return {
    correct, confidence, streak, attempts: (previous?.attempts || 0) + 1,
    answeredAt: now, due: now + revisionDelay(correct, confidence, streak)
  };
}

export function rateAnswer(answer, confidence) {
  return { ...answer, confidence, due: answer.answeredAt + revisionDelay(answer.correct, confidence, answer.streak) };
}

export function dueQuestions(questions, progress, now = Date.now()) {
  return questions.filter(q => progress.answers[q.id]?.due <= now)
    .sort((a, b) => progress.answers[a.id].due - progress.answers[b.id].due);
}

export function moduleStats(module, progress) {
  const attempted = module.questions.filter(q => progress.answers[q.id]);
  const correct = attempted.filter(q => progress.answers[q.id].correct).length;
  return {
    attempted: attempted.length, correct,
    complete: progress.read.includes(module.id) && attempted.length === module.questions.length,
    accuracy: attempted.length ? Math.round(correct / attempted.length * 100) : 0
  };
}

export function confidenceScore(questions, progress) {
  const answers = questions.map(q => progress.answers[q.id]).filter(Boolean);
  return answers.length ? Math.round(answers.reduce((sum, a) => sum + (a.confidence - 1) / 2 * 100, 0) / answers.length) : null;
}

export function ledgerBalances(activity) {
  let balance = activity.opening;
  return activity.rows.map(row => {
    balance += row.dr - row.cr;
    return Math.round(balance * 100) / 100;
  });
}

export function parseAmount(value) {
  if (String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && Math.abs(number * 100 - Math.round(number * 100)) < 0.00001
    ? Math.round(number * 100) : null;
}

export function checkJournal(lines, expected) {
  if (lines.length < 2) return { correct: false, message: 'A journal needs at least two lines.' };
  const actual = new Map();
  let dr = 0, cr = 0;
  for (const line of lines) {
    const amount = parseAmount(line.amount);
    if (!line.account || !['dr', 'cr'].includes(line.side) || amount === null || amount <= 0) {
      return { correct: false, message: 'Choose an account, a Dr/Cr side and a positive amount (maximum two decimal places) on every line.' };
    }
    const key = `${line.account}:${line.side}`;
    actual.set(key, (actual.get(key) || 0) + amount);
    if (line.side === 'dr') dr += amount;
    else cr += amount;
  }
  if (dr !== cr) return { correct: false, message: `Not balanced yet: debits ${pounds(dr / 100)}, credits ${pounds(cr / 100)}. Revisit the amounts before checking the accounts.` };
  const target = new Map();
  for (const line of expected) {
    for (const side of ['dr', 'cr']) {
      if (line[side]) {
        const key = `${line.account}:${side}`;
        target.set(key, (target.get(key) || 0) + Math.round(line[side] * 100));
      }
    }
  }
  const correct = actual.size === target.size && [...target].every(([key, amount]) => actual.get(key) === amount);
  return { correct, message: correct ? 'That is a balanced, correctly posted journal.' : 'It balances, but the accounts, sides or amounts do not yet match the transaction. Revisit what increased and what decreased.' };
}

export function validateCourse(course, units, activities) {
  const fail = message => { throw new Error(`Content configuration: ${message}`); };
  if (!course?.id || !course.title || !course.book?.url || !Array.isArray(course.units) || !course.units.length) fail('course metadata or units missing.');
  const ids = new Set();
  const register = (id, label) => {
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id) || ids.has(id)) fail(`invalid or duplicate ${label} id: ${id}`);
    ids.add(id);
  };
  course.units.forEach(unit => register(unit.id, 'unit'));
  if (units.length !== course.units.length) fail('unit files do not match course manifest.');
  const moduleIds = new Set();
  for (const [index, unit] of units.entries()) {
    if (unit.id !== course.units[index].id || !Array.isArray(unit.modules) || !unit.modules.length) fail('unit id or module list mismatch.');
    for (const module of unit.modules) {
      register(module.id, 'module');
      moduleIds.add(module.id);
      if (!module.title || !module.summary || !Number.isFinite(module.minutes) || module.minutes <= 0 || !module.sections?.length || !module.example?.steps?.length || !module.example.result || !module.reading?.topics || !module.reading?.chapters || !module.terms?.length) fail(`incomplete lesson ${module.id}`);
      for (const section of module.sections) if (!section.title || !section.text || !section.new) fail(`incomplete section in ${module.id}`);
      if (!Array.isArray(module.questions) || !module.questions.length) fail(`no questions in ${module.id}`);
      for (const q of module.questions) {
        register(q.id, 'question');
        if (!q.q || q.options?.length !== 4 || new Set(q.options).size !== 4 || !q.options.every(o => typeof o === 'string' && o.length) || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3 || !q.hint || !q.explain || !['core', 'challenge'].includes(q.level)) fail(`invalid question ${q.id}`);
      }
    }
  }
  if (!activities || !Array.isArray(activities.accounts) || new Set(activities.accounts).size !== activities.accounts.length) fail('invalid account list.');
  for (const type of ['journals', 'ledgers', 'trialBalances', 'exams']) {
    if (!Array.isArray(activities[type])) fail(`missing activity list ${type}`);
    for (const activity of activities[type]) {
      register(activity.id, 'activity');
      if (!activity.title || !course.units.some(u => u.id === activity.unitId)) fail(`invalid activity ${activity.id}`);
    }
  }
  for (const journal of activities.journals) {
    const result = checkJournal(journal.expected.map(line => ({
      account: line.account, side: line.dr ? 'dr' : 'cr', amount: line.dr || line.cr
    })), journal.expected);
    if (!journal.prompt || !journal.hint || !journal.explanation || !moduleIds.has(journal.moduleId) || !result.correct || journal.expected.some(line => !activities.accounts.includes(line.account) || line.dr < 0 || line.cr < 0 || (line.dr > 0) === (line.cr > 0))) fail(`invalid journal ${journal.id}`);
  }
  for (const ledger of activities.ledgers) {
    if (!ledger.rows?.length || !Number.isFinite(ledger.opening) || !ledger.account || !ledger.intro || !ledger.hint || !ledger.explanation || ledger.rows.some(r => !r.description || !Number.isFinite(r.dr) || !Number.isFinite(r.cr) || r.dr < 0 || r.cr < 0)) fail(`invalid ledger ${ledger.id}`);
  }
  for (const tb of activities.trialBalances) {
    if (!tb.balances?.length || tb.balances.some(b => !b.account || !['dr', 'cr'].includes(b.side) || !Number.isFinite(b.amount) || b.amount <= 0) || tb.balances.reduce((sum, b) => sum + (b.side === 'dr' ? 1 : -1) * Math.round(b.amount * 100), 0) !== 0) fail(`unbalanced trial balance ${tb.id}`);
  }
  for (const exam of activities.exams) {
    if (!exam.scenario || !exam.parts?.length || exam.parts.some(p => !p.id || !p.prompt || !p.solution || !Number.isFinite(p.marks) || p.marks <= 0) || exam.parts.reduce((sum, p) => sum + p.marks, 0) !== exam.marks) fail(`invalid exam ${exam.id}`);
  }
}

export function validateProgress(input, modules, activities, accountQuizConfig) {
  const invalid = () => { throw new Error('This is not a valid version 1 progress backup. Existing progress has not been replaced.'); };
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!isObject(input) || input.version !== 1 || !MODES.includes(input.mode) || !Array.isArray(input.read) || !isObject(input.answers) || !isObject(input.practice) || !isObject(input.drafts)) invalid();
  const questionIds = new Set(modules.flatMap(m => m.questions.map(q => q.id)));
  const moduleIds = new Set(modules.map(m => m.id));
  const activityIds = new Set(['journals', 'ledgers', 'trialBalances'].flatMap(type => activities[type].map(a => a.id)));
  const progress = freshProgress();
  if (input.accountQuiz !== undefined) {
    const quiz = input.accountQuiz;
    if (!isObject(quiz) || !Number.isSafeInteger(quiz.index) || quiz.index < 0 || !isObject(quiz.responses)) invalid();
    const known = accountQuizConfig?.stages.flatMap(stage => stage.questions);
    if (known && quiz.index > known.length) invalid();
    const responses = {};
    for (const [id, response] of Object.entries(quiz.responses)) {
      if (!/^[a-z0-9-]+$/.test(id) || !isObject(response) || typeof response.hint !== 'boolean' || !(response.selected === null || (Number.isInteger(response.selected) && response.selected >= 0 && response.selected <= 3))) invalid();
      if (known && !known.some(q => q.id === id)) invalid();
      responses[id] = { hint: response.hint, selected: response.selected };
    }
    if (known && known.slice(0, quiz.index).some(q => responses[q.id]?.selected == null)) invalid();
    progress.accountQuiz = { index: quiz.index, responses };
  }
  progress.mode = input.mode;
  if (input.read.some(id => typeof id !== 'string')) invalid();
  progress.read = [...new Set(input.read.filter(id => moduleIds.has(id)))];
  for (const [id, answer] of Object.entries(input.answers)) {
    if (!questionIds.has(id)) continue;
    if (!isObject(answer) || typeof answer.correct !== 'boolean' || ![1, 2, 3].includes(answer.confidence) || !Number.isSafeInteger(answer.attempts) || answer.attempts < 1 || !Number.isSafeInteger(answer.streak) || answer.streak < 0 || !Number.isFinite(answer.due) || !Number.isFinite(answer.answeredAt) || answer.due < 0 || answer.due > 8.64e15 || answer.answeredAt < 0 || answer.answeredAt > 8.64e15) invalid();
    progress.answers[id] = { correct: answer.correct, confidence: answer.confidence, attempts: answer.attempts, streak: answer.streak, due: answer.due, answeredAt: answer.answeredAt };
  }
  for (const [id, value] of Object.entries(input.practice)) {
    if (activityIds.has(id)) {
      if (value !== true) invalid();
      progress.practice[id] = true;
    }
  }
  for (const exam of activities.exams) for (const part of exam.parts) {
    const id = `${exam.id}:${part.id}`;
    const text = input.drafts[id];
    if (text !== undefined) {
      if (typeof text !== 'string' || text.length > 20000) invalid();
      progress.drafts[id] = text;
    }
  }
  if (input.activeQuiz) {
    const quiz = input.activeQuiz;
    if (!isObject(quiz) || typeof quiz.key !== 'string' || !Array.isArray(quiz.ids) || !quiz.ids.length || quiz.ids.some(id => !questionIds.has(id)) || new Set(quiz.ids).size !== quiz.ids.length || !Number.isInteger(quiz.index) || quiz.index < 0 || quiz.index > quiz.ids.length || !isObject(quiz.responses)) invalid();
    const [scope, mode] = quiz.key.split(':');
    if (quiz.key !== 'revision' && ((!moduleIds.has(scope) && scope !== 'all') || !MODES.includes(mode) || quiz.key !== `${scope}:${mode}`)) invalid();
    const responses = {};
    for (const id of quiz.ids) {
      const r = quiz.responses[id];
      if (r !== undefined) {
        if (!isObject(r) || typeof r.hint !== 'boolean' || !(r.selected === null || (Number.isInteger(r.selected) && r.selected >= 0 && r.selected <= 3)) || !(r.confidence === null || [1, 2, 3].includes(r.confidence))) invalid();
        if ((r.selected !== null && !progress.answers[id]) || (r.selected === null && r.confidence !== null)) invalid();
        responses[id] = { hint: r.hint, selected: r.selected, confidence: r.confidence };
      }
    }
    if (quiz.ids.slice(0, quiz.index).some(id => responses[id]?.selected == null || !responses[id].confidence)) invalid();
    progress.activeQuiz = { key: quiz.key, ids: quiz.ids, index: quiz.index, responses };
  }
  return progress;
}
