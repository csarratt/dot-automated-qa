'use strict';

/**
 * Capture-friendly overlays are hidden only for an additional screenshot.
 * The untouched screenshot remains the authoritative browser evidence.
 * Never clicks cookie consent, Optimizely QA buttons or changes page logic.
 */
async function maskKnownOverlays(browser) {
  return browser.execute(() => {
    const visible = el => {
      const b = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const candidates = [];
    const safe = (el, kind, maxHeight, maxWidth) => {
      if (!el || el === document.body || el === document.documentElement || !visible(el)) return false;
      const b = el.getBoundingClientRect();
      if (b.height > innerHeight * maxHeight || b.width > innerWidth * maxWidth) return false;
      if (b.bottom < 0 || b.top > innerHeight) return false;
      candidates.push({ el, kind });
      return true;
    };

    // Locate cookie controls, then bound the masking to their visible banner.
    const cookieButton = [...document.querySelectorAll('button, [role="button"]')]
      .find(el => visible(el) && /^(accept only essential cookies|accept cookies)$/i.test((el.innerText || '').trim()));
    if (cookieButton) {
      let el = cookieButton.parentElement;
      while (el && el !== document.body) {
        const text = (el.innerText || '').toLowerCase();
        const box = el.getBoundingClientRect();
        if (box.width >= innerWidth * .5 && /cookies/.test(text) &&
            /accept/.test(text) && safe(el, 'cookie-banner', .48, 1.01)) break;
        el = el.parentElement;
      }
    }

    // Only mask the small Optimizely QA welcome panel, not the experiment.
    const qaNode = [...document.querySelectorAll('div, p, span')]
      .find(el => visible(el) && el.children.length === 0 &&
        /welcome to optimizely qa/i.test(el.textContent || ''));
    if (qaNode) {
      let el = qaNode.parentElement;
      while (el && el !== document.body) {
        const b = el.getBoundingClientRect();
        const t = (el.innerText || '').toLowerCase();
        if (b.width > 150 && /draft changes/.test(t) &&
            safe(el, 'optimizely-qa-panel', .42, .65)) break;
        el = el.parentElement;
      }
    }

    const masked = [];
    for (const { el, kind } of candidates) {
      if (el.hasAttribute('data-dot-qa-masked')) continue;
      el.setAttribute('data-dot-qa-masked', kind);
      el.setAttribute('data-dot-qa-original-visibility', el.style.getPropertyValue('visibility'));
      el.setAttribute('data-dot-qa-original-priority', el.style.getPropertyPriority('visibility'));
      el.style.setProperty('visibility', 'hidden', 'important');
      masked.push(kind);
    }
    return masked;
  });
}

async function restoreKnownOverlays(browser) {
  await browser.execute(() => {
    for (const el of document.querySelectorAll('[data-dot-qa-masked]')) {
      const original = el.getAttribute('data-dot-qa-original-visibility') || '';
      const priority = el.getAttribute('data-dot-qa-original-priority') || '';
      if (original) el.style.setProperty('visibility', original, priority);
      else el.style.removeProperty('visibility');
      el.removeAttribute('data-dot-qa-original-visibility');
      el.removeAttribute('data-dot-qa-original-priority');
      el.removeAttribute('data-dot-qa-masked');
    }
  });
}

module.exports = { maskKnownOverlays, restoreKnownOverlays };
