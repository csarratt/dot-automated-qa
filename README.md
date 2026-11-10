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

## Review-evidence update (November 2026)

After the page-ready wait succeeds, the test now stores an **untouched top screenshot** as evidence. If the cookie consent banner or Optimizely QA welcome panel is confidently recognized, it also creates a **prepared screenshot** that hides the identified overlay *for that image only*, without clicking or accepting consent. Actual validations and the authoritative screenshot remain unmodified. The prepared view may not be available if the element cannot be safely identified.

The report includes expandable per-browser checks and separates URL query-*presence* changes from link additions/removals. It still deliberately redacts all query values, including Optimizely preview tokens.

To install this change, update these files in the existing local project:

- `dot-qa/run.js`
- `test/specs/dot-experiment.test.js`
- **New:** `dot-qa/overlay-evidence.js`

Do not alter `wdio.conf.js`. Begin with a previously validated public or Runway preview, `1366x768`, then inspect the original/prepared screenshot links and check details. The updated code has not been exercised inside the USAA environment by the assistant. Consent controls, variation identity and metric/event firing are **not** validated by the screenshot preparation logic.

## Reporting clarification

Review screenshots remain the source of truth. The optional `Mask attempt` screenshot is a visual aid only; it is not verified to have concealed all cookie or Optimizely QA overlays. The HTML report starts collapsed, with individual checks and link differences expanded on demand. No automatic visual-diff or variation-applied assertion is made by this change.

## Optimizely state diagnostics (November 2026)

The new read-only `dot-qa/optimizely-state.js` helper inspects the documented Optimizely Web Experimentation state API after the page finishes rendering. It captures active experiment/campaign IDs and variation IDs (not names). The report includes counts and details, and attempts to compare active IDs with the URL's `optimizely_preview_layer_ids`. A match indicates a candidate active experiment/campaign and **does not prove visual variation changes were applied**. A non-match is inconclusive, especially when preview layers differ from experiment IDs or redirects stripped preview query parameters. The disabled baseline may have no Optimizely SDK.

It **does not validate Optimizely metrics**: triggering events, event registration, pageview events and network transport have not been verified. Do not interpret an active variation mapping as conversion tracking.

To install, copy:
- updated `test/specs/dot-experiment.test.js`
- updated `dot-qa/run.js`
- new `dot-qa/optimizely-state.js`

Run one known preview at 1366x768 and inspect individual checks and active IDs. Do not publish snapshots or screenshots to a personal repository.

## Cookie consent behavior (current)

The active QA test clicks the actual **Accept Cookies** / **Accept All Cookies** action, when present, in each isolated baseline and variation browser session. This deliberately models the opted-in experience. It then waits for page stability before collecting link inventory and screenshots. No CSS overlay masking is used in the active test; `overlay-evidence.js` is a legacy experiment and is not needed for this build. The run retains a **Before consent** screenshot and a post-consent **Original** screenshot. If the consent control is not shown, the report says so; review the screenshot if a banner remains or a consent UI uses unexpected wording. The cookie choice may affect analytics/event behavior and must be consistent for both experiences.

Install/update: `dot-qa/cookie-consent.js`, `test/specs/dot-experiment.test.js`, and `dot-qa/run.js`. Do not alter `wdio.conf.js`.

## Automatic Sauce Labs credential loading (current)

The DOT runner now resolves Sauce credentials inside `dot-qa/run.js`, before launching WebdriverIO:
- First, use both `SAUCE_USERNAME` and `SAUCE_ACCESS_KEY` if supplied by an approved environment/CI secret store.
- Otherwise, on macOS, read generic-password entries from the user's default Keychain using `/usr/bin/security`. No credentials are written to source, the GitHub repository, or QA reports.
- Keychain entries use account `$USER` and two distinct services: `DOT-QA-Sauce-Username` and `DOT-QA-Sauce-Access-Key`.

### One-time setup (on approved work Mac)

In a terminal, enter these commands **one at a time**. Each asks interactively for the value and does not put the value in terminal history or the shell process arguments:

```bash
security add-generic-password -a "$USER" -s 'DOT-QA-Sauce-Username' -U -w
security add-generic-password -a "$USER" -s 'DOT-QA-Sauce-Access-Key' -U -w
```

