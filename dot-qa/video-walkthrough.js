'use strict';

// Creates a deliberate, reviewable top-to-bottom walk-through within
// the existing Sauce Labs session. Sauce Labs records the session video.
// No images are generated; the recording remains a remote job asset.
async function recordPageWalkthrough(browser, options = {}) {
  const maxSteps = options.maxSteps || 65;
  const intervalMs = options.intervalMs || 400;
  const pauseMs = options.pauseMs || 300;
  const start = await browser.execute(() => {
    window.scrollTo({top:0,left:0,behavior:'instant'});
    return {
      height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight),
      viewport:window.innerHeight
    };
  });
  if(start.viewport < 300) throw new Error('Viewport too small for page walk-through');
  await browser.pause(800); // Opening view, visible in recording.
  let current = 0;
  let steps = 0;
  let completed = false;
  let reason = null;
  const stepSize = Math.max(120,Math.floor(start.viewport * .8));
  for(;steps < maxSteps;steps++) {
    const state = await browser.execute(y => {
      const doc = document.documentElement;
      const bottom = Math.max(document.body.scrollHeight,doc.scrollHeight);
      const max = Math.max(0,bottom-window.innerHeight);
      window.scrollTo({top:Math.min(max,y),left:0,behavior:'instant'});
      return {max,bottom,viewport:window.innerHeight};
    },current);
    await browser.pause(intervalMs);
    const actual = await browser.execute(() => ({
      y:Math.round(window.scrollY),
      height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight),
      viewport:window.innerHeight,
      loadingImages:[...document.images].filter(img=>{
        const rect=img.getBoundingClientRect();
        return rect.bottom>=0 && rect.top<=innerHeight && !img.complete;
      }).length
    }));
    if(actual.loadingImages) await browser.pause(pauseMs);
    const bottomReached = actual.y + actual.viewport >= actual.height - 3;
    if(bottomReached) {
      completed=true;
      // Avoid issuing an additional remote command after completing the walk-through.
      break;
    }
    // Scroll according to actual position in case the page expanded.
    const next = actual.y + stepSize;
    if(next <= actual.y || (steps > 0 && actual.y <= current-stepSize &&
       actual.height <= state.bottom && actual.y < state.max)) {
      reason='Scrolling did not advance';
      break;
    }
    current=next;
  }
  if(!completed && !reason) reason='Maximum scroll steps reached';
  return {method:'sauce-video-scroll',complete:completed,
    steps:steps+1,reason,recordingAvailable:'NOT_VERIFIED'};
}
module.exports={recordPageWalkthrough};
