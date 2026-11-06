// WebdriverIO requires a named "config" export when loading this file.
// Keep the existing project's WDIO configuration unchanged.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { config: base } = require('../wdio.conf.js');
const { requireSupportedUsaaUrl } = require('./url.js');

if (!base || !Array.isArray(base.capabilities)) {
  throw new Error('Expected capabilities in the existing wdio.conf.js');
}
const target = requireSupportedUsaaUrl(process.env.DOT_QA_URL);
const runway = target.hostname === 'rwww.usaa.com';

export const config = {
  ...base,
  capabilities: base.capabilities.map(cap => {
    const options = { ...(cap['sauce:options'] || {}) };
    delete options.tunnelName;
    delete options.tunnelOwner;
    if (runway) {
      options.tunnelName = 'usaa-stage-tunnel';
      options.tunnelOwner = 'usaa_admin';
    }
    return { ...cap, 'sauce:options': options };
  })
};
