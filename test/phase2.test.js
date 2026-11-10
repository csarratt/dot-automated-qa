'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registry } = require('../dot-qa/check-registry');
const { makeMatrix, aggregate, normalizeCheck, validateContract } = require('../dot-qa/result-engine');
const { makePackage } = require('../dot-qa/report-package');

const snapshot = (mode, checks, status='Passed with review') => ({
  status, page:{viewport:{width:1366,height:768},links:[]}, checks,
  screenshots:{}
});
const pair = (base,variation) => [{
  browser:'chrome',viewport:'1366x768',baseline:base,variation
}];
const checks = {
  renderReady:'Passed', viewport:'Passed', page:'Passed',
  images:'Passed', overflow:'Passed', scrolling:'Passed',
  cookieConsent:'Accept Cookies selected',links:'Passed'
};

test('registry IDs remain unique', () => {
  assert.equal(new Set(registry.map(x=>x.id)).size,registry.length);
});
test('unfinished mandatory checks prevent a misleading PASS', () => {
  const cases = makeMatrix(pair(snapshot('baseline',checks),snapshot('variation',{
    ...checks,variationIdentity:'Active variation assignment detected (expected identity not supplied)'
  })));
  const result = aggregate(cases);
  assert.equal(result.status,'REVIEW_REQUIRED');
  assert.equal(result.passed,false);
  assert(result.counts.NOT_TESTED>0);
  validateContract(cases,result);
});
test('expected variation mismatch is FAIL', () => {
  const cases = makeMatrix(pair(snapshot('baseline',checks),snapshot('variation',{
    ...checks,variationIdentity:'Mismatch (expected variation not active or in holdback)'
  })));
  assert.equal(aggregate(cases).status,'FAIL');
});
test('missing remote browser result blocks completion', () => {
  const cases = makeMatrix(pair(snapshot('baseline',checks),{
    status:'Not executed',checks:{},page:null
  }));
  assert.equal(aggregate(cases).status,'BLOCKED');
});
test('remote session termination is BLOCKED, not a website defect FAIL', () => {
  const interrupted = snapshot('baseline',checks,'Blocked');
  interrupted.executionErrorKind='REMOTE_SESSION_UNAVAILABLE';
  interrupted.checks.fullPageCoverage='Blocked';
  const cases = makeMatrix(pair(interrupted,snapshot('variation',checks)));
  const result=aggregate(cases);
  assert.equal(cases[0].executionStatus,'BLOCKED');
  assert.equal(cases[0].checks.find(x=>x.id==='fullPageCoverage').status,'BLOCKED');
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.passed,false);
  assert(result.findings.some(x=>x.id==='executionBlocked'));
});
test('failed browser execution overrides missing check details', () => {
  const cases = makeMatrix(pair(snapshot('baseline',checks),
    snapshot('variation',{},'Failed')));
  assert.equal(aggregate(cases).status,'FAIL');
});
test('review and exception mappings are explicit', () => {
  assert.equal(normalizeCheck('cookieConsent','Not shown (review if banner remains)','baseline'),'REVIEW_REQUIRED');
  assert.equal(normalizeCheck('variationIdentity','Expected experiment and variation active (DOM not verified)','variation'),'PASS');
  assert.equal(normalizeCheck('variationIdentity','Active variation assignment detected (expected identity not supplied)','variation'),'REVIEW_REQUIRED');
  assert.equal(normalizeCheck('scrolling','Not applicable','baseline'),'PASS');
});
test('profile-specific checks require explicit scope', () => {
  const ordinary = makeMatrix(pair(snapshot('baseline',checks),snapshot('variation',checks)));
  const spa = makeMatrix(pair(snapshot('baseline',checks),snapshot('variation',checks)),{spa:true});
  assert.equal(ordinary[1].checks.find(x=>x.id==='spaLifecycle').status,'NOT_APPLICABLE');
  assert.equal(spa[1].checks.find(x=>x.id==='spaLifecycle').status,'NOT_TESTED');
});
test('report package is self-contained and SharePoint has correct fail-closed status', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'dot-qa-phase2-'));
  try {
    const root = path.join(temp,'run');
    fs.mkdirSync(path.join(root,'screenshots'),{recursive:true});
    fs.writeFileSync(path.join(root,'screenshots','chrome-variation-1366x768-top.png'),'fake-image');
    const records = pair(snapshot('baseline',checks),snapshot('variation',{
      ...checks,variationIdentity:'Active variation assignment detected (expected identity not supplied)'
    }));
    records[0].baseline.checks.fullPageCoverage='Passed';
    records[0].variation.screenshots.top='screenshots/chrome-variation-1366x768-top.png';
    records[0].variation.sauceJobId='abcdef1234567890';
    records[0].variation.videoWalkthrough = {complete:true,steps:9};
    records[0].variation.checks.fullPageCoverage='Passed';
    const output = makePackage(root,records,'test-run-123');
    assert.equal(output.summary.status,'REVIEW_REQUIRED',
      'Unexpected status: '+JSON.stringify({
        executions: makeMatrix(records).map(x=>({browser:x.browser,mode:x.mode,status:x.executionStatus})),
        blocked:output.summary.findings.filter(x=>x.status==='BLOCKED')
      }));
    const sharepoint = JSON.parse(fs.readFileSync(path.join(output.root,'sharepoint-result.json'),'utf8'));
    assert.equal(sharepoint.qaPassed,false);
    assert.equal(sharepoint.published,false);
    assert.equal(sharepoint.boxReportUrl,null);
    const manifest = JSON.parse(fs.readFileSync(path.join(output.root,'manifest.json'),'utf8'));
    assert(manifest.files.some(x=>x.path==='screenshots/chrome-variation-1366x768-top.png'));
    const html = fs.readFileSync(path.join(output.root,'index.html'),'utf8');
    assert(html.includes('REVIEW_REQUIRED'));
    assert(html.includes('Video walkthroughs'));
    assert(html.includes('https://app.saucelabs.com/tests/abcdef1234567890'));
    assert(html.includes('Scroll completed'));
    assert.equal(output.summary.status,'REVIEW_REQUIRED');
    assert(!fs.readFileSync(path.join(output.root,'results.json'),'utf8').includes('YOUR_PREVIEW_URL'));
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }
});
