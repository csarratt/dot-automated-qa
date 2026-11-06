'use strict';

// Read-only Optimizely Web Experimentation state inspection.
// This does not activate, trigger, or send any Optimizely events.
// Excludes experiment/variation names and customer data from local snapshots.
async function inspectOptimizelyState(browser) {
  return browser.execute(() => {
    const sdk = window.optimizely;
    const result = {
      sdkAvailable: Boolean(sdk && typeof sdk.get === 'function'),
      activeExperiments: [],
      activeCampaigns: [],
      matchedPreviewLayer: false,
      previewLayerIds: [],
      stateReadError: null
    };

    const rawPreviewIds = new URL(location.href).searchParams.get('optimizely_preview_layer_ids') || '';
    result.previewLayerIds = rawPreviewIds.split(',')
      .map(id => id.trim()).filter(id => /^\d{3,25}$/.test(id)).slice(0, 15);

    if (!result.sdkAvailable) return result;

    try {
      const state = sdk.get('state');
      if (!state) return result;

      const experiments = typeof state.getExperimentStates === 'function'
        ? state.getExperimentStates({ isActive: true }) : {};
      result.activeExperiments = Object.values(experiments || {})
        .filter(exp => exp && exp.isActive)
        .slice(0, 100).map(exp => ({
          experimentId: String(exp.id || ''),
          variationId: exp.variation?.id == null ? null : String(exp.variation.id),
          holdback: Boolean(exp.isInExperimentHoldback)
        })).filter(exp => /^\d+$/.test(exp.experimentId));

      const campaigns = typeof state.getCampaignStates === 'function'
        ? state.getCampaignStates({ isActive: true }) : {};
      result.activeCampaigns = Object.entries(campaigns || {})
        .filter(([, value]) => value && value.isActive)
        .slice(0, 100).map(([id, campaign]) => ({
          campaignId: String(id),
          experimentId: campaign.experiment?.id == null ? null : String(campaign.experiment.id),
          variationId: campaign.variation?.id == null ? null : String(campaign.variation.id),
          holdback: Boolean(campaign.isInCampaignHoldback)
        })).filter(c => /^\d+$/.test(c.campaignId));

      const activatedIds = new Set([
        ...result.activeExperiments.map(exp => exp.experimentId),
        ...result.activeCampaigns.flatMap(c => [c.campaignId, c.experimentId])
      ]);
      result.matchedPreviewLayer = result.previewLayerIds.some(id => activatedIds.has(id));
    } catch (error) {
      // Do not store exception messages: SDK diagnostics can contain URLs or tokens.
      result.stateReadError = 'Optimizely state API unavailable or returned an error';
    }
    return result;
  });
}

module.exports = { inspectOptimizelyState };
