import {describe, expect, it} from 'vitest';
import {evaluateSpring, parseSpringState, springView, SpringStateError} from './model';
import {idealSpringInitialState} from './index';

const state = (value: Record<string, unknown> = {}) => ({
  schemaVersion: '1.0.0',
  value: {massKg: 1, stiffnessNPerM: 4, initialDisplacementM: 0.25, initialVelocityMPerS: 0, timeS: 0, ...value},
});

describe('Ideal spring scientific model', () => {
  it.each([
    [0, 20, 0, 0], [4, 20, 0.2, 0.4], [4, 40, 0.1, 0.2], [6, 80, 0.075, 0.225], [10, 20, 0.5, 2.5],
  ])('preserves the legacy SI example F=%s N, k=%s N/m, x=%s m, U=%s J', (force, stiffness, extension, energy) => {
    // Original static external-force examples; restoring force has the opposite sign.
    const result = evaluateSpring(state({stiffnessNPerM: stiffness, initialDisplacementM: extension}));
    expect(result.displacementM).toBeCloseTo(extension, 14);
    expect(result.forceN).toBeCloseTo(-force, 14);
    expect(result.elasticEnergyJ).toBeCloseTo(energy, 14);
    expect(result.kineticEnergyJ).toBe(0);
  });

  it('matches independent quarter-period points for m=1 kg, k=4 N/m, x0=0.25 m', () => {
    const initial = evaluateSpring(state());
    expect(initial.periodS).toBeCloseTo(Math.PI, 14);
    expect(initial.angularFrequencyRadPerS).toBe(2);
    expect(initial.mechanicalEnergyJ).toBe(0.125);
    const quarter = evaluateSpring(state({timeS: Math.PI / 4}));
    expect(quarter.displacementM).toBeCloseTo(0, 14);
    expect(quarter.velocityMPerS).toBeCloseTo(-0.5, 14);
    expect(quarter.kineticEnergyJ).toBeCloseTo(0.125, 14);
    expect(quarter.elasticEnergyJ).toBeCloseTo(0, 14);
    const half = evaluateSpring(state({timeS: Math.PI / 2}));
    expect(half.displacementM).toBeCloseTo(-0.25, 14);
    expect(half.velocityMPerS).toBeCloseTo(0, 14);
    expect(half.forceN).toBeCloseTo(1, 14);
    const full = evaluateSpring(state({timeS: Math.PI}));
    expect(full.displacementM).toBeCloseTo(0.25, 14);
    expect(full.velocityMPerS).toBeCloseTo(0, 14);
  });

  it('preserves independent nonzero initial velocity and a stationary equilibrium', () => {
    const moving = evaluateSpring(state({initialDisplacementM: 0, initialVelocityMPerS: 1, timeS: Math.PI / 4}));
    expect(moving.displacementM).toBeCloseTo(0.5, 14);
    expect(moving.velocityMPerS).toBeCloseTo(0, 14);
    expect(moving.elasticEnergyJ).toBeCloseTo(0.5, 14);
    expect(moving.amplitudeM).toBe(0.5);
    for (const timeS of [0, 0.7, 13, 60]) {
      const resting = evaluateSpring(state({initialDisplacementM: 0, initialVelocityMPerS: 0, timeS}));
      expect(Math.abs(resting.displacementM)).toBe(0);
      expect(Math.abs(resting.velocityMPerS)).toBe(0);
      expect(resting.mechanicalEnergyJ).toBe(0);
    }
  });

  it('has the correct square-root period scaling and no amplitude-dependent frequency', () => {
    const base = evaluateSpring(state());
    expect(evaluateSpring(state({massKg: 4})).periodS).toBeCloseTo(2 * base.periodS, 14);
    expect(evaluateSpring(state({stiffnessNPerM: 16})).periodS).toBeCloseTo(base.periodS / 2, 14);
    expect(evaluateSpring(state({initialDisplacementM: -0.5, initialVelocityMPerS: 2})).periodS).toBe(base.periodS);
    expect(base.frequencyHz * base.periodS).toBeCloseTo(1, 14);
  });

  it('satisfies Newton’s law and the time derivatives independently', () => {
    const p = {massKg: 2, stiffnessNPerM: 18, initialDisplacementM: -0.12, initialVelocityMPerS: 0.8, timeS: 0.37};
    const h = 1e-5;
    const centre = evaluateSpring(state(p));
    const before = evaluateSpring(state({...p, timeS: p.timeS - h}));
    const after = evaluateSpring(state({...p, timeS: p.timeS + h}));
    expect((after.displacementM - before.displacementM) / (2 * h)).toBeCloseTo(centre.velocityMPerS, 8);
    expect((after.velocityMPerS - before.velocityMPerS) / (2 * h)).toBeCloseTo(centre.accelerationMPerS2, 8);
    expect(p.massKg * centre.accelerationMPerS2).toBeCloseTo(centre.forceN, 13);
    expect(centre.forceN * centre.displacementM).toBeLessThanOrEqual(0);
  });

  it('conserves mechanical energy and bounds displacement for asymmetric states including all domain edges', () => {
    for (const massKg of [0.1, 1.7, 10]) for (const stiffnessNPerM of [1, 43, 200]) {
      for (const initialDisplacementM of [-0.5, 0, 0.31]) for (const initialVelocityMPerS of [-2, 0.7, 2]) {
        for (const timeS of [0, 0.1234, 7.3, 60]) {
          const result = evaluateSpring(state({massKg, stiffnessNPerM, initialDisplacementM, initialVelocityMPerS, timeS}));
          const independentEnergy = (stiffnessNPerM * initialDisplacementM ** 2 + massKg * initialVelocityMPerS ** 2) / 2;
          expect(Math.abs(result.mechanicalEnergyJ - independentEnergy)).toBeLessThan(1e-12 * Math.max(1, independentEnergy));
          expect(Math.abs(result.displacementM)).toBeLessThanOrEqual(result.amplitudeM + 1e-13);
          for (const value of Object.values(result)) if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });

  it('round-trips the exact scientific state and does not let callers mutate it by reference', () => {
    const original = state({massKg: 2.3, stiffnessNPerM: 37, initialDisplacementM: -0.17, initialVelocityMPerS: 0.6, timeS: 2.55});
    const result = evaluateSpring(original);
    expect(evaluateSpring(JSON.parse(JSON.stringify(result.state)))).toEqual(result);
    original.value.massKg = 9;
    expect(result.state.value.massKg).toBe(2.3);
    expect(evaluateSpring(idealSpringInitialState).mechanicalEnergyJ).toBeCloseTo(0.4, 14);
  });

  it.each([0, 4, 60])('provides SI-labelled plot samples from the same state at t=%s s', timeS => {
    const result = evaluateSpring(state({timeS}));
    const view = springView(result);
    expect(view.parameters.map(parameter => parameter.key)).toEqual(Object.keys(result.state.value));
    expect(view.plot.xUnit).toBe('s');
    expect(view.plot.yUnit).toBe('m');
    const points = view.plot.series[0]!.points;
    expect(points).toHaveLength(257);
    expect(points.at(-1)!.x - points[0]!.x).toBeCloseTo(2 * result.periodS, 12);
    expect(points[0]!.x).toBeGreaterThanOrEqual(0);
    expect(points.at(-1)!.x).toBeLessThanOrEqual(60);
    for (const point of points.filter((_, index) => index % 16 === 0)) {
      expect(point.y).toBeCloseTo(evaluateSpring(state({timeS: point.x})).displacementM, 13);
    }
    expect(view.diagram).toEqual({kind: 'spring', displacement: result.displacementM, amplitude: result.amplitudeM});
  });
});

describe('Strict scientific state boundary', () => {
  it.each([undefined, null, [], 'spring', {}, {schemaVersion: '2.0.0', value: state().value}, {...state(), extra: true}])('rejects incompatible state %j', candidate => {
    expect(() => parseSpringState(candidate)).toThrow(SpringStateError);
  });

  it.each([
    ['massKg', 0], ['massKg', -1], ['massKg', 0.099], ['massKg', 10.001],
    ['stiffnessNPerM', 0], ['stiffnessNPerM', -20], ['stiffnessNPerM', 201],
    ['initialDisplacementM', -0.501], ['initialDisplacementM', 0.501],
    ['initialVelocityMPerS', -2.001], ['initialVelocityMPerS', 2.001],
    ['timeS', -0.01], ['timeS', 60.01],
  ])('rejects %s outside the declared activity domain (%s)', (key, value) => {
    expect(() => evaluateSpring(state({[key]: value}))).toThrow(SpringStateError);
  });

  it('rejects missing fields, extra fields, implicit coercion and all non-finite quantities', () => {
    for (const key of Object.keys(state().value)) {
      for (const value of [undefined, null, true, '1', NaN, Infinity, -Infinity, {}, []]) {
        expect(() => parseSpringState(state({[key]: value}))).toThrow(SpringStateError);
      }
      const missing = state(); delete (missing.value as Record<string, unknown>)[key];
      expect(() => parseSpringState(missing)).toThrow(SpringStateError);
    }
    expect(() => parseSpringState(state({ignored: 1}))).toThrow(SpringStateError);
    const inherited = {schemaVersion: '1.0.0', value: Object.create(state().value)};
    expect(() => parseSpringState(inherited)).toThrow(SpringStateError);
  });
});
