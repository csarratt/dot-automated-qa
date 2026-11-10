'use strict';

// Read-only public-page DOM inventory. No HTML, form values, cookies,
// preview tokens, or raw URLs are captured.
async function collectDomInventory(browser) {
  return browser.execute(() => {
    const clean = s => String(s || '').replace(/\s+/g,' ').trim().slice(0,110);
    const visible = e => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return !!(r.width && r.height && s.display !== 'none' &&
        s.visibility !== 'hidden' && +s.opacity > 0);
    };
    const root = document.querySelector('main,[role="main"]') || document.body;
    const candidates = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6,button,a[href],img,[role="button"],input,select,textarea')]
      .filter(visible).slice(0,500);
    const entries = candidates.map(el => {
      const tag=el.tagName.toLowerCase();
      const role=el.getAttribute('role')||'';
      const label=clean((tag==='img' ? el.getAttribute('alt') :
        (el.getAttribute('aria-label') || el.innerText || '')));
      // Deliberately omit image URLs, anchor query strings, input contents,
      // input names/IDs and other member-specific data.
      const kind=/^h[1-6]$/.test(tag)?'heading':
        tag==='img'?'image':
        ['button','input','select','textarea'].includes(tag)||role==='button'?'control':'link';
      const type=tag==='input'?clean(el.getAttribute('type')):'';
      const r=el.getBoundingClientRect();
      const style=getComputedStyle(el);
      return {kind,tag,label,type,
        geometry:{
          x:Math.round(r.left+scrollX), y:Math.round(r.top+scrollY),
          width:Math.round(r.width),height:Math.round(r.height)
        },
        fontSize:kind==='heading'?style.fontSize:undefined
      };
    });
    return {
      version:1,
      counts:{
        headings:entries.filter(e=>e.kind==='heading').length,
        controls:entries.filter(e=>e.kind==='control').length,
        images:entries.filter(e=>e.kind==='image').length,
        links:entries.filter(e=>e.kind==='link').length
      },
      truncated:candidates.length===500,
      entries
    };
  });
}
module.exports={collectDomInventory};