When the first command prompts for the password, enter your **Sauce Labs username** (it is stored as a generic-password value); for the second, enter your **Sauce Labs access key**. Confirm prompts if requested. Never share either in chat.

After installing both updated `dot-qa/run.js` and new `dot-qa/sauce-credentials.js`, verify without launching a browser:

```bash
node dot-qa/run.js --check-credentials
```

Expected: `Sauce Labs credentials available (macOS Keychain). Values not displayed.` If a macOS Keychain access dialog appears, review and approve only as permitted by company policy. Unattended scheduling requires an unlocked permitted Keychain and validated noninteractive access; if the machine locks or company policy restricts access, an approved runner/CI secret store will be needed. Do not use broad Keychain permissions such as `-A` or embed secrets in shell startup scripts.

Continue normal test execution:

```bash
node dot-qa/run.js --url 'YOUR_OPTIMIZELY_PREVIEW_URL' --viewports 1366x768
```

Only the DOT runner's child processes receive the credentials. Direct manual `npx wdio` commands do not automatically use this fallback. Legacy documentation mentioning temporary terminal credentials is superseded by this section.

## Variation assignment verification (November 2026)

The runner now inspects Optimizely's read-only active state and records `variationIdentity` for the variation session. It distinguishes (1) active variation assignment with no expected IDs supplied, (2) explicit expected experiment/variation ID match, (3) mismatch, and (4) holdback/no active assignment. An unexpected assignment fails the variation session so it is not accidentally treated as a pass. This is **assignment verification, not proof that the intended DOM changes executed**. Existing link comparisons remain evidence for review and are not conclusive visual checks.

By default, keep the current single-URL command. To assert a known experiment and variation ID:

```bash
node dot-qa/run.js --url 'YOUR_OPTIMIZELY_PREVIEW_URL' --viewports 1366x768 --expect-experiment 123456789 --expect-variation 987654321
```

The numeric IDs above are examples, not real test IDs. If you supply an expected experiment but omit the variation, only the experiment assignment is checked. The runner cannot infer which change was intended from a preview URL alone. A future test-definition/Optimizely API integration can supply expected IDs and DOM assertions automatically without requiring OAs to type them.

Update these three files locally: `dot-qa/variation-validation.js` (new), `test/specs/dot-experiment.test.js`, and `dot-qa/run.js`. Leave the current credential loader, consent helper, and WDIO configuration unchanged.

## Phase 2: QA decision framework and portable reporting (current)

**Authoritative output is now `qa-results/runs/<run-id>/package/index.html`**, not the older `report.html`. The legacy report continues to be generated for backwards compatibility. Phase 2 applies a central registry, typed check statuses and conservative aggregation. It does not add new browser-based validations. Because required future-phase tests are NOT_TESTED, the overall result should currently be REVIEW_REQUIRED for an otherwise healthy test run, not PASS. A confirmed failed required test becomes FAIL; missing remote execution becomes BLOCKED. Execution failures override incomplete checks. This is intentional and does not mean your previously working browser tests suddenly broke.

Update these files in the existing work project:

- New: `dot-qa/check-registry.js`
- New: `dot-qa/result-engine.js`
- New: `dot-qa/report-package.js`
- Updated: `dot-qa/run.js`
- New: `test/phase2.test.js` (unit test, no browser session)

Run unit tests before using Sauce Labs:

```bash
node --test test/phase2.test.js
```

Then run a normal experiment:

```bash
node dot-qa/run.js --url 'YOUR_PREVIEW_URL' --viewports 1366x768
```

For cases where it is relevant, explicitly enable additional mandatory scope checks with `--spa`, `--authenticated`, and/or `--accessibility`. Not specifying these flags does **not** certify the tested page has no SPA, authenticated, or accessibility requirements; the request/intake workflow must provide appropriate applicability metadata.

### Package contract

Each execution retains its unique run directory. Its `package/` subfolder contains:

- `index.html` — portable review report with finding list, per-browser check matrices, and relative screenshot links
- `results.json` — full structured check-level status, severity, coverage, evidence links
- `sharepoint-result.json` — future SharePoint field payload, including `qaPassed`, authoritative status and counts
- `manifest.json` — file list, byte size and SHA-256 hashes for upload verification
- `screenshots/` — copies of relevant local evidence, referenced with relative links

