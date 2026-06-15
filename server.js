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

const server = http.createServer((req, res) => {
  const parts = req.url.split('/').filter(Boolean);
  res.setHeader('Content-Type', 'application/json');

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
    const today = getToday();
    const data = loadData();
    const todayData = data[today] || {};
    const report = {};
    for (const [app, d] of Object.entries(todayData)) {
      let total = d.total;
      if (d.openAt) total += Date.now() - d.openAt;
      report[app] = Math.round(total / 60000);
    }
    res.end(JSON.stringify({ date: today, minutes: report }));
    return;
  }

  res.end(JSON.stringify({ ok: true }));
});

server.listen(process.env.PORT || 3000, () => console.log('running'));
