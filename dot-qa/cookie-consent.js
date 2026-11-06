'use strict';

// Replicate a user selecting the explicit "Accept Cookies" / "Accept All" option.
// This intentionally changes consent state in disposable QA browser sessions.
// Do not silently choose essential-only or modify cookies with JavaScript.
async function acceptCookies(browser) {
  const choice = async () => {
    const buttons = await browser.$$('button, [role="button"]');
    for (const button of buttons) {
      try {
        if (!(await button.isDisplayed())) continue;
        const text = (await button.getText()).trim().replace(/\s+/g, ' ');
        const aria = ((await button.getAttribute('aria-label')) || '').trim().replace(/\s+/g, ' ');
        if (/^(accept cookies|accept all cookies|accept all)$/i.test(text) ||
            /^(accept cookies|accept all cookies|accept all)$/i.test(aria)) return button;
      } catch {
        // Ignore elements detached during rendering.
      }
    }
    return null;
  };
  const button = await choice();
  if (!button) return { status: 'Consent button not displayed', clicked: false };
  await button.click();
  await browser.waitUntil(async () => !(await choice()), {
    timeout: 12000,
    interval: 350,
    timeoutMsg: 'Accept Cookies was clicked but its consent button remained visible'
  });
  return { status: 'Accept Cookies selected', clicked: true };
}
module.exports = { acceptCookies };
