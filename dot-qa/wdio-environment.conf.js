'use strict';

// Overlay the proven local WebdriverIO configuration without changing it.
// For Runway use the approved shared Sauce Labs staging tunnel.
// For production ensure no stale tunnel from manual diagnostics is inherited.
const { config: base } = require('../wdio.conf.js');
const { requireSupportedUsaaUrl } = require('./url');

const target = requireSupportedUsaaUrl(process.env.DOT_QA_URL);
const runway = target.hostname === 'rwww.usaa.com';

exports.config = {
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
