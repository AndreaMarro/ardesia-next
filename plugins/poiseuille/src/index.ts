import type {PluginState} from '@ardesia/plugin-sdk';

/** Public candidate metadata. No executable scientific implementation is exported. */
export const poiseuille = Object.freeze({id: 'ardesia.poiseuille', name: 'Flusso di Poiseuille', version: '1.0.0', stateSchemaVersion: '1.0.0', status: 'draft'} as const);
export const poiseuillePressureState: PluginState = Object.freeze({schemaVersion: '1.0.0', value: Object.freeze({
  radiusM: 0.001, lengthM: 1, viscosityPaS: 0.001, densityKgPerM3: 1000, pressureDropPa: 800,
})});
export const poiseuilleFlowState: PluginState = Object.freeze({schemaVersion: '1.0.0', value: Object.freeze({
  radiusM: 0.001, lengthM: 1, viscosityPaS: 0.001, densityKgPerM3: 1000, flowRateM3PerS: Math.PI * 1e-7,
})});
