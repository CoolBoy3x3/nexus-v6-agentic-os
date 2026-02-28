import type { ProjectState, TaskGraph, ProjectSettings } from '@nexus/core';

export interface LogEntry {
  agentName: string;
  timestamp: number;
  status: string;
  taskId?: string;
  detail?: string;
}

export function renderOverview(
  state: ProjectState,
  graph: TaskGraph | null,
  settings: ProjectSettings | null,
  log: LogEntry[],
): string {
  const running   = graph?.tasks.filter((t) => t.status === 'running')   ?? [];
  const pending   = graph?.tasks.filter((t) => t.status === 'pending')   ?? [];
  const completed = graph?.tasks.filter((t) => t.status === 'completed') ?? [];
  const failed    = graph?.tasks.filter((t) => t.status === 'failed')    ?? [];
  const blocked   = graph?.tasks.filter((t) => t.status === 'blocked')   ?? [];

  const loopSteps  = ['pre-plan', 'planning', 'executing', 'verifying', 'unifying', 'complete'];
  const loopLabels = ['Pre-Plan', 'Plan', 'Execute', 'Verify', 'Unify', 'Complete'];
  const loopTips   = [
    'Project not yet initialised',
    'Decomposing work into task graph',
    'Workers running tasks in parallel',
    'Running verification ladder',
    'Merging verified work, updating architecture',
    'Phase complete',
  ];
  const currentIdx = loopSteps.indexOf(state.loopPosition);

  const loopHtml = loopLabels.map((label, i) => {
    const cls = i === currentIdx ? 'active' : i < currentIdx ? 'done' : '';
    return `<div class="loop-seg ${cls}" data-tip="${loopTips[i]}"><span class="seg-dot"></span>${escHtml(label)}</div>`;
  }).join('');

  const taskPct  = state.metrics.tasksTotal  > 0 ? Math.round((state.metrics.tasksComplete  / state.metrics.tasksTotal)  * 100) : 0;
  const phasePct = state.metrics.phasesTotal > 0 ? Math.round((state.metrics.phasesComplete / state.metrics.phasesTotal) * 100) : 0;

  // Blocker banner
  const blockerHtml = state.blockers.length > 0
    ? `<div class="section">
        <div class="blocker-banner">
          <div class="blocker-title">⚠ Active Blockers</div>
          ${state.blockers.map((b) => `<div class="blocker-item"><span>🚫</span><span>${escHtml(b)}</span></div>`).join('')}
        </div>
      </div>`
    : '';

  // Settings panel
  const settingsHtml = settings
    ? `<div class="kv">
        ${kvr('Autonomy',    autoColor(settings.autonomy?.default),  settings.autonomy?.default  ?? '—')}
        ${kvr('TDD Mode',    tddColor(settings.tdd?.default),        settings.tdd?.default        ?? '—')}
        ${kvr('Playwright',  settings.playwright?.enabled ? 'c-green' : 'c-muted', settings.playwright?.enabled ? 'enabled' : 'disabled')}
        ${kvr('Checkpoints', settings.checkpoints?.beforeHighRisk ? 'c-green' : 'c-muted', settings.checkpoints?.beforeHighRisk ? 'before high-risk' : 'off')}
        ${kvr('Max kept',    'c-def', `${settings.checkpoints?.maxRetained ?? 10} checkpoints`)}
        ${kvr('Port',        'c-blue', String(settings.dashboard?.port ?? 7890))}
      </div>`
    : `<div class="empty-state" style="padding:20px 0">
        <div class="empty-icon">⚙</div>
        <div class="empty-msg">No <code>settings.json</code><br>Run <code>/nexus:init</code></div>
      </div>`;

  // Activity feed
  const recentLog = log.slice(-30).reverse();
  const feedHtml = recentLog.length > 0
    ? recentLog.map((e) => {
        const bc  = fbadge(e.status);
        const ic  = ficon(e.status);
        const tid = e.taskId ? ` <em>${escHtml(e.taskId)}</em>` : '';
        return `<div class="feed-row">
          <span class="feed-ic">${ic}</span>
          <span class="feed-body"><strong>${escHtml(e.agentName)}</strong>${tid} <span class="fbadge ${bc}">${escHtml(e.status)}</span></span>
          <span class="feed-ts">${relTime(e.timestamp)}</span>
        </div>`;
      }).join('')
    : `<div class="empty-state" style="padding:20px 0"><div class="empty-icon">📋</div><div class="empty-msg">No activity yet</div></div>`;

  // Decisions
  const decisionsHtml = state.decisions.length > 0
    ? state.decisions.slice().reverse().map((d) => `<div class="dec-item">${escHtml(d)}</div>`).join('')
    : `<div class="empty-state" style="padding:20px 0"><div class="empty-icon">💡</div><div class="empty-msg">No decisions recorded yet</div></div>`;

  const scarsWarning = state.metrics.scarsCount > 0
    ? `<a href="/scars" style="color:var(--orange);font-size:0.75rem">⚠ ${state.metrics.scarsCount} scar${state.metrics.scarsCount > 1 ? 's' : ''} recorded</a>`
    : `<span style="color:var(--green);font-size:0.75rem">✓ No scars</span>`;

  return `
    <!-- Stat row -->
    <div class="section g4" style="margin-bottom:18px">
      <div class="stat s-blue"  data-tip="Tasks currently being executed">
        <div class="stat-icon">⚡</div>
        <div class="stat-body"><span class="stat-num">${running.length}</span><span class="stat-lbl">Running</span></div>
      </div>
      <div class="stat s-muted" data-tip="Tasks queued, waiting for their wave">
        <div class="stat-icon">⏳</div>
        <div class="stat-body"><span class="stat-num">${pending.length}</span><span class="stat-lbl">Pending</span></div>
      </div>
      <div class="stat s-green" data-tip="Tasks that passed full verification">
        <div class="stat-icon">✓</div>
        <div class="stat-body"><span class="stat-num">${completed.length}</span><span class="stat-lbl">Completed</span></div>
      </div>
      <div class="stat s-red"   data-tip="Tasks that failed — check scars for root cause">
        <div class="stat-icon">✗</div>
        <div class="stat-body"><span class="stat-num">${failed.length + blocked.length}</span><span class="stat-lbl">Failed / Blocked</span></div>
      </div>
    </div>

    ${blockerHtml}

    <!-- Mission + Loop -->
    <div class="section g2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-label">Mission</div>
        ${state.mission
          ? `<div class="mission-block">${escHtml(state.mission)}</div>`
          : `<div class="mission-block mission-empty">(not set — run /nexus:init to define the mission)</div>`}
        <div class="divider"></div>
        <div class="card-label">Current Phase</div>
        <div style="font-size:0.88rem;color:var(--text);margin-bottom:${state.currentPlan ? '4px' : '0'}">${escHtml(state.currentPhase || '(none)')}</div>
        ${state.currentPlan ? `<div style="font-size:0.72rem;color:var(--muted)">Plan: ${escHtml(state.currentPlan)}</div>` : ''}
      </div>

      <div class="card">
        <div class="card-label">Governance Loop</div>
        <div class="loop-track" style="margin-bottom:18px">${loopHtml}</div>
        <div class="card-label">Progress</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="pbar-row">
            <div class="pbar-meta">
              <span class="pbar-label">Tasks</span>
              <span class="pbar-pct">${state.metrics.tasksComplete}/${state.metrics.tasksTotal} · ${taskPct}%</span>
            </div>
            <div class="pbar"><div class="pbar-fill blue" style="width:${taskPct}%"></div></div>
          </div>
          <div class="pbar-row">
            <div class="pbar-meta">
              <span class="pbar-label">Phases</span>
              <span class="pbar-pct">${state.metrics.phasesComplete}/${state.metrics.phasesTotal} · ${phasePct}%</span>
            </div>
            <div class="pbar"><div class="pbar-fill purple" style="width:${phasePct}%"></div></div>
          </div>
        </div>
        <div style="margin-top:12px">${scarsWarning}</div>
      </div>
    </div>

    <!-- Settings + Session -->
    <div class="section g2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-label">Project Settings</div>
        ${settingsHtml}
      </div>

      <div class="card">
        <div class="card-label">Session Continuity</div>
        <div class="sess">
          <div class="sess-row">
            <span class="sess-k">Last updated</span>
            <span class="sess-v">${escHtml(state.sessionContinuity.lastUpdated)}</span>
          </div>
          <div class="sess-row">
            <span class="sess-k">Next action</span>
            <span class="sess-v" style="color:var(--blue)">${escHtml(state.sessionContinuity.nextAction)}</span>
          </div>
          <div class="sess-row">
            <span class="sess-k">Handoff file</span>
            <span class="sess-v">${escHtml(state.sessionContinuity.handoffFile || '(none)')}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Feed + Decisions -->
    <div class="section g2">
      <div class="card">
        <div class="card-label">Activity Feed</div>
        <div class="feed">${feedHtml}</div>
      </div>

      <div class="card">
        <div class="card-label">Recent Decisions</div>
        <div class="decisions">${decisionsHtml}</div>
      </div>
    </div>
  `;
}

function kvr(key: string, cls: string, val: string): string {
  return `<div class="kv-row"><span class="kv-k">${escHtml(key)}</span><span class="kv-v ${cls}">${escHtml(val)}</span></div>`;
}

function autoColor(level?: string): string {
  const m: Record<string, string> = { low: 'c-green', medium: 'c-blue', high: 'c-orange', critical: 'c-red' };
  return m[level ?? ''] ?? 'c-def';
}

function tddColor(mode?: string): string {
  const m: Record<string, string> = { hard: 'c-red', standard: 'c-blue', skip: 'c-muted' };
  return m[mode ?? ''] ?? 'c-def';
}

function fbadge(status: string): string {
  if (status === 'running' || status === 'working') return 'running';
  if (status === 'done' || status === 'completed')  return 'done';
  if (status === 'failed') return 'failed';
  return 'idle';
}

function ficon(status: string): string {
  const m: Record<string, string> = { running: '⚡', working: '⚡', done: '✓', completed: '✓', failed: '✗', blocked: '⊘', idle: '·' };
  return m[status] ?? '·';
}

function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
