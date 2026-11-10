'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeMatrix, aggregate, validateContract } = require('./result-engine');

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function verifyPath(base, rel) {
  if (typeof rel !== 'string' || !/^screenshots\/[a-z0-9-]+\.png$/i.test(rel))
    return null;
  const full = path.resolve(base, rel);
  if (!full.startsWith(path.resolve(base) + path.sep)) return null;
  return fs.existsSync(full) && fs.statSync(full).isFile() ? full : null;
}
function sha256(full) {
  return crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
}
function makePackage(runRoot, records, runId, opts = {}) {
  const cases = makeMatrix(records, opts.profile || {});
  const summary = aggregate(cases);
  validateContract(cases, summary);

  const out = path.join(runRoot, 'package');
  const captures = path.join(out, 'screenshots');
  fs.mkdirSync(captures, {recursive:true,mode:0o700});
  const copied = new Map();
  const screenshotEvidence = [];

  for (const record of records) {
    for (const mode of ['baseline','variation']) {
      const snap = record[mode] || {};
      for (const [label, rel] of Object.entries(snap.screenshots || {})) {
        const source = verifyPath(runRoot, rel);
        if (!source) continue;
        const filename = path.basename(rel);
        const destination = path.join(captures, filename);
        if (!copied.has(filename)) {
          fs.copyFileSync(source,destination);
          copied.set(filename,'screenshots/'+filename);
        }
        screenshotEvidence.push({
          browser:record.browser,viewport:record.viewport,mode,
          type:label,path:copied.get(filename)
        });
      }

    }
  }
  const payload = {
    schemaVersion:'2.0',
    runId,
    createdAt:new Date().toISOString(),
    overallStatus:summary.status,
    qaPassed:summary.passed,
    counts:summary.counts,
    requiredCount:summary.requiredCount,
    requiredPassed:summary.requiredPassed,
    cases,
    findings:summary.findings,
    screenshots:screenshotEvidence,
    videoSessions:records.flatMap(r=>['baseline','variation'].map(mode=>({
      browser:r.browser,viewport:r.viewport,mode,
      jobId:r[mode]?.sauceJobId || null,
      scrollComplete:r[mode]?.videoWalkthrough?.complete === true,
      videoAssetVerified:false
    }))),
    warnings:[
      'No external publication or member-data approval is implied by this local package.',
      'Screenshots and Sauce Labs session videos may contain confidential information; review access and handling before publishing.',
      'The expected variation DOM, metrics, runtime and visual-regression checks are not implemented.',
      'PASS means all applicable required checks completed and passed, not authorization to publish.'
    ]
  };
  const sharepoint = {
    schemaVersion:'2.0',
    runId, completedAt:payload.createdAt,
    qaPassed:summary.passed, status:summary.status,
    checksPassed:summary.counts.PASS,
    checksFailed:summary.counts.FAIL,
    checksReviewRequired:summary.counts.REVIEW_REQUIRED,
    checksBlocked:summary.counts.BLOCKED,
    checksNotTested:summary.counts.NOT_TESTED,
    mandatoryPassed:summary.requiredPassed,
    mandatoryTotal:summary.requiredCount,
    browserViewportExperiences:summary.caseCount,
    criticalFindings:summary.findings.filter(f=>f.severity==='critical').length,
    reportRelativePath:'index.html',
    packageRelativePath:'package/',
    published:false,
    boxReportUrl:null,
    sharepointWriteStatus:'NOT_ATTEMPTED'
  };
  const write = (filename,value) => fs.writeFileSync(
    path.join(out,filename), JSON.stringify(value,null,2)+'\n', {mode:0o600});
  write('results.json',payload);
  write('sharepoint-result.json',sharepoint);

  const summaryTable = summary.findings.slice(0,200).map(x =>
    '<tr><td>'+esc(x.status)+'</td><td>'+esc(x.severity)+'</td><td>'+
    esc(x.title)+'</td><td>'+esc(x.browser)+' / '+esc(x.viewport)+' / '+
    esc(x.mode)+'</td><td>'+esc(x.detail)+'</td></tr>').join('');
  const matrix = cases.map(c =>
    '<details><summary>'+esc(c.browser)+' · '+esc(c.viewport)+' · '+
    esc(c.mode)+' ('+esc(c.executionStatus)+')</summary><table><thead><tr>'+
    '<th>Check</th><th>Severity</th><th>Result</th><th>Detail</th></tr></thead><tbody>'+
    c.checks.map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+esc(x.severity)+
      '</td><td>'+esc(x.status)+'</td><td>'+esc(x.detail)+'</td></tr>').join('')+
    '</tbody></table></details>').join('');
  const gallery = records.map(r => {
    const one = mode => {
      const snap = r[mode] || {};
      const id = snap.sauceJobId;
      const safeId = typeof id === 'string' && /^[a-f0-9-]{12,128}$/i.test(id) ? id : null;
      const jobUrl = safeId ? 'https://app.saucelabs.com/tests/'+safeId : null;
      const status = snap.videoWalkthrough?.complete ? 'Scroll completed' :
        'Scroll incomplete / not verified';
      return '<div class="gallery-column"><h4>'+esc(mode)+'</h4>'+
        '<p>'+esc(status)+'</p>'+
        (jobUrl ? '<p><a href="'+esc(jobUrl)+'" target="_blank" rel="noopener noreferrer">Watch or download recording in Sauce Labs</a></p>'
          : '<p>Session link unavailable</p>')+
        '<p class="muted">Recording availability not verified; Sauce Labs access required. Assets expire under the Sauce Labs retention policy.</p>'+
        (snap.screenshots?.top ?
          '<p><a href="'+esc(snap.screenshots.top)+'">Top screenshot</a></p>' : '')+
        '</div>';
    };
    return '<details><summary>'+esc(r.browser)+' · '+esc(r.viewport)+
      ' — recorded walkthrough</summary><div class="compare-grid">'+
      one('baseline')+one('variation')+'</div></details>';
  }).join('');
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>DOT QA · '+esc(runId)+'</title><style>'+
    'body{font:15px system-ui,sans-serif;max-width:1200px;margin:24px auto;padding:0 20px;color:#252a30}'+
    'table{border-collapse:collapse;width:100%;margin-bottom:20px}th,td{padding:9px;text-align:left;border-bottom:1px solid #ddd;vertical-align:top}'+
    'th{background:#f2f4f6}td{overflow-wrap:anywhere}details{margin:10px 0;padding:10px;border:1px solid #ddd;border-radius:6px}'+
    'summary{cursor:pointer;font-weight:600}h1,h2{line-height:1.3}.muted{color:#555}a{color:#18538a}'+
    '.compare-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}'+
    '.gallery-column{min-width:0}.gallery-column img{width:100%;display:block}'+
    '.gallery-column figure{margin:0 0 10px;border:1px solid #ccc}'+
    '.gallery-column figcaption{padding:4px 8px;font-size:12px;background:#f2f4f6}'+
    '@media(max-width:720px){.compare-grid{grid-template-columns:1fr}}</style></head><body>'+
    '<h1>DOT Automated Experiment QA</h1><p><strong>Overall status: '+
    esc(summary.status)+'</strong> · QA passed: '+(summary.passed?'Yes':'No')+'</p>'+
    '<p class="muted">Execution '+esc(runId)+' · '+esc(payload.createdAt)+
    ' · '+summary.requiredPassed+' / '+summary.requiredCount+' mandatory checks passed</p>'+
    '<p><strong>Decision rule:</strong> FAIL overrides BLOCKED; BLOCKED overrides REVIEW REQUIRED; only a fully complete mandatory suite can PASS. NOT TESTED is never a pass.</p>'+
    '<h2>Video walkthroughs</h2>'+gallery+
    '<h2>Mandatory findings ('+summary.findings.length+')</h2>'+
    '<table><thead><tr><th>Status</th><th>Severity</th><th>Check</th><th>Browser/viewport/mode</th><th>Evidence</th></tr></thead><tbody>'+
    (summaryTable || '<tr><td colspan="5">No unresolved mandatory findings</td></tr>')+
    '</tbody></table>'+
    (summary.findings.length>200?'<p>Additional findings appear in results.json.</p>':'')+
    '<h2>Browser and viewport matrix</h2>'+matrix+
    '<p class="muted">Sauce Labs videos are not included in this package. Remote links require appropriate account access and are subject to asset retention. No Box or SharePoint upload was performed. The legacy report.html remains available.</p>'+
    '</body></html>';
  fs.writeFileSync(path.join(out,'index.html'),html,{mode:0o600});

  const names = ['index.html','results.json','sharepoint-result.json',
    ...[...copied.values()].sort()];
  const manifest = {
    schemaVersion:'2.0',runId,
    entrypoint:'index.html',
    sharepointPayload:'sharepoint-result.json',
    publicationStatus:'NOT_PUBLISHED',
    files:names.map(name=>({
      path:name,bytes:fs.statSync(path.join(out,name)).size,
      sha256:sha256(path.join(out,name))
    }))
  };
  write('manifest.json',manifest);
  return {root:out,summary,sharepoint,manifest};
}
module.exports = { makePackage };
