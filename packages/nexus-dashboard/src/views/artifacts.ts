export interface ArtifactEntry {
  taskId: string;
  type: string;
  filename: string;
  path: string;
  capturedAt: string;
  description?: string;
}

export function renderArtifacts(taskId: string, artifacts: ArtifactEntry[]): string {
  if (artifacts.length === 0) {
    return `<div class="empty-state">
      <div class="empty-icon">📂</div>
      <div class="empty-msg">No artifacts for task <code>${escHtml(taskId)}</code>.</div>
    </div>`;
  }

  const screenshots = artifacts.filter((a) => a.type === 'screenshot');
  const traces      = artifacts.filter((a) => a.type === 'trace');
  const logs        = artifacts.filter((a) => a.type === 'log');
  const others      = artifacts.filter((a) => !['screenshot', 'trace', 'log'].includes(a.type));

  const screenshotsHtml = screenshots.length > 0
    ? `<div class="section-title" style="margin-bottom:10px">Screenshots (${screenshots.length})</div>
       <div class="img-grid" style="margin-bottom:20px">
         ${screenshots.map((a) => `
           <div class="img-item">
             <img src="/artifacts/${encodeURIComponent(a.taskId)}/${encodeURIComponent(a.filename)}"
                  alt="${escHtml(a.description ?? a.filename)}" loading="lazy" />
             <div class="cap">${escHtml(a.filename)} · ${escHtml(a.capturedAt)}</div>
           </div>`).join('')}
       </div>`
    : '';

  const fileSection = (label: string, items: ArtifactEntry[], icon: string) =>
    items.length > 0
      ? `<div class="section-title" style="margin-bottom:8px">${icon} ${label} (${items.length})</div>
         <div class="file-list" style="margin-bottom:16px">
           ${items.map((a) => `
             <a class="file-row" href="/artifacts/${encodeURIComponent(a.taskId)}/${encodeURIComponent(a.filename)}" target="_blank">
               <span class="file-icon">${icon}</span>
               <span>${escHtml(a.filename)}</span>
               <span class="file-time">${escHtml(a.capturedAt)}</span>
             </a>`).join('')}
         </div>`
      : '';

  return `
    <div style="font-size:0.88rem;color:var(--muted);margin-bottom:20px">
      Task: <code style="color:var(--cyan)">${escHtml(taskId)}</code> · ${artifacts.length} artifact${artifacts.length !== 1 ? 's' : ''}
    </div>
    ${screenshotsHtml}
    ${fileSection('Traces',  traces, '🔍')}
    ${fileSection('Logs',    logs,   '📄')}
    ${fileSection('Other',   others, '📎')}
  `;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
