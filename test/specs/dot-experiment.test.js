'use strict';
const fs = require('fs');
const path = require('path');
const { requirePublicUsaaUrl, createBaselineUrl } = require('../../dot-qa/url');
const { acceptCookies } = require('../../dot-qa/cookie-consent');
const { inspectOptimizelyState } = require('../../dot-qa/optimizely-state');
const { validateVariationIdentity } = require('../../dot-qa/variation-validation');
const { recordPageWalkthrough } = require('../../dot-qa/video-walkthrough');
const { collectDomInventory } = require('../../dot-qa/dom-inventory');
const { inspectResponsiveLayout } = require('../../dot-qa/responsive-layout');

const mode = process.env.DOT_QA_MODE;
const width = Number(process.env.DOT_QA_WIDTH);
const height = Number(process.env.DOT_QA_HEIGHT);
const output = process.env.DOT_QA_OUTPUT;

function redactedDestination(raw) {
  try {
    const url = new URL(raw, 'https://www.usaa.com/');
    if (!['http:', 'https:'].includes(url.protocol)) return url.protocol + '[value redacted]';
    return url.origin + url.pathname + (url.search ? '?[query redacted]' : '');
  } catch {
    return '[invalid destination]';
  }
}

async function calibrate() {
  let outerWidth = width, outerHeight = height;
  for (let attempt = 0; attempt < 6; attempt++) {
    await browser.setWindowSize(outerWidth, outerHeight);
    const viewport = await browser.execute(() => ({
      width: window.innerWidth, height: window.innerHeight
    }));
    if (viewport.width === width && viewport.height === height) return viewport;
    outerWidth += width - viewport.width;
    outerHeight += height - viewport.height;
  }
  throw new Error('Could not calibrate CSS viewport');
}

async function waitForRenderedPage() {
  let previous = null;
  let consecutive = 0;
  let last = null;
  await browser.waitUntil(async () => {
    last = await browser.execute(() => {
      const visible = element => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const css = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 &&
          css.display !== 'none' && css.visibility !== 'hidden';
      };
      const headings = [...document.querySelectorAll('h1, main h2')].filter(visible);
      const main = document.querySelector('main, [role="main"]');
      const candidate = main && visible(main) ? main : document.body;
      const bodyText = (candidate?.innerText || '').trim();
      const loadingLabels = [...document.querySelectorAll(
        '[role="progressbar"], [aria-busy="true"], [aria-label], [role="status"]'
      )].filter(visible).filter(el =>
        el.getAttribute('role') === 'progressbar' ||
        el.getAttribute('aria-busy') === 'true' ||
        /^(loading|please wait)(\.{0,3})?$/i.test(
          (el.getAttribute('aria-label') || el.innerText || '').trim()
        )
      );
      const loaderOnly = !headings.length &&
        /^(loading|please wait)(\.{0,3})?$/i.test(bodyText.slice(0, 50));
      return {
        complete: document.readyState === 'complete',
        hasHeading: headings.length > 0,
        hasMainContent: bodyText.length > 120,
        loading: loadingLabels.length > 0 || loaderOnly,
        // Layout and link count must stop changing before evidence capture.
        signature: [headings.length, document.links.length,
          document.documentElement.scrollHeight, bodyText.length].join(':')
      };
    });
    const ready = last.complete && last.hasHeading &&
      last.hasMainContent && !last.loading;
    consecutive = ready && last.signature === previous ? consecutive + 1 : 0;
    previous = last.signature;
    return ready && consecutive >= 3;
  }, {
    timeout: 45000,
    interval: 750,
    timeoutMsg: 'Page render did not stabilize: expected visible heading, main content, and no active loading indicator'
  });
  return last;
}

async function inspect() {
  return browser.execute(() => {
    const sanitize = raw => {
      try {
        const url = new URL(raw, location.href);
        if (!['http:', 'https:'].includes(url.protocol)) return url.protocol + '[value redacted]';
        return url.origin + url.pathname + (url.search ? '?[query redacted]' : '');
      } catch { return '[invalid destination]'; }
    };
    const links = [...document.querySelectorAll('a[href]')].map(a => {
      const raw = (a.getAttribute('href') || '').trim();
      const label = (a.innerText || a.getAttribute('aria-label') || '')
        .trim().replace(/\s+/g, ' ').slice(0, 100);
      let issue = null;
      if (!raw || raw === '#') issue = 'Placeholder';
      else if (/^javascript:/i.test(raw)) issue = 'JavaScript URL';
      else if (/^https?:\/\/tel:/i.test(raw)) issue = 'Suspicious telephone destination';
      else {
        try {
          const protocol = new URL(raw, location.href).protocol;
          if (!['http:', 'https:', 'mailto:', 'tel:'].includes(protocol)) issue = 'Unexpected protocol';
        } catch { issue = 'Malformed URL'; }
      }
      return { label, destination: sanitize(raw), issue };
    });
    const doc = document.documentElement;
    return {
      title: document.title.slice(0, 150),
      ready: document.readyState === 'complete',
      hasContent: Boolean(document.body?.innerText.trim()),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      brokenImageCount: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length,
      horizontalOverflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
      links
    };
  });
}

