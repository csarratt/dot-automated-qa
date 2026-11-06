'use strict';

const SUPPORTED_HOSTS = new Set(['www.usaa.com', 'rwww.usaa.com']);

function requireSupportedUsaaUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Preview URL required');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !SUPPORTED_HOSTS.has(url.hostname) ||
      url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Only approved HTTPS www.usaa.com or rwww.usaa.com URLs are supported');
  }
  return url;
}

function createBaselineUrl(raw) {
  const url = requireSupportedUsaaUrl(raw);
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('optimizely_')) url.searchParams.delete(key);
  }
  url.searchParams.set('optimizely_disable', 'true');
  return url.toString();
}

module.exports = {
  requireSupportedUsaaUrl,
  requirePublicUsaaUrl: requireSupportedUsaaUrl, // compatibility with existing files
  createBaselineUrl
};
