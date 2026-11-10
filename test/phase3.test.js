'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { compareDomInventories } = require('../dot-qa/dom-comparison');
const { makeMatrix, aggregate } = require('../dot-qa/result-engine');
const { makePackage } = require('../dot-qa/report-package');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

const item=(kind,tag,label,x=0,y=0,width=160,height=40)=>
  ({kind,tag,label,geometry:{x,y,width,height}});
const inv=entries=>({version:1,entries,truncated:false});
test('detects added and removed semantic DOM items without treating them as a defect',()=>{
  const a=inv([item('heading','h1','Earn rewards'),item('control','button','Apply')]);
  const b=inv([item('heading','h1','Earn cashback'),item('control','button','Apply')]);
  const diff=compareDomInventories(a,b);
  assert.equal(diff.status,'COMPARED');
  assert.equal(diff.counts.added,1);
  assert.equal(diff.counts.removed,1);
  assert(diff.changes.some(x=>x.label==='Earn cashback'&&x.type==='added'));
});
test('detects large unique-element moves',()=>{
  const before=inv([item('control','button','Apply',20,100)]);
  const after=inv([item('control','button','Apply',20,180)]);
  assert.equal(compareDomInventories(before,after).counts.repositioned,1);
});
test('does not confuse duplicate counts with movement',()=>{
  const a=inv([item('link','a','Details'),item('link','a','Details')]);
  const b=inv([item('link','a','Details')]);
  const d=compareDomInventories(a,b);
  assert.equal(d.counts.removed,1);
  assert.equal(d.counts.repositioned,0);
});
test('does not invent differences on unchanged content',()=>{
  const a=inv([item('heading','h1','Welcome')]);
  const d=compareDomInventories(a,inv([item('heading','h1','Welcome')]));
  assert.equal(d.counts.added,0);
  assert.equal(d.counts.removed,0);
  assert.equal(d.counts.repositioned,0);
});
test('missing evidence is not a comparison pass',()=>{
  assert.equal(compareDomInventories(null,inv([])).status,'NOT_TESTED');
});
test('semantic DOM comparison passing does not certify intended variation',()=>{
  const base={status:'Passed with review',page:{},checks:{
    domInventory:'Passed',responsiveLayout:'Passed'
  }};
  const variation={status:'Passed with review',page:{},checks:{
    domInventory:'Passed',domComparison:'Passed',
    responsiveLayout:'Passed',expectedDomChanges:'Not tested',
    variationIdentity:'Active variation assignment detected (expected identity not supplied)'
  }};
  const cases=makeMatrix([{browser:'chrome',viewport:'1366x768',baseline:base,variation}]);
  assert.equal(cases[1].checks.find(x=>x.id==='domComparison').status,'PASS');
  assert.equal(cases[1].checks.find(x=>x.id==='expectedDomChanges').status,'NOT_TESTED');
  assert.equal(aggregate(cases).status,'REVIEW_REQUIRED');
});

test('report groups not-tested checks and displays DOM findings separately',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dot-phase3-'));
  try {
    const rec=[{browser:'chrome',viewport:'1366x768',
      baseline:{status:'Passed with review',page:{},checks:{domInventory:'Passed'}},
      variation:{status:'Passed with review',page:{},checks:{
        domInventory:'Passed',domComparison:'Passed',responsiveLayout:'Needs review',
        variationIdentity:'Active variation assignment detected (expected identity not supplied)'
      },responsive:{findings:[{code:'INTERACTIVE_OUTSIDE_VIEWPORT',
        label:'Apply',x:1400,y:220}]}},
      domComparison:{status:'COMPARED',counts:{added:1,removed:0,repositioned:0},
        changes:[{type:'added',kind:'heading',label:'Special offer',count:1}]}
    }];
    const pkg=makePackage(tmp,rec,'unit-phase3');
    const html=fs.readFileSync(path.join(pkg.root,'index.html'),'utf8');
    assert(html.includes('Actionable findings'));
    assert(html.includes('Coverage not implemented'));
    assert(html.includes('DOM and responsive comparisons'));
    assert(html.includes('Special offer'));
    assert(html.includes('INTERACTIVE_OUTSIDE_VIEWPORT'));
    const results=JSON.parse(fs.readFileSync(path.join(pkg.root,'results.json'),'utf8'));
    assert.equal(results.domComparisons[0].comparison.counts.added,1);
    assert.equal(results.qaPassed,false);
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
});