async function scrollCheck() {
  const max = await browser.execute(() => Math.max(0,
    document.documentElement.scrollHeight - window.innerHeight));
  if (max <= 2) return 'Not applicable';
  await browser.execute(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await browser.waitUntil(() => browser.execute(() =>
    window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 8
  ), { timeout: 7000 });
  await browser.execute(() => window.scrollTo(0, 0));
  await browser.waitUntil(() => browser.execute(() => window.scrollY <= 5), { timeout: 7000 });
  return 'Passed';
}

describe('DOT public-page experiment QA', () => {
  it('captures experiment evidence at the requested CSS viewport', async () => {
    if (!['baseline','variation'].includes(mode) || !Number.isInteger(width) ||
        !Number.isInteger(height) || !output || !path.isAbsolute(output)) {
      throw new Error('Missing DOT QA execution settings');
    }
    const preview = requirePublicUsaaUrl(process.env.DOT_QA_URL).toString();
    const target = mode === 'baseline' ? createBaselineUrl(preview) : preview;
    const browserName = String(browser.capabilities.browserName || 'unknown')
      .toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const prefix = `${browserName}-${mode}-${width}x${height}`;
    const shots = path.join(output, 'screenshots');
    const snapshots = path.join(output, 'snapshots');
    fs.mkdirSync(shots, { recursive: true, mode: 0o700 });
    fs.mkdirSync(snapshots, { recursive: true, mode: 0o700 });
    const report = { browser: browserName, mode, viewportTarget: `${width}x${height}`,
      status: 'Failed', checks: {}, screenshots: {}, notes: [] };
    try {
      // Persist only Sauce job ID, not preview URLs or credentials.
      report.sauceJobId = typeof browser.sessionId === 'string' &&
        /^[a-f0-9-]{12,128}$/i.test(browser.sessionId)
        ? browser.sessionId : null;
      await browser.url(target);
      await browser.waitUntil(() => browser.execute(() => document.readyState === 'complete'),
        { timeout: 30000 });
      await calibrate();
      report.checks.renderReady = 'Not verified';
      const readiness = await waitForRenderedPage();
      report.checks.renderReady = 'Passed';
      report.readiness = readiness;
      // Preserve evidence before the consent interaction.
      const initial = `${prefix}-before-consent.png`;
      await browser.saveScreenshot(path.join(shots, initial));
      report.screenshots.beforeConsent = `screenshots/${initial}`;
      report.consent = await acceptCookies(browser);
      report.checks.cookieConsent = report.consent.clicked
        ? 'Accept Cookies selected'
        : 'Not shown (review if banner remains)';
      // Consent can change page layout or analytics behavior.
      if (report.consent.clicked) {
        await waitForRenderedPage();
      }
      const page = await inspect();
      report.page = page;
      report.optimizely = await inspectOptimizelyState(browser);
      const os = report.optimizely;
      report.checks.optimizelySdk = os.sdkAvailable
        ? 'Detected' : 'Not detected';
      report.checks.activeExperimentCount = String(os.activeExperiments.length);
      report.checks.activeCampaignCount = String(os.activeCampaigns.length);
      report.checks.previewLayerMatch = mode === 'baseline'
        ? 'Not applicable (disabled baseline)'
        : !os.previewLayerIds.length ? 'Not determined (preview layer ID unavailable)'
        : os.matchedPreviewLayer ? 'Active ID matched preview layer (review required)'
        : 'Unconfirmed (no active ID matched preview layer)';
      const identity = validateVariationIdentity(os, mode,
        process.env.DOT_QA_EXPECT_EXPERIMENT || null,
        process.env.DOT_QA_EXPECT_VARIATION || null);
      report.checks.variationIdentity = identity.status;
      report.variationIdentityMatched = identity.matched;
      report.notes.push('Assignment verification uses Optimizely state. It does not prove that intended DOM changes executed or any metric fired.');
      report.checks.viewport = page.viewport.width === width && page.viewport.height === height ? 'Passed' : 'Failed';
      report.checks.page = page.ready && page.hasContent ? 'Passed' : 'Failed';
      report.checks.images = page.brokenImageCount ? 'Failed' : 'Passed';
      report.checks.overflow = page.horizontalOverflow > 2 ? 'Failed' : 'Passed';
      report.checks.links = page.links.some(link => link.issue) ? 'Needs review' : 'Passed';
      // Phase 3: capture a bounded public-page inventory and potential
      // responsive issues before scrolling changes sticky/animated content.
      try {
        report.domInventory = await collectDomInventory(browser);
        report.checks.domInventory = report.domInventory.truncated ?
          'Needs review' : 'Passed';
      } catch (error) {
        report.checks.domInventory = 'Needs review';
        report.notes.push('DOM inventory unavailable: '+String(error.message||'Error')
          .replace(/https?:\/\/[^\s"'<>]+/g,'[URL redacted]').slice(0,160));
      }
      try {
        report.responsive = await inspectResponsiveLayout(browser);
        report.checks.responsiveLayout = report.responsive.classification === 'PASS'
          ? 'Passed' : 'Needs review';
      } catch (error) {
        report.checks.responsiveLayout = 'Needs review';
        report.notes.push('Responsive scan unavailable: '+String(error.message||'Error')
          .replace(/https?:\/\/[^\s"'<>]+/g,'[URL redacted]').slice(0,160));
      }
      // Screenshot reflects the actual post-consent page, not hidden DOM elements.
      const top = `${prefix}-top.png`;
      await browser.saveScreenshot(path.join(shots, top));
      report.screenshots.top = `screenshots/${top}`;
      report.notes.push('Consent uses the actual Accept Cookies control when available; no masking or synthetic cookie changes were performed.');
      // A visible preview badge is indicative of preview UI, NOT proof the variation applied.
      report.checks.previewUiDetected = await browser.execute(() =>
        [...document.querySelectorAll('body *')].some(el => el.children.length === 0 &&
          /welcome to optimizely qa/i.test(el.textContent || ''))
      ) ? 'Detected (not variation verified)' : 'Not detected';
      const maxScroll = await browser.execute(() =>
        document.documentElement.scrollHeight - window.innerHeight);
      if (maxScroll > 2) {
        await browser.execute(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await browser.pause(350);
        const bottom = `${prefix}-bottom.png`;
        await browser.saveScreenshot(path.join(shots, bottom));
        report.screenshots.bottom = `screenshots/${bottom}`;
      }
      report.checks.scrolling = await scrollCheck();
      // Sauce Labs normally records every desktop session. Give reviewers a
      // controlled visual walk-through, without generating dozens of images.
      report.videoWalkthrough = await recordPageWalkthrough(browser);
      report.checks.fullPageCoverage = report.videoWalkthrough.complete
        ? 'Passed' : 'Needs review';
      if (!report.videoWalkthrough.complete) report.notes.push(
        'Video walkthrough did not reach document end: '+report.videoWalkthrough.reason);
      for (const item of ['optimizelyMetrics', 'javascriptErrors',
        'networkErrors', 'ctaInteractions', 'visualRegression']) {
        report.checks[item] = 'Not tested';
      }
      report.status = ['renderReady','viewport','page','images','overflow','scrolling'].some(k =>
        report.checks[k] === 'Failed') ? 'Failed' : 'Passed with review';
      if (identity.matched === false && mode === 'variation') {
        report.status = 'Failed';
        throw new Error('Optimizely variation assignment was not confirmed');
      }
      if (report.status === 'Failed') throw new Error('Core page validation failed');
    } catch (error) {
      // Remote-session termination is an infrastructure interruption, not
      // evidence that the website or experiment failed a QA assertion.
      const message = String(error.message || 'Unknown failure');
      const sessionUnavailable =
        /session.*(?:already finished|no such session|invalid session id|terminated|does not exist|deleted|closed)/i.test(message) ||
        /(?:session.*(?:can't|cannot) receive further commands)/i.test(message);
      report.status = sessionUnavailable ? 'Blocked' : 'Failed';
      if (sessionUnavailable) {
        report.executionErrorKind = 'REMOTE_SESSION_UNAVAILABLE';
        if (!report.checks.fullPageCoverage)
          report.checks.fullPageCoverage = 'Blocked';
      }
      report.notes.push(String(error.message || 'Unknown failure')
        .replace(/https?:\/\/[^\s"'<>]+/g, '[URL redacted]').slice(0, 300));
      throw error;
    } finally {
      fs.writeFileSync(path.join(snapshots, prefix + '.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
      console.log(`DOT QA snapshot: ${prefix} (${report.status})`);
    }
  });
});
