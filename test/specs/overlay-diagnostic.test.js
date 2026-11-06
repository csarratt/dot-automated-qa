'use strict';
const fs = require('fs');
const path = require('path');

// Diagnostic only: no clicks, consent changes, mutation or screenshots.
// Returns structural facts (tag, geometry, shadow/iframe counts) rather than page text or URLs.
describe('DOT overlay structure diagnostic', () => {
  it('inspects known visible overlay candidates', async () => {
    const target = process.env.DOT_QA_URL;
    const out = process.env.DOT_QA_DIAGNOSTICS;
    if (!target || !out) throw new Error('DOT_QA_URL and DOT_QA_DIAGNOSTICS required');
    const { requireSupportedUsaaUrl } = require('../../dot-qa/url');
    requireSupportedUsaaUrl(target);
    await browser.url(target);
    await browser.waitUntil(async () => browser.execute(() => {
      const heading = document.querySelector('h1');
      return document.readyState === 'complete' && !!heading &&
        heading.getBoundingClientRect().width > 0;
    }), { timeout: 45000 });
    await browser.pause(1800);
    const info = await browser.execute(() => {
      const clean = node => {
        if (!node || node.nodeType !== 1) return null;
        const r = node.getBoundingClientRect();
        const s = getComputedStyle(node);
        return {
          tag: node.tagName.toLowerCase(),
          role: node.getAttribute('role'),
          width: Math.round(r.width), height: Math.round(r.height),
          x: Math.round(r.x), y: Math.round(r.y),
          visible: s.display !== 'none' && s.visibility !== 'hidden' &&
            r.width > 0 && r.height > 0,
          position: s.position,
          zIndex: s.zIndex,
          shadowRoot: !!node.shadowRoot,
          childCount: node.children.length
        };
      };
      const ancestorChain = node => {
        const result = [];
        for (let i = 0; node && node.nodeType === 1 && i < 9; node = node.parentElement, i++) {
          result.push(clean(node));
        }
        return result;
      };
      const visible = node => {
        if (!node || node.nodeType !== 1) return false;
        const r = node.getBoundingClientRect();
        const s = getComputedStyle(node);
        return r.width > 0 && r.height > 0 && s.display !== 'none' &&
          s.visibility !== 'hidden';
      };
      const cookie = [...document.querySelectorAll('button,[role="button"]')]
        .find(el => visible(el) && /accept only essential cookies/i.test((el.innerText || '').trim()));
      const qa = [...document.querySelectorAll('body *')]
        .find(el => el.children.length === 0 && visible(el) &&
          /welcome to optimizely qa/i.test((el.textContent || '').trim()));
      const iframe = [...document.querySelectorAll('iframe')].map(clean);
      const shadows = [...document.querySelectorAll('*')].filter(el => !!el.shadowRoot).slice(0, 20).map(clean);
      const banners = [...document.querySelectorAll('[data-dot-qa-masked]')].map(clean);
      const corners = [[.95,.1],[.9,.3],[.5,.9]].map(([x,y]) => {
        const el = document.elementFromPoint(Math.min(innerWidth-1,Math.round(innerWidth*x)),
          Math.min(innerHeight-1,Math.round(innerHeight*y)));
        return { at:[x,y], chain: ancestorChain(el).slice(0,5) };
      });
      return {
        cookieButtonFound: !!cookie,
        cookieAncestors: ancestorChain(cookie),
        qaTextFound: !!qa,
        qaAncestors: ancestorChain(qa),
        iframeCount: iframe.length, iframes: iframe.slice(0, 15),
        shadowHostCount: shadows.length, shadows,
        corners, banners
      };
    });
    const absolute = path.resolve(out);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, JSON.stringify(info, null, 2), { mode: 0o600 });
    console.log('DOT overlay diagnostic saved (local only): ' + absolute);
    console.log('Cookie button found: ' + info.cookieButtonFound +
      '; Optimizely QA text found: ' + info.qaTextFound +
      '; iframes: ' + info.iframeCount +
      '; shadow hosts: ' + info.shadowHostCount);
  });
});
