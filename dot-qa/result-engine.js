'use strict';
const { registry, applies } = require('./check-registry');

const STATUSES = Object.freeze(['PASS','FAIL','REVIEW_REQUIRED','BLOCKED','NOT_TESTED','NOT_APPLICABLE']);
const known = new Set(STATUSES);

function normalizeCheck(id, value, mode) {
  const text = String(value ?? '').trim();
  if (id === 'variationIdentity') {
    if (mode === 'baseline') return 'NOT_APPLICABLE';
    if (/^Expected experiment and variation active/i.test(text)) return 'PASS';
    if (/^Mismatch/i.test(text)) return 'FAIL';
    if (/^Not applicable/i.test(text)) return 'NOT_APPLICABLE';
    return 'REVIEW_REQUIRED'; // Active but expected identity unspecified is NOT a pass.
  }
  if (id === 'cookieConsent') {
    if (/^Accept Cookies selected$/.test(text)) return 'PASS';
    return text ? 'REVIEW_REQUIRED' : 'NOT_TESTED';
  }
  if (id === 'scrolling' && text === 'Not applicable') return 'PASS';
  if (id === 'links' && text === 'Needs review') return 'REVIEW_REQUIRED';
  if (text === 'Passed' || text === 'PASS') return 'PASS';
  if (text === 'Failed' || text === 'FAIL') return 'FAIL';
  if (text === 'Needs review' || text === 'REVIEW_REQUIRED') return 'REVIEW_REQUIRED';
  if (text === 'Blocked' || text === 'BLOCKED') return 'BLOCKED';
  return 'NOT_TESTED';
}

function makeMatrix(records, profile = {}) {
  const cases = [];
  for (const record of records) {
    for (const mode of ['baseline','variation']) {
      const snap = record[mode] || {};
      const missing = snap.status === 'Not executed' || !snap.page;
      const checks = registry.map(item => {
        const applicable = applies(item, mode, profile);
        const value = (snap.checks || {})[item.id];
        const status = !applicable ? 'NOT_APPLICABLE'
          : missing ? 'BLOCKED'
          : normalizeCheck(item.id, value, mode);
        return {
          id:item.id,title:item.title,category:item.category,severity:item.severity,
          required:item.required,implementation:item.implementation,
          status, detail: typeof value === 'string' ? value.slice(0,220) : ''
        };
      });
      cases.push({
        browser:record.browser,viewport:record.viewport,mode,
        executionStatus:missing ? 'BLOCKED' : snap.status === 'Failed' ? 'FAIL' : 'COMPLETED',
        checks
      });
    }
  }
  return cases;
}

function aggregate(cases) {
  const relevant = cases.flatMap(c => c.checks.filter(x =>
    x.required && x.status !== 'NOT_APPLICABLE'));
  const all = cases.flatMap(c => c.checks);
  const counts = Object.fromEntries(STATUSES.map(s =>
    [s, all.filter(x=>x.status===s).length]));
  const failed = relevant.some(x=>x.status==='FAIL');
  const blocked = cases.some(c=>c.executionStatus==='BLOCKED') ||
    relevant.some(x=>x.status==='BLOCKED');
  const incomplete = relevant.some(x =>
    ['NOT_TESTED','REVIEW_REQUIRED'].includes(x.status));
  const status = failed ? 'FAIL' : blocked ? 'BLOCKED' :
    incomplete || !relevant.length ? 'REVIEW_REQUIRED' : 'PASS';
  const findings = [];
  for (const c of cases) for (const check of c.checks) {
    if (check.required && ['FAIL','BLOCKED','REVIEW_REQUIRED','NOT_TESTED'].includes(check.status)) {
      findings.push({
        browser:c.browser,viewport:c.viewport,mode:c.mode,
        id:check.id,title:check.title,severity:check.severity,
        status:check.status,detail:check.detail
      });
    }
  }
  return { status, passed:status==='PASS', counts,
    requiredCount:relevant.length,
    requiredPassed:relevant.filter(x=>x.status==='PASS').length,
    findings, caseCount:cases.length };
}

function validateContract(cases, result) {
  if (!cases.every(c => c.checks.every(x => known.has(x.status))))
    throw new Error('Unknown QA check result status');
  if (result.passed !== (result.status === 'PASS'))
    throw new Error('QA pass flag contradicts overall status');
  return true;
}

module.exports = { STATUSES, normalizeCheck, makeMatrix, aggregate, validateContract };
