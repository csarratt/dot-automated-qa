'use strict';

// Evaluate Optimizely's read-only active state. This checks assignment, not
// whether experiment JavaScript made the intended DOM/visual change.
function validateVariationIdentity(state, mode, expectedExperimentId, expectedVariationId) {
  if (mode === 'baseline') return {
    status: 'Not applicable (Optimizely disabled baseline)',
    matched: null
  };
  if (!state || state.stateReadError || !state.sdkAvailable) {
    return { status: 'Unconfirmed (Optimizely state unavailable)', matched: false };
  }
  const records = [
    ...(state.activeExperiments || []).map(x => ({
      experimentId: x.experimentId, variationId: x.variationId, holdback: x.holdback
    })),
    ...(state.activeCampaigns || []).map(x => ({
      experimentId: x.experimentId, variationId: x.variationId, holdback: x.holdback
    }))
  ];
  // Deduplicate representations of the same experiment/variation.
  const unique = [...new Map(records.map(x =>
    [[x.experimentId, x.variationId].join(':'), x])).values()];
  const actual = unique.filter(x => !!x.variationId && !x.holdback);
  if (expectedExperimentId) {
    const matchingExperiment = unique.filter(x => x.experimentId === expectedExperimentId);
    if (!matchingExperiment.length)
      return { status: 'Mismatch (expected experiment not active)', matched: false };
    if (expectedVariationId) {
      const matchingVariation = matchingExperiment.find(x =>
        x.variationId === expectedVariationId && !x.holdback);
      return matchingVariation
        ? { status: 'Expected experiment and variation active (DOM not verified)', matched: true }
        : { status: 'Mismatch (expected variation not active or in holdback)', matched: false };
    }
    return matchingExperiment.some(x => x.variationId && !x.holdback)
      ? { status: 'Expected experiment active; variation ID not specified', matched: true }
      : { status: 'Unconfirmed (experiment in holdback or no variation)', matched: false };
  }
  if (!actual.length) return {
    status: unique.length ? 'Unconfirmed (holdback or no variation assignment)' :
      'Unconfirmed (no active experiment assignment)',
    matched: false
  };
  return {
    status: 'Active variation assignment detected (expected identity not supplied)',
    matched: null
  };
}
module.exports = { validateVariationIdentity };
