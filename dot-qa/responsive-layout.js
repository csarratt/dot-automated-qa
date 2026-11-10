'use strict';

// Conservative geometry checks: they identify suspected layout defects for
// review, not proof of failure. Off-screen carousel slides are not automatic defects.
async function inspectResponsiveLayout(browser) {
  return browser.execute(() => {
    const max = 40;
    const findings = [];
    let examined=0;
    const add=(code,element,rect,detail)=>{
      if(findings.length>=max)return;
      findings.push({code,element:element.tagName.toLowerCase(),
        label:String(element.getAttribute('aria-label')||element.innerText||'')
          .replace(/\s+/g,' ').trim().slice(0,70),
        x:Math.round(rect.x+scrollX),y:Math.round(rect.y+scrollY),
        width:Math.round(rect.width),height:Math.round(rect.height),detail});
    };
    const width=innerWidth;
    const root=document.querySelector('main,[role="main"]')||document.body;
    const elements=[...root.querySelectorAll('button,a[href],input,select,textarea,[role="button"]')];
    const visible = el => {
      const style=getComputedStyle(el), rect=el.getBoundingClientRect();
      return rect.width>1 && rect.height>1 && style.display!=='none' &&
        style.visibility!=='hidden' && +style.opacity>0;
    };
    const candidates=elements.filter(visible).slice(0,400);
    for (const el of candidates) {
      const rect=el.getBoundingClientRect();
      examined++;
      const fixed=['fixed','sticky'].includes(getComputedStyle(el).position);
      const inCarousel=!!el.closest('[aria-roledescription="carousel"],[class*="carousel"],[class*="slider"],[class*="swiper"]');
      if(!inCarousel && rect.width>8 && rect.height>8 &&
          (rect.left < -12 || rect.right > width+12) &&
          rect.top < innerHeight*5 && rect.bottom > -innerHeight) {
        add('INTERACTIVE_OUTSIDE_VIEWPORT',el,rect,
          'Interactive element extends beyond CSS viewport width');
      }
      if(fixed && rect.height>innerHeight*.95 && rect.top<=0 && rect.bottom>=innerHeight)
        add('LARGE_FIXED_ELEMENT',el,rect,'Large fixed overlay may obstruct content');
    }
    return {
      version:1,viewport:{width:innerWidth,height:innerHeight},
      examined,truncated:elements.filter(visible).length>400,
      findings,classification:findings.length?'REVIEW_REQUIRED':'PASS',
      limitations:['Offscreen slides and conditional UI are not treated as confirmed failures',
        'Overlap/clipping inside arbitrary containers and below-the-fold interactions are not exhaustively checked',
        'This is a static DOM geometry scan, not a real touch-device test']
    };
  });
}
module.exports={inspectResponsiveLayout};
