export const FEATURE_FLAGS = {
  businessIntelligence: false,
  venetoStore: true,
  regrasComerciais: true,
  debugBootstrap: false,
  portalRepasse: true,
  portalCliente: true,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
