import { config as environment } from './wdio-environment.conf.mjs';

// Chrome-only configuration for a read-only diagnostic run.
export const config = {
  ...environment,
  maxInstances: 1,
  capabilities: environment.capabilities.filter(
    cap => String(cap.browserName || '').toLowerCase() === 'chrome'
  )
};

if (config.capabilities.length !== 1) {
  throw new Error('Could not identify exactly one Chrome capability');
}
