import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {CompositionBodySchema, ExtensionDataSchema, extensionDefinitionDigest} from '@ardesia/contracts';
import {compileExpression} from '@ardesia/plugin-host';
import {PhysicsImportSchema} from './import';

const pack = PhysicsImportSchema.parse(JSON.parse(readFileSync(new URL('./data/sf-2026-elettricita-magnetismo.json', import.meta.url), 'utf8')));
const unit = pack.input.units.find(value => value.id === 'sf-2026-u6-05')!;
const document = pack.documents.find(value => value.id === unit.lesson!.documentId)!;
const lab = document.objects.find(value => value.type === 'extension' && value.data.definition.typeId === 'ardesia.physics.capacitor-constraints');
if (!lab || lab.type !== 'extension') throw Error('Capacitor lesson must contain its actual interactive model');
const data = lab.data, body = CompositionBodySchema.parse(data.definition.body);
const output = (id: string, state: Record<string, number> = {}) => {
  const node = body.nodes.find(value => value.id === id);
  if (!node) throw Error(id);
  return Number(compileExpression(String(node.props.expression))({...data.state, ...state}));
};

describe('dielectric insertion distinguishes fixed free charge from fixed voltage', () => {
  it('preserves portable definition identity and excludes singular or nonphysical states', async () => {
    expect(data.definitionDigest).toBe(await extensionDefinitionDigest(data.definition));
    expect(ExtensionDataSchema.safeParse(data).success).toBe(true);
    for (const state of [{C0: 0}, {V0: -1}, {kappa: 0}, {kappa: 11}]) {
      expect(ExtensionDataSchema.safeParse({...data, state: {...data.state, ...state}}).success).toBe(false);
    }
    for (const C0 of [0.1, 20]) for (const V0 of [1, 20]) for (const kappa of [1, 10]) {
      for (const node of body.nodes.filter(node => node.kind === 'value')) {
        expect(Number.isFinite(output(node.id, {C0, V0, kappa}))).toBe(true);
        expect(output(node.id, {C0, V0, kappa})).toBeGreaterThanOrEqual(0);
      }
    }
    expect(pack.status).toBe('DRAFT');
    expect(pack.humanApproval).toBe(false);
  });

  it('matches independently calculated SI energies and charges in both experiments', () => {
    // A 2 µF capacitor at 10 V holds 20 µC and 100 µJ before insertion.
    // Full insertion with κ=4: connected copy 8 µF, 80 µC, 400 µJ;
    // isolated copy retains 20 µC, falls to 2.5 V, and holds 25 µJ.
    for (const [id, expected] of Object.entries({capacitance: 8, initialCharge: 20, initialEnergy: 100,
      connectedVoltage: 10, connectedCharge: 80, connectedEnergy: 400, sourceWork: 600,
      isolatedCharge: 20, isolatedVoltage: 2.5, isolatedEnergy: 25})) {
      expect(output(id)).toBeCloseTo(expected, 10);
    }
    for (const kappa of [1, 1.5, 4, 10]) {
      const state = {C0: 3, V0: 8, kappa};
      // SI conversion is independent of the expressions distributed in the lab.
      const initialCoulombs = 3e-6 * 8, finalFarads = 3e-6 * kappa;
      expect(output('isolatedEnergy', state) * 1e-6).toBeCloseTo(initialCoulombs ** 2 / (2 * finalFarads), 12);
      expect(output('connectedEnergy', state) * 1e-6).toBeCloseTo(finalFarads * 8 ** 2 / 2, 12);
      expect(output('isolatedCharge', state)).toBe(24);
      expect(output('connectedVoltage', state)).toBe(8);
      for (const mode of ['isolated', 'connected']) {
        expect(output(mode + 'Energy', state)).toBeCloseTo(output(mode + 'Charge', state) * output(mode + 'Voltage', state) / 2, 10);
      }
      const fieldGain = output('connectedEnergy', state) - output('initialEnergy', state);
      expect(output('sourceWork', state)).toBeCloseTo(2 * fieldGain, 10);
    }
    expect(output('sourceWork', {kappa: 1})).toBe(0);
    expect(output('connectedEnergy', {kappa: 1})).toBe(output('isolatedEnergy', {kappa: 1}));
  });

  it('plots dimensionless energy ratios consistent with both experiments', () => {
    for (const k of [1, 2, 5, 10]) {
      for (const mode of ['connected', 'isolated']) {
        expect(output(mode + 'Plot', {k})).toBeCloseTo(output(mode + 'Energy', {kappa: k}) / output('initialEnergy'), 10);
        expect(body.nodes.find(node => node.id === mode + 'Plot')!.props.unit).toBe('κ (senza unità)');
      }
    }
    expect(output('connectedEnergy', {kappa: 2})).toBeLessThan(output('connectedEnergy', {kappa: 4}));
    expect(output('isolatedEnergy', {kappa: 2})).toBeGreaterThan(output('isolatedEnergy', {kappa: 4}));
  });
});
