'use strict';

// This helper performs one intentional, least-permissive cookie-consent
// interaction in a disposable remote QA browser session.
// It never selects "Accept Cookies" or "Accept All" and does not manipulate cookies.
async function selectEssentialCookies(browser) {
  const buttons = await browser.$$('button, [role="button"]');
  let target = null;
  for (const button of buttons) {
    try {
      if (!(await button.isDisplayed())) continue;
      const label = (await button.getText()).trim().replace(/\s+/g, ' ');
      if (/^accept only essential cookies$/i.test(label)) {
        target = button;
        break;
      }
    } catch {
      // Detached controls are ignored; other visible controls may still exist.
    }
  }
  if (!target) return { status: 'Not shown', clicked: false };
  await target.click();
  await browser.waitUntil(async () => {
    const matches = await browser.$$('button, [role="button"]');
    for (const item of matches) {
      try {
        if (await item.isDisplayed() &&
            /^accept only essential cookies$/i.test((await item.getText()).trim().replace(/\s+/g, ' ')))
          return false;
      } catch {}
    }
    return true;
  }, {
    timeout: 12000, interval: 350,
    timeoutMsg: 'Essential-cookie selection did not dismiss the consent controls'
  });
  return { status: 'Essential-only choice applied', clicked: true };
}

module.exports = { selectEssentialCookies };
