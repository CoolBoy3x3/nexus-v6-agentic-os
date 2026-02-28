import type { Scar } from '@nexus/core';

const CAT_ICON: Record<string, string> = {
  logic:       '🔢',
  integration: '🔌',
  performance: '⚡',
  security:    '🔒',
  ux:          '🎨',
  data:        '🗄',
  test:        '🧪',
  other:       '📌',
};

const CAT_COLOR: Record<string, string> = {
  logic:       'rgba(79,142,247,.15)',
  integration: 'rgba(34,211,238,.12)',
  performance: 'rgba(255,140,66,.12)',
  security:    'rgba(244,80,74,.12)',
  ux:          'rgba(182,110,247,.12)',
  data:        'rgba(38,217,127,.1)',
  test:        'rgba(245,197,66,.1)',
  other:       'rgba(84,110,122,.12)',
};

const CAT_TEXT: Record<string, string> = {
  logic:       '#4f8ef7',
  integration: '#22d3ee',
  performance: '#ff8c42',
  security:    '#f4504a',
  ux:          '#b66ef7',
  data:        '#26d97f',
  test:        '#f5c542',
  other:       '#546e7a',
};

export function renderScars(scars: Scar[]): string {
  if (scars.length === 0) {
    return `<div class="empty-state">
      <div class="empty-icon">🛡</div>
      <div class="empty-msg">No scars yet — clean project history.<br>Scars are recorded when tasks fail so failures are never forgotten.</div>
    </div>`;
  }

  // Category breakdown
  const catCounts: Record<string, number> = {};
  for (const s of scars) { catCounts[s.category] = (catCounts[s.category] ?? 0) + 1; }
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

  const catHtml = topCats.map(([cat, n]) => {
    const ic = CAT_ICON[cat] ?? '📌';
    const tc = CAT_TEXT[cat] ?? '#546e7a';
    return `<div class="scat-tile" style="border-top:2px solid ${tc}">
      <div class="n">${ic} ${n}</div>
      <div class="l">${escHtml(cat)}</div>
    </div>`;
  }).join('');

  // Prevention rules
  const rules = [...new Set(scars.map((s) => s.preventionRule).filter(Boolean))];
  const rulesHtml = rules.length > 0
    ? `<div class="rules-box">
        <div class="rules-title">🛡 Active Prevention Rules (${rules.length})</div>
        <div class="rules-list">
          ${rules.map((r) => `<div class="rule-item"><span class="rule-bullet">▸</span><span>${escHtml(r)}</span></div>`).join('')}
        </div>
      </div>`
    : '';

  // Scar cards — newest first
  const cardsHtml = scars.slice().reverse().map((s) => {
    const ic  = CAT_ICON[s.category]  ?? '📌';
    const bg  = CAT_COLOR[s.category] ?? 'rgba(84,110,122,.1)';
    const tc  = CAT_TEXT[s.category]  ?? '#546e7a';
    const dateStr = s.timestamp.slice(0, 10);
    const filesHtml = s.filesAffected.length > 0
      ? `<div class="scar-files">Files: ${s.filesAffected.map(escHtml).join(', ')}</div>`
      : '';
    return `<div class="scar-card">
      <div class="scar-top">
        <span class="scar-id">${escHtml(s.id)}</span>
        <span class="scat-badge" style="background:${bg};color:${tc}">${ic} ${escHtml(s.category)}</span>
        <span class="scar-date">${dateStr}</span>
      </div>
      <div class="scar-desc">${escHtml(s.description)}</div>
      <div class="scar-root">Root cause: ${escHtml(s.rootCause)}</div>
      <div class="scar-rule">🛡 ${escHtml(s.preventionRule)}</div>
      ${filesHtml}
    </div>`;
  }).join('');

  return `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div style="font-size:1rem;font-weight:700;color:var(--text)">${scars.length} Scar${scars.length !== 1 ? 's' : ''} Recorded</div>
      <div style="font-size:0.78rem;color:var(--muted)">${rules.length} active prevention rule${rules.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="scar-summary">${catHtml}</div>
    ${rulesHtml}
    <div>${cardsHtml}</div>
  `;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