The package is **local only**. `sharepoint-result.json` explicitly sets `published:false`, `boxReportUrl:null` and `sharepointWriteStatus:NOT_ATTEMPTED`. No Box or SharePoint API actions are performed. Before integrating Box, validate whether its supported HTML viewer resolves sibling files; a Box link to `index.html` cannot be assumed to function as a static website. All images and outputs must undergo the organization's data-handling review before upload. A Zip download or approved static hosting mechanism may be needed.

### Status definitions

- `PASS`: every applicable required check is implemented, executed and passed
- `FAIL`: at least one required test or remote execution failed
- `BLOCKED`: required validation could not run or necessary remote result was not produced
- `REVIEW_REQUIRED`: no conclusive required failure, but unverified, ambiguous or unimplemented mandatory assertions remain
- Check-level `NOT_TESTED` and `NOT_APPLICABLE` are not treated as passing tests

A SharePoint Yes/No flag is `true` **only** for overall PASS. For blocked/review/fail it is false with a separate status code. No authorization to publish an experiment is granted by these results. Existing DOT review/publish separation of duties still applies.

## Complete page review evidence (November 2026)

The prior top/bottom pair was insufficient to inspect long experiment pages. The current runner now records **overlapping screenshot sections from header through footer**, after actual cookie acceptance, for each browser / viewport / experience. The package includes every section screenshot, an explicit `fullPageCoverage` status, and an organized, expandable **baseline vs variation** gallery at the start of `package/index.html`.

This is deliberately **not** called a single stitched full-page PNG: the remote browsers capture viewport-sized images while scrolling. There is slight overlap between sections, and sticky elements may repeat. A follow-up phase can create stitched PNGs using a verified image-compositing library. The section-based approach covers all four remote browsers without assuming browser-specific native full-page screenshot support. No automatic pixel-diff is performed; `visualRegression` remains NOT_TESTED.

The capture walks through up to 40 sections per experience at approximately 85% of the viewport height and waits briefly to help lazy-loaded content appear. If it cannot confirm it reached the footer, `fullPageCoverage` is marked NEEDS REVIEW and the package labels the capture incomplete. Very long or continually expanding pages may require targeted adjustments. Capturing complete pages increases execution time and Box package size; we will measure this when piloting several viewports.

Install only these updated/new files:

- **New:** `dot-qa/page-sections.js`
- **Updated:** `test/specs/dot-experiment.test.js`
- **Updated:** `dot-qa/check-registry.js`
- **Updated:** `dot-qa/report-package.js`
- **Updated:** `test/phase2.test.js`

No change required to `dot-qa/run.js` for this update. Run `node --test test/phase2.test.js` first, then execute one 1366x768 preview with the existing `node dot-qa/run.js --url ...` command. Open `package/index.html`, expand **Full page review**, and verify both experiences reach the footer. Results remain local; no Box/SharePoint upload is performed.

## Sauce Labs video walkthroughs (current, replaces page sections)

Rather than creating dozens of screenshots, each baseline/variation job now records a slow controlled scroll from top through the footer after cookie acceptance. The Sauce desktop job's video capture is explicitly enabled in `dot-qa/wdio-environment.conf.mjs`. The browser test stores only a Sauce session/job ID, then the portable report creates protected links to Sauce Labs Test Details, where authorized users can watch/download the recording. Availability of the actual Sauce video asset is **not yet verified** by the runner. The recorded video includes the surrounding test session, not only the scroll.

The suite retains just the before-consent, post-consent top and bottom evidence images for diagnostics, but does not create section PNGs. The former `dot-qa/page-sections.js` file can remain on disk but is no longer imported. The report shows baseline and variation recording links in an expandable list grouped by browser/viewport. `fullPageCoverage` now means the automated scroll reached the end; it does not prove recording exists, the screen rendered correctly, or the expected visual changes are correct. Visual regression stays NOT_TESTED.

The `package/` folder contains remote job references but **does not yet contain downloaded video files**. Sauce Labs test assets are typically retained for 30 days and access depends on team/account visibility. For enduring Box archives, a later authorized integration must securely download and validate MP4 assets through the Sauce Jobs API, scan/redact sensitive imagery where required, update the package manifest and upload them to approved storage. We will not set Sauce jobs public to make their links work.

