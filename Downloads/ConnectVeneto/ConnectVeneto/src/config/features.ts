export const FEATURE_FLAGS = {
  rankings: true,
  businessIntelligence: false,
  businessIntelligenceLeaders: false,
  venetoStore: true,
  labs: true,
  debugBootstrap: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
