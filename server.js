const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return {}; }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
}

function getToday() {
  const now = new Date();
  now.setHours(now.getHours() + 8);
  return now.toISOString().slice(0, 10);
}

function getReport() {
  const today = getToday();
  const data = loadData();
  const todayData = data[today] || {};
  const report = {};
  for (const [app, d] of Object.entries(todayData)) {
    let total = d.total;
    if (d.openAt) total += Date.now() - d.openAt;
    report[app] = Math.round(total / 60000);
  }
  return { date: today, minutes: report };
}

function handleMCP(body, res) {
  let req;
  try { req = JSON.parse(body); } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'invalid json' }));
    return;
  }

  const { id, method, params } = req;

  if (method === 'initialize') {
    res.end(JSON.stringify({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'screentime-tracker', version: '1.0.0' },
        capabilities: { tools: {} }
      }
    }));
    return;
  }

  if (method === 'notifications/initialized') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (method === 'tools/list') {
    res.end(JSON.stringify({
      jsonrpc: '2.0', id,
      result: {
        tools: [{
          name: 'get_screentime',
          description: '获取今日各App使用时长（分钟）',
          inputSchema: { type: 'object', properties: {}, required: [] }
        }]
      }
    }));
    return;
  }

  if (method === 'tools/call') {
    const report = getReport();
    const lines = Object.entries(report.minutes)
      .map(([app, min]) => `${app}: ${min}分钟`)
      .join('\n') || '暂无数据';
    res.end(JSON.stringify({
      jsonrpc: '2.0', id,
      result: {
        content: [{
          type: 'text',
          text: `📱 ${report.date} 使用记录：\n${lines}`
        }]
      }
    }));
    return;
  }

  res.end(JSON.stringify({
    jsonrpc: '2.0', id,
    error: { code: -32601, message: 'method not found' }
  }));
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parts = req.url.split('/').filter(Boolean);

  if (req.method === 'POST' && parts[0] === 'mcp') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => handleMCP(body, res));
    return;
  }

  if (parts[0] === 'toggle' && parts[1]) {
    const app = decodeURIComponent(parts[1]);
    const now = Date.now();
    const today = getToday();
    const data = loadData();
    if (!data[today]) data[today] = {};
    if (!data[today][app]) data[today][app] = { total: 0, openAt: null };
    const d = data[today][app];
    if (d.openAt) { d.total += now - d.openAt; d.openAt = null; }
    else { d.openAt = now; }
    saveData(data);
    res.end(JSON.stringify({ app, status: d.openAt ? 'open' : 'closed' }));
    return;
  }

  if (parts[0] === 'report') {
    res.end(JSON.stringify(getReport()));
    return;
  }

  res.end(JSON.stringify({ ok: true }));
});

server.listen(process.env.PORT || 3000, () => console.log('running'));
