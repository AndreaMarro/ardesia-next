import {describe, it, expect} from 'vitest';
import {PluginResponseSchema, PluginViewSchema} from '@ardesia/plugin-sdk';
import {evaluatePoiseuille, poiseuilleView, parsePoiseuilleState} from './model';
import {handlePoiseuilleRequest} from './handler';

const geometry = {radiusM: 0.001, lengthM: 1, viscosityPaS: 0.001, densityKgPerM3: 1000};
const pressure = (patch = {}) => ({schemaVersion: '1.0.0', value: {...geometry, pressureDropPa: 8, ...patch}});
const flow = (patch = {}) => ({schemaVersion: '1.0.0', value: {...geometry, flowRateM3PerS: Math.PI * 1e-9, ...patch}});
describe('Poiseuille SI model, independent boundary conditions and limits', () => {
  it('matches an analytic SI reference and a no-slip parabola', () => {
    const result = evaluatePoiseuille(pressure());
    expect(result.flowRateM3PerS).toBeCloseTo(Math.PI * 1e-9, 18);
    expect(result.meanVelocityMPerS).toBeCloseTo(0.001, 14);
    expect(result.maximumVelocityMPerS).toBeCloseTo(0.002, 14);
    expect(result.reynolds).toBeCloseTo(2, 12);
    const points = poiseuilleView(result).plot.series[0]!.points;
    expect(points[0]!.y).toBe(0); expect(points.at(-1)!.y).toBe(0);
    expect(points[64]!.y).toBeCloseTo(0.002, 14);
    expect(points[96]!.y).toBeCloseTo(0.0015, 14);
  });
  it('D10: at fixed pressure radius ×2 gives area ×4, flow ×16, mean speed ×4 and Re ×8', () => {
    const a = evaluatePoiseuille(pressure()), b = evaluatePoiseuille(pressure({radiusM: 0.002}));
    expect(b.areaM2 / a.areaM2).toBeCloseTo(4); expect(b.flowRateM3PerS / a.flowRateM3PerS).toBeCloseTo(16);
    expect(b.meanVelocityMPerS / a.meanVelocityMPerS).toBeCloseTo(4); expect(b.reynolds / a.reynolds).toBeCloseTo(8);
  });
  it('D11 and D12: at fixed flow radius ×2 gives pressure ÷16 and speed ÷4; viscosity and length ×2 give pressure ×4', () => {
    const a = evaluatePoiseuille(flow()), b = evaluatePoiseuille(flow({radiusM: 0.002}));
    expect(a.pressureDropPa).toBeCloseTo(8, 12); expect(b.pressureDropPa / a.pressureDropPa).toBeCloseTo(1 / 16);
    expect(b.meanVelocityMPerS / a.meanVelocityMPerS).toBeCloseTo(1 / 4);
    expect(evaluatePoiseuille(flow({viscosityPaS: 0.002, lengthM: 2})).pressureDropPa).toBeCloseTo(32, 12);
  });
  it('integrates the independently sampled velocity profile over annuli to recover Q', () => {
    const r = evaluatePoiseuille(pressure());
    let q = 0; const n = 10000, dr = geometry.radiusM / n;
    for (let i = 0; i < n; i++) {const x = (i + 0.5) * dr; const u = 8 * (geometry.radiusM ** 2 - x ** 2) / (4 * geometry.viscosityPaS * geometry.lengthM); q += u * 2 * Math.PI * x * dr;}
    expect(Math.abs(q / r.flowRateM3PerS - 1)).toBeLessThan(1e-8);
  });
  it('distinguishes reverse flow and zero forcing in both controls', () => {
    expect(evaluatePoiseuille(pressure({pressureDropPa: -8})).flowRateM3PerS).toBeCloseTo(-Math.PI * 1e-9, 18);
    expect(evaluatePoiseuille(flow({flowRateM3PerS: -Math.PI * 1e-9})).pressureDropPa).toBeCloseTo(-8, 12);
    for (const state of [pressure({pressureDropPa: 0}), flow({flowRateM3PerS: 0})]) {
      const r = evaluatePoiseuille(state); expect(r.reynolds).toBe(0); expect(r.flowRateM3PerS).toBe(0); expect(r.pressureDropPa).toBe(0);
    }
  });
  it('refuses out-of-domain comparisons rather than silently claiming laminarity', () => {
    expect(evaluatePoiseuille(pressure({pressureDropPa: 1000})).reynolds).toBeCloseTo(250);
    expect(() => evaluatePoiseuille(pressure({pressureDropPa: 1000, radiusM: 0.002}))).toThrow('Re ≥ 2000');
    expect(() => evaluatePoiseuille(pressure({pressureDropPa: -1000, radiusM: 0.002}))).toThrow('Re ≥ 2000');
  });
  it.each([NaN, Infinity, -Infinity, '', '0.001', null, true, 0, -0.001])('refuses degenerate radius %j without coercion', value => {
    expect(() => evaluatePoiseuille(pressure({radiusM: value}))).toThrow();
  });
  it('refuses missing, extra, double-driving, hidden and incompatible state fields', () => {
    const missing = pressure(); delete (missing.value as Record<string, unknown>).viscosityPaS;
    const getter = pressure(); Object.defineProperty(getter.value, 'radiusM', {get: () => 0.001});
    for (const state of [missing, getter, pressure({extra: 1}), pressure({flowRateM3PerS: 0}), {schemaVersion: '2.0.0', value: pressure().value}, {schemaVersion: '1.0.0', value: geometry}]) expect(() => parsePoiseuilleState(state)).toThrow();
  });
  it('roundtrips the exact driving condition through generic SDK parameters, with finite SI output', () => {
    for (const state of [pressure(), flow()]) {
      const before = structuredClone(state), view = poiseuilleView(evaluatePoiseuille(state));
      expect(PluginViewSchema.safeParse(view).success).toBe(true);
      expect(parsePoiseuilleState({schemaVersion: '1.0.0', value: Object.fromEntries(view.parameters.map(p => [p.key, p.value]))})).toEqual(state);
      expect(state).toEqual(before);
    }
  });
  it('correlates protocol responses and preserves rejection, not executable markup', () => {
    const request = {protocol: 'ardesia-plugin/1', requestId: 'req-1', instanceId: 'lab-1', action: 'evaluate', state: pressure()};
    expect(PluginResponseSchema.safeParse(handlePoiseuilleRequest(request)).success).toBe(true);
    expect(handlePoiseuilleRequest({...request, state: pressure({radiusM: 0})})).toMatchObject({requestId: 'req-1', instanceId: 'lab-1', ok: false, error: {code: 'INVALID_STATE'}});
    expect(handlePoiseuilleRequest({...request, action: 'fetch'})).toBeUndefined();
  });
});
