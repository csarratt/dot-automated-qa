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
  if (!before.page || !after.page) {
    return { status: 'Not tested', added: [], removed: [], queryOnly: 0 };
  }
  const a = [...(before.page.links || [])];
  const b = [...(after.page.links || [])];
  const key = item => JSON.stringify([item.label, item.destination, item.issue]);
  const noQuery = item => JSON.stringify([
    item.label, (item.destination || '').replace(/\?\[query redacted\]$/, ''), item.issue
  ]);
  // First match exact entries, respecting duplicate counts.
  const remainingA = [...a], remainingB = [];
  for (const item of b) {
    const i = remainingA.findIndex(x => key(x) === key(item));
    if (i >= 0) remainingA.splice(i, 1);
    else remainingB.push(item);
  }
  // Then separate differences caused solely by whether a query string exists.
  const added = [], queryOnly = [];
  for (const item of remainingB) {
    const i = remainingA.findIndex(x => noQuery(x) === noQuery(item));
    if (i >= 0) queryOnly.push({
      label: item.label, destination: noQuery(item)
    }), remainingA.splice(i, 1);
    else added.push(item);
  }
  const removed = remainingA;
  return {
    status: added.length || removed.length || queryOnly.length
      ? 'Needs review' : 'No differences detected',
    addedCount: added.length,
    removedCount: removed.length,
    queryOnlyCount: queryOnly.length,
    added: added.slice(0, 50), removed: removed.slice(0, 50),
    queryOnly: queryOnly.slice(0, 50)
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
  const checks = s => {
    const data = Object.entries(s.checks || {})
      .map(([k,v]) => `<tr><td>${escape(k)}</td><td>${escape(v)}</td></tr>`).join('');
    const notes = (s.notes || []).map(escape).join('<br>');
    const opt = s.optimizely || {};
    const ids = [
      ...(opt.activeExperiments || []).map(x =>
        'Experiment ' + x.experimentId + ' / variation ' + (x.variationId || 'unknown') +
        (x.holdback ? ' (holdback)' : '')),
      ...(opt.activeCampaigns || []).map(x =>
        'Campaign ' + x.campaignId + ' / experiment ' + (x.experimentId || 'unknown') +
        ' / variation ' + (x.variationId || 'unknown') +
        (x.holdback ? ' (holdback)' : ''))
    ].slice(0, 30).map(escape).join('<br>');
    return `<details class="details"><summary>Individual checks</summary><table class="mini"><tbody>${data}</tbody></table>` +
      `<div class="small"><strong>Active Optimizely IDs (diagnostic only):</strong><br>${ids || 'None reported'}</div><p>${notes}</p></details>`;
  };
  const rows = records.map(r => {
    const screenshot = s => {
      const links = [];
      if (s.screenshots?.top) links.push(`<a href="${escape(s.screenshots.top)}">Original</a>`);
      if (s.screenshots?.prepared) links.push(`<a href="${escape(s.screenshots.prepared)}">Mask attempt</a>`);
      if (s.screenshots?.bottom) links.push(`<a href="${escape(s.screenshots.bottom)}">Bottom</a>`);
      return links.join(' · ') || 'Unavailable';
    };
    const example = [
      ...(r.links.added || []).map(i => 'Added: ' + i.label + ' -> ' + i.destination),
      ...(r.links.removed || []).map(i => 'Removed: ' + i.label + ' -> ' + i.destination),
      ...(r.links.queryOnly || []).map(i => 'Query presence differs: ' + i.label)
    ].slice(0, 12).map(escape).join('<br>') || 'None';
    const linkDescription = `${r.links.addedCount || 0} added, ${r.links.removedCount || 0} removed, ${r.links.queryOnlyCount || 0} query-only`;
    const status = s => `${escape(s.status)}${checks(s)}`;
    const details = `<details class="details"><summary>Review differences</summary><div class="findings">${example}</div></details>`;
    return `<tr><td><strong>${escape(r.browser)}</strong></td><td>${escape(r.viewport)}</td>` +
      `<td>${status(r.baseline)}</td><td>${status(r.variation)}</td>` +
      `<td>${escape(r.links.status)}<div class="small">${escape(linkDescription)}</div>${details}</td>` +
      `<td><div class="small">Baseline: ${screenshot(r.baseline)}</div><div class="small">Variation: ${screenshot(r.variation)}</div></td></tr>`;
  }).join('\n');

  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>DOT Experiment QA</title><style>body{font:15px system-ui,sans-serif;max-width:1400px;margin:30px auto;padding:0 18px;color:#20252a}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:12px;text-align:left;vertical-align:top}th{background:#f4f5f6}details{overflow-wrap:anywhere}details.details{margin-top:7px}details.details summary{cursor:pointer;color:#315c8a;font-size:13px}details.details .findings{padding:8px 0;font-size:13px;line-height:1.5}p{line-height:1.5}.mini{font-size:12px}.mini td{padding:4px 8px}.small{font-size:12px;line-height:1.5;margin-top:4px}td{max-width:260px;overflow-wrap:anywhere}</style></head><body>` +
    `<h1>DOT Experiment QA</h1><p>Run ID: ${escape(runId)}</p>` +
    `<p><strong>Review required:</strong> Original screenshots are unmodified evidence. Mask attempts may still show cookie/QA overlays; they are NOT confirmed clean. Do not treat these as validation evidence. Link differences are findings, not automatic defect determinations. Variation identity, Optimizely metrics, JS/network errors, CTA interactions, visual regression, Runway authentication and mobile devices are NOT TESTED by this build.</p>` +
    `<table><thead><tr><th>Browser</th><th>CSS viewport</th><th>Baseline</th><th>Variation</th><th>Link changes</th><th>Screenshots</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<p>Baseline uses optimizely_disable=true and independent remote sessions. Sanitized link comparisons omit query values and may miss changes. Query-presence changes are separated to reduce false positives. No automatic pixel-level visual regression is performed. Keep all reports local and restricted.</p></body></html>`;
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
      '--no-install','wdio','run','./dot-qa/wdio-environment.conf.mjs',
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
