'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { requirePublicUsaaUrl } = require('./url');

const project = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const argument = name => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const browsers = ['chrome','microsoftedge','firefox','safari'];

function snapshot(root, name, mode, viewport) {
  const file = path.join(root, 'snapshots', `${name}-${mode}-${viewport}.json`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return { status: 'Not executed', checks: {}, page: null, screenshots: {}, notes: ['No result file'] }; }
}
function difference(before, after) {
  if (!before.page || !after.page) return { status: 'Not tested', added: [], removed: [] };
  const count = links => {
    const result = new Map();
    for (const item of links || []) {
      const key = JSON.stringify([item.label, item.destination, item.issue]);
      result.set(key, (result.get(key) || 0) + 1);
    }
    return result;
  };
  const a = count(before.page.links), b = count(after.page.links);
  const added = [], removed = [];
  for (const [key, n] of b) for (let i = 0; i < n - (a.get(key) || 0); i++) added.push(JSON.parse(key));
  for (const [key, n] of a) for (let i = 0; i < n - (b.get(key) || 0); i++) removed.push(JSON.parse(key));
  return {
    status: added.length || removed.length ? 'Needs review' : 'No differences detected',
    addedCount: added.length, removedCount: removed.length,
    added: added.slice(0, 50), removed: removed.slice(0, 50)
  };
}
function report(root, viewports, runId) {
  const records = [];
  for (const viewport of viewports) for (const name of browsers) {
    const baseline = snapshot(root, name, 'baseline', viewport);
    const variation = snapshot(root, name, 'variation', viewport);
    const links = difference(baseline, variation);
    records.push({ browser: name, viewport, baseline, variation, links });
  }
  fs.writeFileSync(path.join(root,'report.json'),
    JSON.stringify({ runId, records }, null, 2), { mode: 0o600 });
  const rows = records.map(r => {
    const screenshot = s => s.screenshots?.top ?
      `<a href="${escape(s.screenshots.top)}">Top</a>` : 'Unavailable';
    const example = [...r.links.added.map(i => 'Added: ' + i.label + ' -> ' + i.destination),
      ...r.links.removed.map(i => 'Removed: ' + i.label + ' -> ' + i.destination)]
      .slice(0, 8).map(escape).join('<br>') || 'None';
    return `<tr><td>${escape(r.browser)}</td><td>${escape(r.viewport)}</td>` +
      `<td>${escape(r.baseline.status)}</td><td>${escape(r.variation.status)}</td>` +
      `<td>${escape(r.links.status)} (${r.links.addedCount || 0} added, ${r.links.removedCount || 0} removed)` +
      `<details><summary>Examples</summary>${example}</details></td>` +
      `<td>Baseline: ${screenshot(r.baseline)}<br>Variation: ${screenshot(r.variation)}</td></tr>`;
  }).join('\n');
  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>DOT Experiment QA</title><style>body{font:15px system-ui,sans-serif;max-width:1400px;margin:30px auto;padding:0 18px;color:#20252a}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:12px;text-align:left;vertical-align:top}th{background:#f4f5f6}details{max-width:400px;overflow-wrap:anywhere}p{line-height:1.5}</style></head><body>` +
    `<h1>DOT Experiment QA</h1><p>Run ID: ${escape(runId)}</p>` +
    `<p><strong>Review required:</strong> Screenshots and link changes are evidence, not automatic defect determinations. Variation identity, Optimizely metrics, JS/network errors, CTA interactions, visual regression, Runway authentication and mobile devices are NOT TESTED by this build.</p>` +
    `<table><thead><tr><th>Browser</th><th>CSS viewport</th><th>Baseline</th><th>Variation</th><th>Link changes</th><th>Screenshots</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<p>Baseline uses optimizely_disable=true and independent remote sessions. Sanitized link comparisons omit query values and may miss changes. Keep all reports local and restricted.</p></body></html>`;
  fs.writeFileSync(path.join(root,'report.html'), html, { mode: 0o600 });
  return records;
}

function main() {
  if (!argument('--url')) {
    console.log("Usage: node dot-qa/run.js --url 'YOUR_PREVIEW_URL' --viewports 1366x768,1024x768");
    process.exitCode = 1;
    return;
  }
  const preview = requirePublicUsaaUrl(argument('--url')).toString();
  const viewports = (argument('--viewports') || '1366x768')
    .split(',').map(s => s.trim());
  if (viewports.length < 1 || viewports.length > 8 ||
      viewports.some(s => !/^\d{3,4}x\d{3,4}$/.test(s))) throw new Error('Invalid viewport list');
  for (const viewport of viewports) {
    const [w,h] = viewport.split('x').map(Number);
    if (w < 320 || w > 1900 || h < 480 || h > 1080) throw new Error('Unsupported viewport size');
  }
  if (!process.env.SAUCE_USERNAME || !process.env.SAUCE_ACCESS_KEY)
    throw new Error('Sauce Labs credentials are not available in this terminal');
  const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
  const root = path.join(project,'qa-results','runs',runId);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  let failed = false;
  for (const viewport of viewports) for (const mode of ['baseline','variation']) {
    const [w,h] = viewport.split('x');
    console.log(`Running ${mode} at ${viewport} in all configured browsers`);
    const result = spawnSync('npx', [
      '--no-install','wdio','run','./wdio.conf.js',
      '--spec','./test/specs/dot-experiment.test.js'
    ], {
      cwd: project,
      env: { ...process.env, DOT_QA_URL: preview, DOT_QA_MODE: mode,
        DOT_QA_WIDTH: w, DOT_QA_HEIGHT: h, DOT_QA_OUTPUT: root },
      stdio: 'inherit', timeout: 420000
    });
    if (result.error || result.status !== 0) {
      failed = true;
      console.error(`Run failed or incomplete: ${mode} ${viewport}`);
    }
  }
  const records = report(root, viewports, runId);
  console.log('Local report: ' + path.join(root,'report.html'));
  console.log('Browser/viewport comparisons: ' + records.length);
  if (failed || records.some(r =>
    ['Failed','Not executed'].includes(r.baseline.status) ||
    ['Failed','Not executed'].includes(r.variation.status))) process.exitCode = 1;
}

try { main(); } catch(e) { console.error(e.message); process.exitCode = 1; }
