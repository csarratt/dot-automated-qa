'use strict';

function requirePublicUsaaUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Preview URL required');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.hostname !== 'www.usaa.com' || url.username || url.password) {
    throw new Error('Only public https://www.usaa.com URLs are supported');
  }
  return url;
}

function createBaselineUrl(raw) {
  const url = requirePublicUsaaUrl(raw);
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('optimizely_')) url.searchParams.delete(key);
  }
  url.searchParams.set('optimizely_disable', 'true');
  return url.toString();
}

module.exports = { requirePublicUsaaUrl, createBaselineUrl };
