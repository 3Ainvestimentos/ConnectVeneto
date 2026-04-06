export const FEATURE_FLAGS = {
  areaLogada: true,
  businessIntelligence: false,
  venetoStore: true,
  regrasComerciais: true,
  debugBootstrap: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
