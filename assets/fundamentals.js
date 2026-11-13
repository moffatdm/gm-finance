import { escapeHtml as e } from './engine.js';

export function validateFundamentals(config) {
  const fail = () => { throw new Error('Content configuration: invalid fundamentals page data.'); };
  if (!config?.title || !config.description || !config.sourceNote || !Array.isArray(config.pages) || !config.pages.length) fail();
  const ids = new Set(), orders = new Set();
  for (const page of config.pages) {
    if (!/^[a-z0-9-]+$/.test(page.id) || ids.has(page.id) || !Number.isInteger(page.order) || page.order < 1 || orders.has(page.order)) fail();
    ids.add(page.id); orders.add(page.order);
    if (!page.title || !page.summary || !page.sourceTitle || !/^assets\/pdfs\/[a-z0-9-]+\.pdf$/.test(page.pdf) || !page.sections?.length || page.sections.some(s => !s.title || !s.text || !s.new) || !page.example?.prompt || !page.example.steps?.length || !page.example.result || !page.links?.length) fail();
    if (!page.table?.caption || !page.table.headers?.length || !page.table.rows?.length || page.table.rows.some(row => row.length !== page.table.headers.length || row.some(cell => typeof cell !== 'string'))) fail();
    if (page.links.some(link => !link.label || !/^(lesson|journal|ledger|trial|exam)\/[a-z0-9-]+$/.test(link.route))) fail();
  }
}

export function orderedPages(config) {
  return [...config.pages].sort((a, b) => a.order - b.order);
}

export function fundamentalsIndex(config) {
  return `<div class="page-head"><div><span class="eyebrow">START WITH THE FOUNDATIONS</span><h1>${e(config.title)}</h1><p>${e(config.description)}</p></div></div>
    <p class="small muted">${e(config.sourceNote)}</p>
    <div class="module-grid">${orderedPages(config).map(page => `<a class="card module-card" href="#fundamentals/${e(page.id)}"><div class="module-number"><span>${page.order}</span><span>FOUNDATION ${page.order}</span></div><h2>${e(page.title)}</h2><p>${e(page.summary)}</p><div class="module-meta"><span>Read, understand, then practise</span><span>Explore →</span></div></a>`).join('')}</div>`;
}

export function fundamentalsPage(config, id, modeControls, isNew) {
  const pages = orderedPages(config);
  const index = pages.findIndex(page => page.id === id);
  if (index < 0) return null;
  const page = pages[index];
  return `<div class="breadcrumb"><a href="#fundamentals">${e(config.title)}</a> / ${page.order}. ${e(page.title)}</div>
    <div class="page-head"><div><span class="eyebrow">FOUNDATION ${page.order} OF ${pages.length}</span><h1>${e(page.title)}</h1><p>${e(page.summary)}</p></div></div>
    <p class="small muted">Topic guide for: ${e(page.sourceTitle)}. Original explanations, not a reproduction of the PDF.</p>
    <div class="button-row"><a class="btn secondary" href="${e(page.pdf)}" target="_blank" rel="noopener noreferrer">Open PDF: ${page.order}. ${e(page.title)} ↗</a><span class="small muted">Original attachment · opens in a new tab</span></div>
    ${modeControls}
    ${page.sections.map((section, i) => `<section class="lesson-section"><span class="eyebrow">${String(i + 1).padStart(2, '0')}</span><h2>${e(section.title)}</h2><p>${e(section.text)}</p>${isNew ? `<div class="new-explanation"><span class="eyebrow">EXPLAIN LIKE I’M NEW</span>${e(section.new)}</div>` : ''}</section>`).join('')}
    <div class="scroll-table"><table><caption class="small" style="text-align:left;padding-bottom:12px">${e(page.table.caption)}</caption><thead><tr>${page.table.headers.map(header => `<th scope="col">${e(header)}</th>`).join('')}</tr></thead><tbody>${page.table.rows.map(row => `<tr>${row.map(cell => `<td>${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <section class="card worked-example"><span class="eyebrow">LET’S WORK IT THROUGH</span><h2>A worked example</h2><p>${e(page.example.prompt)}</p><ol class="steps">${page.example.steps.map(step => `<li>${e(step)}</li>`).join('')}</ol><div class="formula">${e(page.example.result)}</div></section>
    <section class="card"><h2>Build on this foundation</h2><ul class="module-list-small">${page.links.map(link => `<li><a href="#${e(link.route)}">${e(link.label)} →</a></li>`).join('')}</ul></section>
    <nav class="button-row foundation-pagination" aria-label="Foundation pages">${pages[index - 1] ? `<a class="btn outline" href="#fundamentals/${e(pages[index - 1].id)}">← ${pages[index - 1].order}. ${e(pages[index - 1].title)}</a>` : '<a class="btn outline" href="#fundamentals">All foundations</a>'}${pages[index + 1] ? `<a class="btn" href="#fundamentals/${e(pages[index + 1].id)}">${pages[index + 1].order}. ${e(pages[index + 1].title)} →</a>` : '<a class="btn" href="#learn">Continue to your learning path →</a>'}</nav>`;
}
