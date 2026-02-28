import type { TaskGraph, TaskNode } from '@nexus/core';

const STATUS_COLOR: Record<string, string> = {
  pending:    '#546e7a',
  running:    '#4f8ef7',
  completed:  '#26d97f',
  failed:     '#f4504a',
  blocked:    '#ff8c42',
  superseded: '#374151',
};

const STATUS_BG: Record<string, string> = {
  pending:    'rgba(84,110,122,.15)',
  running:    'rgba(79,142,247,.18)',
  completed:  'rgba(38,217,127,.15)',
  failed:     'rgba(244,80,74,.15)',
  blocked:    'rgba(255,140,66,.15)',
  superseded: 'rgba(55,65,81,.2)',
};

const STATUS_ICON: Record<string, string> = {
  pending:    '○',
  running:    '⚡',
  completed:  '✓',
  failed:     '✗',
  blocked:    '⊘',
  superseded: '↩',
};

export function renderTaskGraph(graph: TaskGraph | null): string {
  if (!graph || graph.tasks.length === 0) {
    return `<div class="empty-state">
      <div class="empty-icon">🗺</div>
      <div class="empty-msg">No task graph yet.<br>Run <code>/nexus:plan</code> to decompose your mission into tasks.</div>
    </div>`;
  }

  const counts: Record<string, number> = {};
  for (const t of graph.tasks) { counts[t.status] = (counts[t.status] ?? 0) + 1; }

  const summaryHtml = ['running','pending','completed','failed','blocked']
    .filter((s) => (counts[s] ?? 0) > 0)
    .map((s) => {
      const col = STATUS_COLOR[s] ?? '#fff';
      const bg  = STATUS_BG[s]    ?? 'transparent';
      return `<span style="font-size:0.75rem;font-weight:700;padding:3px 10px;border-radius:99px;background:${bg};color:${col}">${STATUS_ICON[s] ?? ''} ${counts[s]} ${s}</span>`;
    }).join('');

  const waveMap: Record<number, TaskNode[]> = {};
  for (const t of graph.tasks) {
    if (!waveMap[t.wave]) waveMap[t.wave] = [];
    waveMap[t.wave]!.push(t);
  }
  const waveNums = Object.keys(waveMap).map(Number).sort((a, b) => a - b);

  const wavesHtml = waveNums.map((wn, wi) => {
    const tasks = waveMap[wn] ?? [];
    const waveComplete = tasks.every((t) => t.status === 'completed' || t.status === 'superseded');
    const waveRunning  = tasks.some((t) => t.status === 'running');
    const waveHdrColor = waveComplete ? 'var(--green)' : waveRunning ? 'var(--blue)' : 'var(--muted)';
    const waveIndicator = waveComplete ? '✓' : waveRunning ? '⚡' : String(wi + 1);
    const doneCnt = tasks.filter((t) => t.status === 'completed').length;

    const tasksHtml = tasks.map((t) => {
      const sc = STATUS_COLOR[t.status] ?? '#fff';
      const sb = STATUS_BG[t.status]    ?? 'transparent';
      const si = STATUS_ICON[t.status]  ?? '·';
      const depsHtml = t.dependsOn.length > 0
        ? `<div class="tcard-deps">↪ depends on: ${t.dependsOn.map(escHtml).join(', ')}</div>`
        : '';
      return `<div class="tcard">
        <div class="tcard-status-bar" style="background:${sc}"></div>
        <div class="tcard-id">${escHtml(t.id)}</div>
        <div class="tcard-desc">${escHtml(t.description)}</div>
        <div class="tcard-meta">
          <span class="tbadge status" style="background:${sb};color:${sc}">${si} ${escHtml(t.status)}</span>
          <span class="tbadge risk" data-tip="Risk tier">${escHtml(t.riskTier)}</span>
          <span class="tbadge tdd"  data-tip="TDD mode">${escHtml(t.tddMode)}</span>
        </div>
        ${depsHtml}
      </div>`;
    }).join('');

    const connector = wi < waveNums.length - 1
      ? `<div class="wave-connector">▼</div>`
      : '';

    return `<div class="wave-group">
      <div class="wave-hdr">
        <span style="color:${waveHdrColor};font-size:0.8rem;font-weight:800;min-width:18px;text-align:center">${waveIndicator}</span>
        <span class="wave-num">Wave ${wn}</span>
        <span class="wave-count">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</span>
        <span class="wave-sep"></span>
        <span style="font-size:0.7rem;color:var(--muted)">${doneCnt}/${tasks.length} done</span>
      </div>
      <div class="wave-body">${tasksHtml}</div>
    </div>${connector}`;
  }).join('');

  return `
    <div class="tg-meta">
      <span><strong>Mission:</strong> ${escHtml(graph.mission || '(none)')}</span>
      <span><strong>Phase:</strong> ${escHtml(graph.currentPhase || '(none)')}</span>
      <span><strong>Total:</strong> ${graph.tasks.length} tasks · ${waveNums.length} waves</span>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">${summaryHtml}</div>
    <div class="waves">${wavesHtml}</div>
  `;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
