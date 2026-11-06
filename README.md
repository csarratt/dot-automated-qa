# DOT Automated QA: experiment comparison POC

This private repository contains **generic, public-and-Runway-page** WebdriverIO source code for comparing an Optimizely-disabled baseline to a variation preview across browsers and viewport sizes.

**Do not add** USAA-specific preview URLs, internal page details, Runway IDs, secrets, cookies, Sauce Labs access keys, screenshots, reports, or member data to GitHub. Confirm company policy permits external code hosting. Keep the repository private.

## Contents

- `dot-qa/url.js` validates approved USAA public and Runway URLs and derives an `optimizely_disable=true` baseline.
- `dot-qa/wdio-environment.conf.mjs` uses the existing local four-browser configuration, automatically selecting the shared staging tunnel for rwww and no tunnel for www.\n- `dot-qa/run.js` runs all browsers configured in your existing WebdriverIO project, once for each baseline/variation and target viewport. It generates a **local** HTML report.
- `test/specs/dot-experiment.test.js` gathers page, viewport, images, scrolling, link inventory, and screenshot evidence.
- `.gitignore` blocks common secrets, dependencies and local QA outputs.

## Install into your existing project

Do **not** replace your established `wdio.conf.js`, other tests, or your SharePoint/Box/dispatcher scripts.

From your existing `DOT Automated Testing` project root, copy the four source files from this repository into the matching paths and create any missing folders. If your approved work environment can access GitHub and permits cloning this private repo, you may also clone it to a separate folder and copy those four files into your current project. **Do not clone over the working project.**

The current project must have its working Node.js/WebdriverIO dependencies, Sauce Labs credentials in the current terminal and the verified four-browser `capabilities` matrix. Windows Chrome/Edge must use the display setting previously validated on that machine; Safari should retain its working macOS configuration.

## First run

Use a **non-sensitive, authorized public experiment** and start with one proven viewport:

```bash
node dot-qa/run.js --url 'YOUR_OPTIMIZELY_PREVIEW_URL' --viewports 1366x768
```

Then expand:

```bash
node dot-qa/run.js --url 'YOUR_OPTIMIZELY_PREVIEW_URL' --viewports 1366x768,1024x768
```

With four configured browsers and two viewports, the runner requests **16 sessions** in total (four browsers × two viewports × baseline and variation), scheduling browser capabilities in parallel within each run subject to available concurrency.

Open the local `qa-results/runs/<run-id>/report.html` path printed in the terminal. Keep reports local and restricted. Preview URL tokens may appear in WebDriver or vendor logs; do not share those outputs publicly.

## Current coverage

- Exact CSS viewport calibration with a WebDriver browser-window adjustment.
- Page ready state and visible content.
- Broken image count.
- Horizontal overflow.
- Basic top-to-bottom and return scrolling.
- Passive link inventory, suspicious-link findings and baseline-versus-variation additions/removals. No links are clicked.
- Top/bottom screenshots and a local HTML report.

**Runway connectivity:** Chrome was separately verified to reach and render a Runway page through the shared staging tunnel. This package has not yet verified the full four-browser Runway matrix or authenticated member flows.\n\n**Not implemented:** Optimizely metric/event verification, initial JavaScript/network error capture, automated variation identity checks, automated visual diff, safe CTA interactions, mobile device sessions, Runway login, and SharePoint status synchronization. These checks must not be represented as passing.

The baseline generated with `optimizely_disable=true` is not equivalent to a true Optimizely control preview. A baseline comparison can reflect unrelated dynamic content. Query parameter **values** are deliberately omitted from link inventories, meaning changes restricted to query values won't be detected.

A QA pass does not certify an experiment for publication. Keep existing DOT peer-review and publish controls in effect.

## Next build milestones

1. Run this package against an approved preview URL and review the HTML report.
2. Verify targeted intended changes and false positives with real experiments.
3. Add deliberate positive/negative tests for safe links, interactions and Optimizely on-page events.
4. Add supported JavaScript/network monitoring and structured issue classification.
5. Add authorized Runway authentication in the work environment, not this repository.
6. Integrate the verified QA engine into the existing SharePoint request workflow after data-handling review.

## Environment-aware execution

For `https://www.usaa.com` the runner strips any old tunnel settings; for `https://rwww.usaa.com` it supplies the existing shared tunnel `usaa-stage-tunnel` and owner `usaa_admin` to each browser capability. This modifies only the in-memory WebdriverIO configuration, not your local `wdio.conf.js`. It does not bypass authentication or guarantee tunnel permission for other browsers. Use an approved Runway preview and review the actual screenshots. Do not print or share preview tokens.
