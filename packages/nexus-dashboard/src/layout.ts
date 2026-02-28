export function layout(title: string, body: string, projectName = 'Nexus V6'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nexus — ${escHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:        #060b14;
      --surface:   #0c1422;
      --surface2:  #111d2e;
      --surface3:  #172236;
      --border:    #1a2d44;
      --border2:   #243d5a;
      --text:      #e8eef5;
      --text2:     #b0bec5;
      --muted:     #546e7a;
      --blue:      #4f8ef7;
      --blue-dim:  rgba(79,142,247,.12);
      --green:     #26d97f;
      --green-dim: rgba(38,217,127,.1);
      --yellow:    #f5c542;
      --red:       #f4504a;
      --red-dim:   rgba(244,80,74,.1);
      --orange:    #ff8c42;
      --purple:    #b66ef7;
      --cyan:      #22d3ee;
      --nav-w:     220px;
    }
    html { font-size: 14px; scroll-behavior: smooth; }
    body {
      font-family: -apple-system, 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ── Top bar ─────────────────────────────────────── */
    .topbar {
      height: 48px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 14px;
      position: sticky;
      top: 0;
      z-index: 200;
      flex-shrink: 0;
    }
    .topbar-brand {
      display: flex; align-items: center; gap: 9px;
      font-weight: 800; font-size: 0.95rem; letter-spacing: -0.02em; color: var(--text);
      margin-right: 4px;
    }
    .brand-icon {
      width: 26px; height: 26px; border-radius: 7px;
      background: linear-gradient(135deg, #4f8ef7 0%, #b66ef7 100%);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 900; color: #fff; letter-spacing: -.02em;
      flex-shrink: 0;
    }
    .topbar-nav { display: flex; gap: 2px; }
    .topbar-nav a {
      color: var(--muted); text-decoration: none; font-weight: 500;
      padding: 5px 12px; border-radius: 6px; transition: color .12s, background .12s;
      font-size: 0.85rem; white-space: nowrap;
    }
    .topbar-nav a:hover { color: var(--text); background: var(--surface2); }
    .topbar-nav a.active { color: var(--blue); background: var(--blue-dim); }
    .topbar-spacer { flex: 1; }
    .status-pill {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.75rem; color: var(--muted);
      background: var(--surface2); border: 1px solid var(--border);
      padding: 4px 10px; border-radius: 99px;
    }
    .status-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); animation: livepulse 2s infinite; }
    @keyframes livepulse { 0%,100%{ opacity:1; box-shadow: 0 0 0 0 rgba(38,217,127,.4); } 50%{ opacity:.7; box-shadow: 0 0 0 4px rgba(38,217,127,0); } }
    .topbar-time { font-size: 0.75rem; color: var(--muted); font-variant-numeric: tabular-nums; }

    /* ── Content ────────────────────────────────────── */
    .content { flex: 1; padding: 24px 28px 64px; max-width: 1440px; margin: 0 auto; width: 100%; }

    /* ── Section headings ───────────────────────────── */
    .section { margin-bottom: 20px; }
    .section-title {
      font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .1em; color: var(--muted); margin-bottom: 10px;
    }

    /* ── Cards ──────────────────────────────────────── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 20px;
      transition: border-color .15s;
    }
    .card:hover { border-color: var(--border2); }
    .card-label {
      font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .1em; color: var(--muted); margin-bottom: 12px;
      display: flex; align-items: center; gap: 6px;
    }
    .card-label::after {
      content: ''; flex: 1; height: 1px; background: var(--border);
    }

    /* ── Grids ──────────────────────────────────────── */
    .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .g3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
    .g4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
    @media(max-width:960px){ .g2,.g3,.g4 { grid-template-columns: 1fr 1fr; } }
    @media(max-width:640px){ .g2,.g3,.g4 { grid-template-columns: 1fr; } }

    /* ── Stat tiles ─────────────────────────────────── */
    .stat {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 16px 18px; display: flex; align-items: flex-start; gap: 14px;
      transition: border-color .15s, background .15s;
    }
    .stat:hover { border-color: var(--border2); background: var(--surface2); }
    .stat-icon {
      width: 36px; height: 36px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1rem; flex-shrink: 0;
    }
    .stat-body { display: flex; flex-direction: column; gap: 2px; }
    .stat-num { font-size: 1.8rem; font-weight: 800; line-height: 1; letter-spacing: -0.03em; }
    .stat-lbl { font-size: 0.72rem; color: var(--muted); font-weight: 500; }
    .stat.s-blue  .stat-icon { background: var(--blue-dim); }  .stat.s-blue  .stat-num { color: var(--blue); }
    .stat.s-green .stat-icon { background: var(--green-dim); } .stat.s-green .stat-num { color: var(--green); }
    .stat.s-red   .stat-icon { background: var(--red-dim); }   .stat.s-red   .stat-num { color: var(--red); }
    .stat.s-muted .stat-icon { background: var(--surface3); }  .stat.s-muted .stat-num { color: var(--text2); }
    .stat.s-orange .stat-icon { background: rgba(255,140,66,.1); } .stat.s-orange .stat-num { color: var(--orange); }
    .stat.s-purple .stat-icon { background: rgba(182,110,247,.1); } .stat.s-purple .stat-num { color: var(--purple); }

    /* ── Loop stepper ───────────────────────────────── */
    .loop-track {
      display: flex; align-items: center; gap: 0;
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden; overflow-x: auto;
    }
    .loop-seg {
      flex: 1; min-width: 80px; display: flex; flex-direction: column;
      align-items: center; gap: 5px; padding: 11px 6px;
      font-size: 0.65rem; font-weight: 700; letter-spacing: .07em;
      text-transform: uppercase; color: var(--muted);
      border-right: 1px solid var(--border); cursor: default;
      user-select: none; transition: background .2s;
    }
    .loop-seg:last-child { border-right: none; }
    .seg-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--border); transition: all .2s; }
    .loop-seg.done  { color: var(--green); background: rgba(38,217,127,.05); }
    .loop-seg.done  .seg-dot { background: var(--green); }
    .loop-seg.active { color: var(--blue); background: var(--blue-dim); }
    .loop-seg.active .seg-dot { background: var(--blue); box-shadow: 0 0 0 3px rgba(79,142,247,.25), 0 0 8px rgba(79,142,247,.4); animation: segpulse 1.5s infinite; }
    @keyframes segpulse { 0%,100%{ box-shadow: 0 0 0 3px rgba(79,142,247,.25), 0 0 8px rgba(79,142,247,.4); } 50%{ box-shadow: 0 0 0 5px rgba(79,142,247,.1), 0 0 14px rgba(79,142,247,.3); } }

    /* ── Progress bar ───────────────────────────────── */
    .pbar-row { display: flex; flex-direction: column; gap: 5px; }
    .pbar-meta { display: flex; justify-content: space-between; align-items: center; }
    .pbar-label { font-size: 0.75rem; color: var(--text2); }
    .pbar-pct { font-size: 0.72rem; color: var(--muted); font-variant-numeric: tabular-nums; }
    .pbar { height: 4px; background: var(--surface3); border-radius: 99px; overflow: hidden; }
    .pbar-fill { height: 100%; border-radius: 99px; transition: width .5s cubic-bezier(.4,0,.2,1); }
    .pbar-fill.blue   { background: linear-gradient(90deg, var(--blue), var(--cyan)); }
    .pbar-fill.purple { background: linear-gradient(90deg, var(--purple), var(--blue)); }
    .pbar-fill.green  { background: linear-gradient(90deg, var(--green), var(--cyan)); }

    /* ── Mission block ──────────────────────────────── */
    .mission-block {
      padding: 12px 16px; border-radius: 8px;
      background: linear-gradient(135deg, rgba(79,142,247,.07) 0%, rgba(182,110,247,.05) 100%);
      border: 1px solid rgba(79,142,247,.15);
      font-size: 0.92rem; line-height: 1.55; color: var(--text);
    }
    .mission-empty { color: var(--muted); font-style: italic; font-size: 0.85rem; }

    /* ── KV settings ────────────────────────────────── */
    .kv { display: flex; flex-direction: column; gap: 7px; }
    .kv-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px solid var(--border); }
    .kv-row:last-child { border-bottom: none; }
    .kv-k { font-size: 0.8rem; color: var(--muted); }
    .kv-v {
      font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 5px;
      font-family: monospace; letter-spacing: .01em;
    }
    .kv-v.c-green  { background: var(--green-dim);              color: var(--green); }
    .kv-v.c-blue   { background: var(--blue-dim);               color: var(--blue); }
    .kv-v.c-orange { background: rgba(255,140,66,.1);            color: var(--orange); }
    .kv-v.c-red    { background: var(--red-dim);                color: var(--red); }
    .kv-v.c-purple { background: rgba(182,110,247,.1);          color: var(--purple); }
    .kv-v.c-muted  { background: var(--surface3); color: var(--muted); }
    .kv-v.c-def    { background: var(--surface3); color: var(--text2); }

    /* ── Feed ───────────────────────────────────────── */
    .feed { display: flex; flex-direction: column; gap: 4px; max-height: 250px; overflow-y: auto; }
    .feed::-webkit-scrollbar { width: 3px; }
    .feed::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }
    .feed-row {
      display: grid; grid-template-columns: 18px 1fr auto;
      align-items: center; gap: 8px;
      padding: 7px 10px; border-radius: 7px; background: var(--surface2);
      transition: background .1s;
    }
    .feed-row:hover { background: var(--surface3); }
    .feed-ic { font-size: 0.75rem; text-align: center; }
    .feed-body { font-size: 0.78rem; color: var(--text2); line-height: 1.3; }
    .feed-body strong { color: var(--text); font-weight: 600; }
    .feed-body em { color: var(--muted); font-style: normal; font-size: 0.72rem; }
    .feed-ts { font-size: 0.65rem; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .fbadge { display: inline-block; font-size: 0.62rem; font-weight: 700; padding: 1px 5px; border-radius: 4px; margin-left: 4px; vertical-align: middle; }
    .fbadge.running { background: var(--blue-dim); color: var(--blue); }
    .fbadge.done    { background: var(--green-dim); color: var(--green); }
    .fbadge.failed  { background: var(--red-dim);   color: var(--red); }
    .fbadge.idle    { background: var(--surface3);  color: var(--muted); }

    /* ── Decisions ──────────────────────────────────── */
    .decisions { display: flex; flex-direction: column; gap: 4px; max-height: 250px; overflow-y: auto; }
    .decisions::-webkit-scrollbar { width: 3px; }
    .decisions::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }
    .dec-item {
      font-size: 0.8rem; color: var(--text2); padding: 8px 12px;
      background: var(--surface2); border-radius: 7px; line-height: 1.45;
      border-left: 2px solid var(--purple);
      transition: background .1s;
    }
    .dec-item:hover { background: var(--surface3); color: var(--text); }

    /* ── Session table ──────────────────────────────── */
    .sess { display: flex; flex-direction: column; gap: 8px; }
    .sess-row { display: flex; gap: 12px; align-items: flex-start; padding: 5px 0; border-bottom: 1px solid var(--border); }
    .sess-row:last-child { border-bottom: none; }
    .sess-k { font-size: 0.75rem; color: var(--muted); min-width: 96px; padding-top: 1px; flex-shrink: 0; }
    .sess-v { font-size: 0.8rem; color: var(--text); line-height: 1.4; word-break: break-all; }

    /* ── Blocker banner ─────────────────────────────── */
    .blocker-banner {
      background: var(--red-dim); border: 1px solid rgba(244,80,74,.25);
      border-radius: 10px; padding: 14px 18px; display: flex; flex-direction: column; gap: 8px;
    }
    .blocker-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--red); margin-bottom: 2px; }
    .blocker-item { font-size: 0.84rem; color: #fca5a5; display: flex; gap: 8px; align-items: flex-start; }

    /* ── Wave / task graph ──────────────────────────── */
    .tg-meta { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 18px; font-size: 0.8rem; color: var(--muted); }
    .tg-meta span strong { color: var(--text); }
    .waves { display: flex; flex-direction: column; gap: 6px; }
    .wave-group { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .wave-hdr {
      display: flex; align-items: center; gap: 10px; padding: 10px 16px;
      background: var(--surface2); border-bottom: 1px solid var(--border);
      font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    }
    .wave-num { color: var(--blue); }
    .wave-count { color: var(--muted); }
    .wave-sep { flex: 1; }
    .wave-body { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 14px; }
    .wave-connector { text-align: center; color: var(--border2); font-size: 0.9rem; padding: 3px; }
    .tcard {
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: 9px; padding: 11px 13px; min-width: 190px; max-width: 280px;
      position: relative; transition: border-color .15s, transform .12s;
    }
    .tcard:hover { border-color: var(--border2); transform: translateY(-1px); }
    .tcard-status-bar { position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 9px 9px 0 0; }
    .tcard-id { font-family: monospace; font-size: 0.65rem; color: var(--muted); margin-bottom: 5px; margin-top: 4px; }
    .tcard-desc { font-size: 0.82rem; color: var(--text); line-height: 1.4; margin-bottom: 8px; }
    .tcard-meta { display: flex; gap: 4px; flex-wrap: wrap; }
    .tcard-deps { font-size: 0.65rem; color: var(--muted); margin-top: 6px; }
    .tbadge { font-size: 0.62rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; }
    .tbadge.status { color: #fff; }
    .tbadge.risk   { background: var(--surface3); color: var(--text2); }
    .tbadge.tdd    { background: rgba(182,110,247,.15); color: var(--purple); }

    /* ── Scars ──────────────────────────────────────── */
    .scar-summary { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 18px; }
    .scat-tile { background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; padding: 12px 14px; }
    .scat-tile .n { font-size: 1.5rem; font-weight: 800; color: var(--text); line-height: 1; }
    .scat-tile .l { font-size: 0.68rem; color: var(--muted); margin-top: 2px; }
    .rules-box {
      background: var(--green-dim); border: 1px solid rgba(38,217,127,.2);
      border-radius: 10px; padding: 14px 18px; margin-bottom: 18px;
    }
    .rules-title { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--green); margin-bottom: 10px; }
    .rules-list { display: flex; flex-direction: column; gap: 5px; }
    .rule-item { font-size: 0.82rem; color: #86efac; display: flex; gap: 8px; align-items: flex-start; }
    .rule-bullet { color: var(--green); flex-shrink: 0; }
    .scar-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 16px; margin-bottom: 8px; transition: border-color .15s;
    }
    .scar-card:hover { border-color: var(--border2); }
    .scar-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
    .scar-id   { font-family: monospace; font-size: 0.7rem; color: var(--muted); }
    .scar-date { font-size: 0.7rem; color: var(--muted); margin-left: auto; }
    .scar-desc { font-size: 0.88rem; font-weight: 600; color: var(--text); margin-bottom: 5px; }
    .scar-root { font-size: 0.8rem; color: var(--muted); margin-bottom: 10px; }
    .scar-rule { font-size: 0.8rem; color: #86efac; padding: 7px 11px; background: var(--green-dim); border-radius: 6px; }
    .scar-files { font-size: 0.7rem; color: var(--muted); margin-top: 6px; }
    .scat-badge { font-size: 0.62rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: lowercase; }

    /* ── Artifacts ──────────────────────────────────── */
    .img-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; }
    .img-item img { max-width: 360px; border-radius: 9px; border: 1px solid var(--border); display: block; }
    .img-item .cap { font-size: 0.68rem; color: var(--muted); margin-top: 5px; }
    .file-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
    .file-row {
      display: flex; align-items: center; gap: 10px; padding: 8px 12px;
      background: var(--surface2); border-radius: 7px; font-size: 0.82rem;
      text-decoration: none; color: var(--text2); transition: background .1s, color .1s;
    }
    .file-row:hover { background: var(--surface3); color: var(--text); }
    .file-icon { font-size: 0.9rem; }
    .file-time { margin-left: auto; font-size: 0.7rem; color: var(--muted); }

    /* ── Empty state ─────────────────────────────────── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; padding: 48px 24px; color: var(--muted);
    }
    .empty-icon { font-size: 2rem; opacity: .4; }
    .empty-msg { font-size: 0.88rem; text-align: center; line-height: 1.5; }
    .empty-msg code { background: var(--surface2); padding: 2px 7px; border-radius: 4px; font-family: monospace; color: var(--text2); font-size: 0.85em; }

    /* ── Misc ───────────────────────────────────────── */
    code { background: var(--surface2); padding: 2px 7px; border-radius: 4px; font-family: monospace; font-size: 0.85em; color: var(--cyan); }
    .divider { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ── Live update toast ─────────────────────────── */
    .update-toast {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: var(--surface); border: 1px solid var(--green);
      border-radius: 10px; padding: 10px 18px;
      display: flex; align-items: center; gap: 9px;
      font-size: 0.82rem; color: var(--text);
      box-shadow: 0 8px 32px rgba(0,0,0,.5);
      transform: translateY(80px); opacity: 0;
      transition: transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s;
      pointer-events: none;
    }
    .update-toast.show { transform: translateY(0); opacity: 1; }
    .update-toast .toast-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); flex-shrink: 0; }
    .update-toast .toast-refresh { margin-left: 4px; cursor: pointer; pointer-events: all; color: var(--blue); font-weight: 600; text-decoration: underline; }

    /* ── Tooltip ────────────────────────────────────── */
    [data-tip] { position: relative; cursor: default; }
    [data-tip]:hover::after {
      content: attr(data-tip);
      position: absolute; bottom: calc(100% + 5px); left: 50%; transform: translateX(-50%);
      background: #1a2d44; color: var(--text); font-size: 0.72rem; padding: 4px 9px;
      border-radius: 5px; white-space: nowrap; pointer-events: none; z-index: 999;
      border: 1px solid var(--border2); box-shadow: 0 4px 12px rgba(0,0,0,.4);
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-brand">
      <div class="brand-icon">N6</div>
      ${escHtml(projectName)}
    </div>
    <nav class="topbar-nav">
      <a href="/">Overview</a>
      <a href="/task-graph">Task Graph</a>
      <a href="/scars">Scars</a>
    </nav>
    <div class="topbar-spacer"></div>
    <div class="status-pill" id="live-pill"><span class="dot"></span><span id="live-label">Live</span></div>
    <div class="topbar-time" id="clock"></div>
  </header>
  <main class="content">
    ${body}
  </main>
  <div class="update-toast" id="update-toast">
    <span class="toast-dot"></span>
    <span>State updated</span>
    <span class="toast-refresh" onclick="location.reload()">Refresh</span>
  </div>
  <script>
    // Active nav
    document.querySelectorAll('.topbar-nav a').forEach(a => {
      if (a.getAttribute('href') === location.pathname) a.classList.add('active');
    });
    // Clock
    const clock = document.getElementById('clock');
    if (clock) {
      const tick = () => { clock.textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}); };
      tick(); setInterval(tick, 1000);
    }
    // SSE live state updates — show toast when state changes, auto-reload
    let lastState = null, initialized = false;
    let toastTimer = null;
    const toast = document.getElementById('update-toast');
    const pill = document.getElementById('live-pill');
    const liveLabel = document.getElementById('live-label');

    function showToast() {
      if (!toast) return;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        // Auto-reload after toast shown
        setTimeout(() => location.reload(), 300);
      }, 1800);
    }

    const es = new EventSource('/events');
    es.onopen = () => {
      if (pill) pill.style.borderColor = 'var(--green)';
      if (liveLabel) liveLabel.textContent = 'Live';
    };
    es.onmessage = e => {
      if (!initialized) { lastState = e.data; initialized = true; return; }
      if (e.data !== lastState) { lastState = e.data; showToast(); }
    };
    es.onerror = () => {
      if (pill) { pill.style.borderColor = 'var(--red)'; pill.style.color = 'var(--red)'; }
      if (liveLabel) liveLabel.textContent = 'Reconnecting…';
      setTimeout(() => location.reload(), 8000);
    };
  </script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
