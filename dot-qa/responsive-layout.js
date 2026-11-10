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
    const root=document.body;
    const elements=[...root.querySelectorAll('button,a[href],input,select,textarea,[role="button"]')];
    const visible = el => {
      const style=getComputedStyle(el), rect=el.getBoundingClientRect();
      return rect.width>1 && rect.height>1 && style.display!=='none' &&
        style.visibility!=='hidden' && +style.opacity>0;
    };
    const allVisible=elements.filter(visible);
    const candidates=allVisible.slice(0,600);
    const rectFor=el=>el.getBoundingClientRect();
    const carousel=el=>!!el.closest('[aria-roledescription="carousel"],[class*="carousel"],[class*="slider"],[class*="swiper"]');
    const physical=[];
    for (const el of candidates) {
      const rect=rectFor(el);
      examined++;
      const fixed=['fixed','sticky'].includes(getComputedStyle(el).position);
      const inCarousel=carousel(el);
      if(!inCarousel && rect.width>8 && rect.height>8 &&
          (rect.left < -12 || rect.right > width+12)) {
        add('INTERACTIVE_OUTSIDE_VIEWPORT',el,rect,
          'Interactive element extends beyond CSS viewport width');
      }
      if(fixed && rect.height>innerHeight*.95 && rect.top<=0 && rect.bottom>=innerHeight)
        add('LARGE_FIXED_ELEMENT',el,rect,'Large fixed overlay may obstruct content');
      // More than half an interactive target hidden by a clipping ancestor
      // is worth review. Scrollable containers are deliberately excluded.
      if(!inCarousel && rect.width>=24 && rect.height>=20) {
        let ancestor=el.parentElement;
        for(let depth=0;ancestor && depth<7;ancestor=ancestor.parentElement,depth++){
          const s=getComputedStyle(ancestor);
          if(/hidden|clip/.test(s.overflowX+' '+s.overflowY)){
            const ar=rectFor(ancestor);
            const area=Math.max(0,Math.min(rect.right,ar.right)-Math.max(rect.left,ar.left))*
              Math.max(0,Math.min(rect.bottom,ar.bottom)-Math.max(rect.top,ar.top));
            if(area/(rect.width*rect.height)<.5){
              add('CLIPPED_INTERACTIVE',el,rect,'Interactive target mostly clipped by a container');
              break;
            }
          }
        }
      }
      if(!inCarousel && rect.width>=28 && rect.height>=22)
        physical.push({element:el,rect,
          x:rect.x+scrollX,y:rect.y+scrollY});
    }
    // Test independently positioned controls; nested controls are not compared.
    // This deliberately returns review candidates rather than hard failures.
    physical.sort((a,b)=>a.y-b.y);
    for(let i=0;i<physical.length && findings.length<max;i++){
      const a=physical[i];
      for(let j=i+1;j<physical.length && findings.length<max;j++){
        const b=physical[j];
        if(b.y>=a.y+a.rect.height)break;
        if(a.element.contains(b.element)||b.element.contains(a.element))continue;
        const iw=Math.max(0,Math.min(a.x+a.rect.width,b.x+b.rect.width)-Math.max(a.x,b.x));
        const ih=Math.max(0,Math.min(a.y+a.rect.height,b.y+b.rect.height)-Math.max(a.y,b.y));
        const smaller=Math.min(a.rect.width*a.rect.height,b.rect.width*b.rect.height);
        if(smaller>0 && iw*ih/smaller>.6){
          add('OVERLAPPING_INTERACTIVES',b.element,b.rect,
            'Overlapping interactive controls need visual review');
        }
      }
    }
    return {
      version:1,viewport:{width:innerWidth,height:innerHeight},
      examined,truncated:allVisible.length>600,
      findings,classification:findings.length||allVisible.length>600?'REVIEW_REQUIRED':'PASS',
      limitations:['Offscreen slides and conditional UI are not treated as confirmed failures',
        'Clipping and overlap findings are conservative candidates, not confirmed defects',
        'This is a static DOM geometry scan, not a real touch-device test']
    };
  });
}
module.exports={inspectResponsiveLayout};
