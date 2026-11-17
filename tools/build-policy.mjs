/** Current build identity shared by the producer and protected-deployment preflight. */
export const buildPolicy = Object.freeze({
  application: 'ardesia-next',
  milestone: 'M3',
  persistence: 'remote-postgres-required',
  thirdPartyExecution: true,
  programRuntime: Object.freeze({
    abi: 'ardesia.program/1',
    policy: 'ephemeral-explicit-consent-no-io',
    engine: 'quickjs-emscripten@0.32.0',
  }),
});

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Unknown runtime capabilities require an explicit policy update, never a permissive fallback. */
export function matchesBuildPolicy(value) {
  if (!record(value) || !record(value.programRuntime)) return false;
  const {programRuntime, ...fields} = buildPolicy;
  return Object.entries(fields).every(([key, expected]) => Object.hasOwn(value, key) && value[key] === expected)
    && Object.keys(value.programRuntime).length === Object.keys(programRuntime).length
    && Object.entries(programRuntime).every(([key, expected]) =>
      Object.hasOwn(value.programRuntime, key) && value.programRuntime[key] === expected);
}
