import {describe, expect, it} from 'vitest';
import {PluginResponseSchema} from '@ardesia/plugin-sdk';
import {handleSpringRequest} from './handler';
import {idealSpringInitialState} from './index';

const request = {
  protocol: 'ardesia-plugin/1', requestId: 'request-1', instanceId: 'spring-instance-1', action: 'evaluate',
  state: idealSpringInitialState,
};

describe('Worker message contract', () => {
  it('returns the correlated, validated scientific view and serializable state', () => {
    const response = handleSpringRequest(request);
    expect(PluginResponseSchema.safeParse(response).success).toBe(true);
    expect(response?.ok).toBe(true);
    expect(response?.requestId).toBe('request-1');
    expect(response?.instanceId).toBe('spring-instance-1');
    if (!response?.ok) throw new Error('Expected successful response');
    expect(response.state).toEqual(idealSpringInitialState);
    expect(JSON.parse(JSON.stringify(response))).toEqual(response);
    expect(response.view.title).toBe('Molla ideale');
    expect(response.view.metrics.find(metric => metric.label === 'Energia totale')?.value).toBeCloseTo(0.4, 14);
  });

  it.each([
    {schemaVersion: '2.0.0', value: idealSpringInitialState.value},
    {schemaVersion: '1.0.0', value: {...idealSpringInitialState.value as object, massKg: 0}},
    {schemaVersion: '1.0.0', value: {massKg: 1}},
  ])('rejects incompatible scientific state without a fabricated success', state => {
    const response = handleSpringRequest({...request, state});
    expect(response?.ok).toBe(false);
    expect(PluginResponseSchema.safeParse(response).success).toBe(true);
    if (response?.ok !== false) throw new Error('Expected rejected state');
    expect(response.error.code).toBe('INVALID_STATE');
  });

  it.each([null, {}, {...request, action: 'execute'}, {...request, protocol: 'unknown'}, {...request, extra: true}])('ignores malformed or unsupported messages', candidate => {
    expect(handleSpringRequest(candidate)).toBeUndefined();
  });
});