Install these files into the existing work project:
- New: `dot-qa/video-walkthrough.js`
- Updated: `dot-qa/wdio-environment.conf.mjs`
- Updated: `test/specs/dot-experiment.test.js`
- Updated: `dot-qa/report-package.js`
- Updated: `dot-qa/check-registry.js`
- Updated: `test/phase2.test.js`

Run `node --test test/phase2.test.js` and then one standard run with `node dot-qa/run.js --url 'YOUR_PREVIEW_URL' --viewports 1366x768`. Open `package/index.html` and verify the links open the proper Sauce Labs job with the video tab and the expected scrolling behavior. Do not transfer sensitive job recordings to personal repositories.

## Sauce video walk-through stability correction

A Sauce video can reach the footer even if the remote session terminates before the WebDriver test returns. Such an interruption must not be classified as a website or variation defect. The active test now marks recognized terminated/missing remote sessions `Blocked` and the Phase 2 result engine maps those cases to `BLOCKED` for the SharePoint-ready status (unless a separate confirmed mandatory assertion failed). Original test notes and remote job ID are retained for diagnosis.

The walk-through now uses a shorter pause and larger overlapping scroll increments to reduce remote-command overhead. This is a stability optimization, **not proof the session lifetime root cause has been identified**. Sauce Labs job videos remain available for manual review and are not downloaded into Box yet.

Update these four files: `dot-qa/video-walkthrough.js`, `test/specs/dot-experiment.test.js`, `dot-qa/result-engine.js`, and `test/phase2.test.js`. First run `node --test test/phase2.test.js`. Then run one normal experiment if you want to verify the changes across all four browsers.

## Phase 3: DOM and responsive comparison (November 2026)

This update adds a privacy-conscious, bounded browser DOM inventory (visible headings, controls, links, images), static responsive geometry checks, and a comparison of the *same* browser and viewport's baseline versus variation. A new section of `package/index.html` groups actual actionable findings separately from unimplemented coverage; the latter no longer floods the initial report with repeated rows.

**New files**
- `dot-qa/dom-inventory.js`
- `dot-qa/dom-comparison.js`
- `dot-qa/responsive-layout.js`
- `test/phase3.test.js`

**Updated files**
- `test/specs/dot-experiment.test.js`
- `dot-qa/run.js`
- `dot-qa/check-registry.js`
- `dot-qa/report-package.js`

Run both local suites before launching a browser:
```bash
node --test test/phase2.test.js test/phase3.test.js
```
Then validate one viewport in the normal runner:
```bash
node dot-qa/run.js --url 'YOUR_RWWW_PREVIEW_URL' --viewports 1366x768
```

### What is verified

- Collecting a bounded *visible DOM inventory* in each baseline and variation browser session.
- Comparing text and semantic type for headings, controls, links and images.
- Detecting changed image/link resource **path fingerprints** without recording raw URLs or query strings.
- Detecting substantial movement/size changes of unique matching DOM elements.
- Reviewing interactive elements extending horizontally offscreen, mostly clipped by an ancestor, or significantly overlapping another independent control. These geometry heuristics are conservative: all such findings require review, they are **not confirmed website failures**.
- Recording comparisons by browser, viewport and experience in `results.json` and showing them in the HTML report. No additional screenshot sets; the Sauce Labs video walk-through remains the primary review evidence.

### What is NOT yet proved

An automated DOM difference is not proof that intended Optimizely variation changes worked, and a DOM match is not proof that the experiment is correct. Image pixels, canvas, shadow-DOM internals, CSS pseudo-elements and visual regressions are not inspected. The DOM collection stops after 500 visible elements, the responsive scan after 600 interactive elements, and truncated scans are marked for review. Large dynamic sites may need tailored exclusions and event-based checks. Current viewport checks use resized desktop browsers, **not real mobile hardware**.

The existing `expectedDomChanges`, `visualRegression`, and other unimplemented mandatory checks stay `NOT_TESTED`; the overall QA status remains `REVIEW_REQUIRED` for a healthy run, unless a confirmed failure or blocked session takes precedence. An advisor or experiment metadata source will ultimately need to specify expected changes to distinguish intentional differences from defects.

Current evidence includes some page text and opaque resource fingerprints. Keep reports within approved USAA environments and **do not use this public-page DOM inventory for authenticated member pages until redaction and data classification are reviewed**. The Box/SharePoint integration is still future work.
