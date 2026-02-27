import express from 'express';
import { scenarioRegistry, scenarioList } from './scenarios';
import { simulate, formatTranscript, SimulationTranscript } from './runner';

const app = express();
app.use(express.json());

// ─── API Endpoints ──────────────────────────────────────────────

app.get('/dev/scenarios', (_req, res) => {
  res.json(scenarioList.map((s) => ({
    number: s.number,
    key: s.key,
    title: s.title,
    category: s.category,
    description: s.description,
    implemented: s.implemented,
  })));
});

app.post('/dev/simulate', (req, res) => {
  const { number, key, params } = req.body ?? {};
  const scenario = number
    ? scenarioRegistry.get(number)
    : key
      ? scenarioList.find((s) => s.key === key)
      : undefined;

  if (!scenario) {
    res.status(404).json({ error: `Scenario not found: ${number ?? key}` });
    return;
  }

  try {
    const transcript = simulate(scenario, params ?? {});
    res.json(transcript);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Dev UI ─────────────────────────────────────────────────────

app.get('/dev', (_req, res) => {
  res.type('html').send(DEV_UI_HTML);
});

const DEV_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Chat Brain Simulator</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e0e0e0; display: flex; height: 100vh; }
  .sidebar { width: 340px; background: #111; border-right: 1px solid #222; overflow-y: auto; flex-shrink: 0; }
  .sidebar h2 { padding: 16px; font-size: 14px; color: #888; border-bottom: 1px solid #222; }
  .scenario-item { padding: 10px 16px; border-bottom: 1px solid #1a1a1a; cursor: pointer; transition: background 0.15s; }
  .scenario-item:hover { background: #1a1a1a; }
  .scenario-item.active { background: #1a2a1a; border-left: 3px solid #4caf50; }
  .scenario-item .num { color: #4caf50; font-weight: 700; font-size: 13px; }
  .scenario-item .title { font-size: 13px; margin-left: 6px; }
  .scenario-item .cat { font-size: 11px; color: #666; display: block; margin-top: 2px; }
  .scenario-item .status { font-size: 11px; color: #888; float: right; }
  .scenario-item .status.impl { color: #4caf50; }
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .toolbar { padding: 12px 20px; background: #111; border-bottom: 1px solid #222; display: flex; gap: 10px; align-items: center; }
  .toolbar button { padding: 8px 16px; border: 1px solid #333; border-radius: 6px; background: #1a1a1a; color: #e0e0e0; cursor: pointer; font-size: 13px; }
  .toolbar button:hover { background: #222; }
  .toolbar button.primary { background: #1a3a1a; border-color: #4caf50; color: #4caf50; }
  .toolbar button.primary:hover { background: #2a4a2a; }
  .content { flex: 1; overflow-y: auto; padding: 20px; }
  .message-card { background: #151515; border: 1px solid #222; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .message-card .msg-id { font-size: 11px; color: #666; }
  .message-card .msg-to { font-size: 11px; color: #888; margin-left: 10px; }
  .message-card .msg-urgency { font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 8px; }
  .message-card .msg-urgency.high { background: #3a1a1a; color: #f44336; }
  .message-card .msg-urgency.low { background: #1a2a1a; color: #888; }
  .message-card .msg-text { margin: 10px 0; font-size: 14px; line-height: 1.5; }
  .message-card .section { margin: 10px 0; }
  .message-card .section h4 { font-size: 12px; color: #888; margin-bottom: 4px; }
  .message-card .section li { font-size: 13px; margin-left: 16px; line-height: 1.6; color: #ccc; }
  .actions-row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .action-btn { padding: 6px 14px; border-radius: 6px; font-size: 12px; border: 1px solid #333; cursor: default; }
  .action-btn.primary { background: #1a3a1a; border-color: #4caf50; color: #4caf50; }
  .action-btn.secondary { background: #1a1a2a; border-color: #5577aa; color: #88aacc; }
  .action-btn.danger { background: #2a1a1a; border-color: #f44336; color: #f44336; }
  .transitions { margin-top: 16px; }
  .transitions h3 { font-size: 13px; color: #888; margin-bottom: 8px; }
  .transition-item { font-size: 12px; color: #4caf50; padding: 4px 0; }
  .errors { margin-top: 16px; }
  .errors .err { color: #f44336; font-size: 12px; padding: 4px 0; }
  .empty { color: #555; text-align: center; margin-top: 100px; font-size: 16px; }
  pre { background: #0a0a0a; border: 1px solid #222; border-radius: 4px; padding: 12px; font-size: 12px; overflow-x: auto; max-height: 300px; overflow-y: auto; }
  .filter-row { padding: 8px 16px; display: flex; gap: 6px; flex-wrap: wrap; }
  .filter-btn { padding: 4px 10px; border-radius: 12px; font-size: 11px; border: 1px solid #333; background: #1a1a1a; color: #888; cursor: pointer; }
  .filter-btn.active { background: #1a2a1a; border-color: #4caf50; color: #4caf50; }
</style>
</head>
<body>
<div class="sidebar">
  <h2>CHAT BRAIN SIMULATOR</h2>
  <div class="filter-row" id="filters"></div>
  <div id="scenario-list"></div>
</div>
<div class="main">
  <div class="toolbar">
    <button class="primary" id="btn-run" disabled>Run Scenario</button>
    <button id="btn-json">Toggle JSON</button>
    <span id="status" style="font-size:12px;color:#666;"></span>
  </div>
  <div class="content" id="content">
    <div class="empty">Select a scenario from the sidebar to begin</div>
  </div>
</div>
<script>
let scenarios = [];
let selected = null;
let showJson = false;
let activeFilter = null;

async function loadScenarios() {
  const res = await fetch('/dev/scenarios');
  scenarios = await res.json();
  renderFilters();
  renderList();
}

function renderFilters() {
  const cats = [...new Set(scenarios.map(s => s.category))];
  const el = document.getElementById('filters');
  el.innerHTML = '<button class="filter-btn active" data-cat="">All</button>' +
    cats.map(c => '<button class="filter-btn" data-cat="' + c + '">' + c + '</button>').join('');
  el.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      activeFilter = btn.dataset.cat || null;
      el.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderList();
    };
  });
}

function renderList() {
  const el = document.getElementById('scenario-list');
  const filtered = activeFilter ? scenarios.filter(s => s.category === activeFilter) : scenarios;
  el.innerHTML = filtered.map(s =>
    '<div class="scenario-item' + (selected === s.number ? ' active' : '') + '" data-num="' + s.number + '">' +
    '<span class="status' + (s.implemented ? ' impl' : '') + '">' + (s.implemented ? 'FULL' : 'STUB') + '</span>' +
    '<span class="num">#' + s.number + '</span>' +
    '<span class="title">' + s.title + '</span>' +
    '<span class="cat">' + s.category + ' — ' + s.description + '</span>' +
    '</div>'
  ).join('');
  el.querySelectorAll('.scenario-item').forEach(item => {
    item.onclick = () => {
      selected = parseInt(item.dataset.num);
      document.getElementById('btn-run').disabled = false;
      renderList();
      document.getElementById('status').textContent = 'Ready: #' + selected;
    };
  });
}

document.getElementById('btn-run').onclick = async () => {
  if (!selected) return;
  document.getElementById('status').textContent = 'Running #' + selected + '...';
  try {
    const res = await fetch('/dev/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: selected }),
    });
    const data = await res.json();
    renderResult(data);
    document.getElementById('status').textContent = 'Done: #' + selected + (data.errors.length ? ' (' + data.errors.length + ' errors)' : '');
  } catch (e) {
    document.getElementById('content').innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
};

document.getElementById('btn-json').onclick = () => {
  showJson = !showJson;
  document.getElementById('btn-json').textContent = showJson ? 'Show UI' : 'Toggle JSON';
};

function renderResult(data) {
  const el = document.getElementById('content');
  if (showJson) {
    el.innerHTML = '<pre>' + JSON.stringify(data, null, 2).replace(/</g, '&lt;') + '</pre>';
    return;
  }
  let html = '<h3 style="margin-bottom:16px">#' + data.scenario.number + ' ' + data.scenario.title + '</h3>';

  for (const msg of data.validatedMessages) {
    html += '<div class="message-card">';
    html += '<span class="msg-id">' + msg.id + '</span>';
    html += '<span class="msg-to">→ ' + msg.to.join(', ') + '</span>';
    if (msg.urgency && msg.urgency !== 'normal') {
      html += '<span class="msg-urgency ' + msg.urgency + '">' + msg.urgency + '</span>';
    }
    html += '<div class="msg-text">' + msg.text + '</div>';
    if (msg.sections) {
      for (const sec of msg.sections) {
        html += '<div class="section"><h4>' + sec.title + '</h4><ul>';
        for (const b of sec.bullets) html += '<li>' + b + '</li>';
        html += '</ul></div>';
      }
    }
    if (msg.actions) {
      html += '<div class="actions-row">';
      for (const a of msg.actions) {
        html += '<span class="action-btn ' + a.style + '">' + a.label + '</span>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  const tKeys = Object.keys(data.stateTransitions);
  if (tKeys.length) {
    html += '<div class="transitions"><h3>State Transitions</h3>';
    for (const k of tKeys) html += '<div class="transition-item">✓ ' + k + '</div>';
    html += '</div>';
  }

  if (data.timeoutResult) {
    html += '<div class="transitions"><h3>Timeout Policy</h3>';
    for (const m of data.timeoutResult.outgoingMessages) {
      html += '<div class="transition-item">[' + m.id + '] ' + m.text + '</div>';
    }
    html += '</div>';
  }

  if (data.errors.length) {
    html += '<div class="errors"><h3>Errors</h3>';
    for (const e of data.errors) html += '<div class="err">✗ ' + e + '</div>';
    html += '</div>';
  }

  el.innerHTML = html;
}

loadScenarios();
</script>
</body>
</html>`;

// ─── Start Server ───────────────────────────────────────────────

const PORT = parseInt(process.env.SIMULATOR_PORT ?? '4100', 10);

app.listen(PORT, () => {
  console.log(`Simulator dev server running at http://localhost:${PORT}/dev`);
});
