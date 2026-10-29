import {PluginManifestSchema} from '@ardesia/plugin-sdk';

/** M0: fail closed until M1 verification and a first-party consumer exist. */
export function inspectPlugin(candidate: unknown): {allowed: false; reason: 'INVALID_MANIFEST' | 'EXECUTION_NOT_ENABLED'} {
  return {allowed: false, reason: PluginManifestSchema.safeParse(candidate).success ? 'EXECUTION_NOT_ENABLED' : 'INVALID_MANIFEST'};
}
export const hostAvailability = Object.freeze({install: false, execute: false, thirdParty: false, reason: 'Contratti predisposti. Nessun plugin eseguibile in M0.'});
