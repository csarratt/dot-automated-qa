'use strict';
const path = require('node:path');

// Cross-browser capture by overlapping viewport slices. Unlike a top/bottom
// pair, this walks the document and records whether every section was visited.
// No page resizing, image compositing, or manipulation of customer content.
async function capturePageSections(browser, options) {
  const { directory, prefix, maxSections = 40 } = options;
  const frames = [];
  const seen = new Set();
  let fullCoverage = false;
  let reason = null;

  // Pre-scroll to trigger lazy-loaded images and dynamic page sections.
  await browser.execute(() => window.scrollTo(0, 0));
  await browser.pause(200);
  const initial = await browser.execute(() => ({
    height: Math.max(document.body.scrollHeight,document.documentElement.scrollHeight),
    viewport:innerHeight
  }));
  const step = Math.max(200, Math.floor(initial.viewport * .85));
  if (initial.viewport < 300) throw new Error('Viewport too small for section capture');
  for (let i=0;i<maxSections;i++) {
    const metrics = await browser.execute(y => {
      const root = document.documentElement;
      const size = Math.max(document.body.scrollHeight,root.scrollHeight);
      const max = Math.max(0,size-innerHeight);
      const destination = Math.min(y,max);
      window.scrollTo(0,destination);
      return {height:size,max,requestedY:destination};
    },i*step);
    await browser.pause(200);
    const actual = await browser.execute(() => ({
      y:Math.round(window.scrollY),
      height:Math.max(document.body.scrollHeight,document.documentElement.scrollHeight),
      viewport:innerHeight,
      pendingImages:[...document.images].filter(img=>{
        const r=img.getBoundingClientRect();
        return r.bottom>=0 && r.top<=innerHeight && !img.complete;
      }).length
    }));
    // Allow visible lazy-loaded images a short settling period.
    if(actual.pendingImages) await browser.pause(500);
    if (seen.has(actual.y)) {
      fullCoverage = actual.y + actual.viewport >= actual.height - 3;
      if (!fullCoverage) reason='Repeated scroll position before document end';
      break;
    }
    seen.add(actual.y);
    const filename = prefix+'-section-'+String(i+1).padStart(3,'0')+'.png';
    await browser.saveScreenshot(path.join(directory,filename));
    frames.push({ index:i+1, y:actual.y,
      path:'screenshots/'+filename,viewportHeight:actual.viewport });
    if (actual.y+actual.viewport>=actual.height-3) {
      fullCoverage=true;
      break;
    }
    if (i===maxSections-1) reason='Maximum screenshot sections reached';
  }
  await browser.execute(()=>window.scrollTo(0,0));
  return {
    method:'overlapping-viewport-sections',
    complete:fullCoverage,
    sectionCount:frames.length,
    reason:fullCoverage?null:reason||'Unable to confirm full-page coverage',
    frames
  };
}
module.exports={capturePageSections};
