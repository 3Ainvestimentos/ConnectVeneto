export const FEATURE_FLAGS = {
  regrasComerciais: true,
  bibliotecaComercial: true,
  debugBootstrap: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
