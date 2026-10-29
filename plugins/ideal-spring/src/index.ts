import type {PluginState} from '@ardesia/plugin-sdk';

/** Distribution metadata only. The executable model stays behind the Host. */
export const idealSpringId = 'ardesia.ideal-spring' as const;
export const idealSpring = /* @__PURE__ */ Object.freeze({
  id: idealSpringId,
  name: 'Molla ideale',
  version: '1.0.0',
  stateSchemaVersion: '1.0.0',
  bundlePath: '/plugins/ideal-spring/1.0.0/plugin.js',
  manifestPath: '/plugins/ideal-spring/1.0.0/manifest.json',
  description: 'Una massa e una molla: esplora posizione, periodo ed energia.',
});

export const idealSpringInitialState: PluginState = Object.freeze({
  schemaVersion: '1.0.0',
  value: Object.freeze({
    massKg: 1,
    stiffnessNPerM: 20,
    initialDisplacementM: 0.2,
    initialVelocityMPerS: 0,
    timeS: 0,
  }),
});
