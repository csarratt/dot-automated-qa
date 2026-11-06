'use strict';
const { execFileSync } = require('node:child_process');

// Generic-password items, created once on the approved Mac using
// "security add-generic-password ... -w" (interactive password prompt).
const SERVICE_USERNAME = 'DOT-QA-Sauce-Username';
const SERVICE_ACCESS_KEY = 'DOT-QA-Sauce-Access-Key';

function readKeychain(service) {
  try {
    return execFileSync('/usr/bin/security', [
      'find-generic-password', '-a', process.env.USER || '',
      '-s', service, '-w'
    ], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 12000, maxBuffer: 8192
    }).trim();
  } catch {
    return '';
  }
}

function resolveSauceCredentials(env = process.env) {
  // Respect approved CI secret injection if it provides both values.
  if (env.SAUCE_USERNAME && env.SAUCE_ACCESS_KEY) {
    return {
      username: env.SAUCE_USERNAME, accessKey: env.SAUCE_ACCESS_KEY,
      source: 'environment'
    };
  }
  if (process.platform !== 'darwin') {
    throw new Error('Sauce credentials missing. Configure approved SAUCE_USERNAME and SAUCE_ACCESS_KEY environment secrets on this runner.');
  }
  const username = env.SAUCE_USERNAME || readKeychain(SERVICE_USERNAME);
  const accessKey = env.SAUCE_ACCESS_KEY || readKeychain(SERVICE_ACCESS_KEY);
  if (!username || !accessKey) {
    throw new Error('Sauce credentials unavailable. Set up the two DOT-QA-Sauce Keychain entries on this Mac, or provide approved environment secrets.');
  }
  return { username, accessKey, source: 'macOS Keychain' };
}
module.exports = { resolveSauceCredentials };
