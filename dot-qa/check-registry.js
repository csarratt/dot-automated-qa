'use strict';

// Phase 2 is a deliberately conservative coverage contract. Until future phases
// implement and exercise these validations, REQUIRED checks prevent overall PASS.
const registry = Object.freeze([
  { id:'renderReady', title:'Stable rendered page', category:'Page', severity:'critical', required:true, scope:'both', implementation:'implemented' },
  { id:'viewport', title:'Exact CSS viewport', category:'Responsive', severity:'high', required:true, scope:'both', implementation:'implemented' },
  { id:'page', title:'Visible page content', category:'Page', severity:'critical', required:true, scope:'both', implementation:'implemented' },
  { id:'images', title:'No broken image resources', category:'Resources', severity:'high', required:true, scope:'both', implementation:'implemented' },
  { id:'overflow', title:'No horizontal document overflow', category:'Responsive', severity:'high', required:true, scope:'both', implementation:'implemented' },
  { id:'scrolling', title:'Page scrolls and returns', category:'Functionality', severity:'high', required:true, scope:'both', implementation:'implemented' },
  { id:'cookieConsent', title:'Consent flow', category:'Functionality', severity:'high', required:true, scope:'both', implementation:'implemented' },
  { id:'links', title:'Link inventory syntax', category:'Functionality', severity:'medium', required:true, scope:'both', implementation:'implemented' },
  { id:'variationIdentity', title:'Expected Optimizely variation assignment', category:'Optimizely', severity:'critical', required:true, scope:'variation', implementation:'partial' },
  { id:'expectedDomChanges', title:'Expected variation DOM assertions', category:'Optimizely', severity:'critical', required:true, scope:'variation', implementation:'planned' },
  { id:'targeting', title:'Audience/page targeting and exclusions', category:'Optimizely', severity:'critical', required:true, scope:'variation', implementation:'planned' },
  { id:'optimizelyMetrics', title:'Optimizely event and metric verification', category:'Tracking', severity:'critical', required:true, scope:'variation', implementation:'planned' },
  { id:'javascriptErrors', title:'Runtime JavaScript errors', category:'Runtime', severity:'high', required:true, scope:'both', implementation:'planned' },
  { id:'networkErrors', title:'Failed network dependencies', category:'Runtime', severity:'high', required:true, scope:'both', implementation:'planned' },
  { id:'ctaInteractions', title:'Safe primary interactions', category:'Functionality', severity:'high', required:true, scope:'variation', implementation:'planned' },
  { id:'fullPageCoverage', title:'Full-page screenshot coverage', category:'Visual', severity:'high', required:true, scope:'both', implementation:'implemented' },
  { id:'visualRegression', title:'Full page visual comparison', category:'Visual', severity:'high', required:true, scope:'variation', implementation:'planned' },
  { id:'responsiveLayout', title:'Clipping, overlap and touch targets', category:'Responsive', severity:'high', required:true, scope:'both', implementation:'planned' },
  { id:'spaLifecycle', title:'SPA transitions and duplicate activation', category:'Optimizely', severity:'high', required:true, scope:'variation', implementation:'planned', applicability:'when-spa' },
  { id:'accessibility', title:'Automated accessibility baseline', category:'Accessibility', severity:'high', required:true, scope:'both', implementation:'planned', applicability:'when-in-scope' },
  { id:'performance', title:'Performance regression budgets', category:'Performance', severity:'medium', required:false, scope:'both', implementation:'planned' },
  { id:'authenticatedFlows', title:'Authenticated flow validation', category:'Functionality', severity:'critical', required:true, scope:'variation', implementation:'planned', applicability:'when-authenticated' }
]);

function applies(check, mode, profile = {}) {
  if (check.scope !== 'both' && check.scope !== mode) return false;
  if (check.applicability === 'when-spa') return profile.spa === true;
  if (check.applicability === 'when-authenticated') return profile.authenticated === true;
  if (check.applicability === 'when-in-scope') return profile.accessibility === true;
  return true;
}

module.exports = { registry, applies };
