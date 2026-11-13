import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {CompositionBodySchema, ExtensionDataSchema, extensionDefinitionDigest, type CompositionNode} from '@ardesia/contracts';
import {compileExpression} from '@ardesia/plugin-host';
import {PhysicsImportSchema} from './import';

const pack = PhysicsImportSchema.parse(JSON.parse(readFileSync(new URL('./data/sf-2026-termodinamica.json', import.meta.url), 'utf8')));
const unit = pack.input.units.find(value => value.id === 'sf-2026-u5-05')!;
const document = pack.documents.find(value => value.id === unit.lesson!.documentId)!;
const lab = document.objects.find(value => value.type === 'extension' && value.data.definition.typeId === 'ardesia.physics.heat-engine');
if (!lab || lab.type !== 'extension') throw Error('The second-principle lesson must contain its model');
const data = lab.data, body = CompositionBodySchema.parse(data.definition.body);
const flatten = (nodes: CompositionNode[]): CompositionNode[] => nodes.flatMap(node => [node, ...flatten(node.children ?? [])]);
const nodes = flatten(body.nodes);
const evaluate = (expression: string, state: Record<string, number> = {}) => compileExpression(expression)({...data.state, ...state});
const value = (id: string, state: Record<string, number> = {}) => evaluate(String(nodes.find(node => node.id === id)!.props.expression), state);

describe('two-reservoir heat-engine proposals require two independent physical checks', () => {
  it('distributes the exact bounded model and preserves scientific draft status', async () => {
    expect(ExtensionDataSchema.safeParse(data).success).toBe(true);
    expect(data.definitionDigest).toBe(await extensionDefinitionDigest(data.definition));
    for (const state of [{Th: 0}, {Th: 350}, {Tc: 400}, {Qh: 0}, {eta: -1}, {eta: 101}]) {
      expect(ExtensionDataSchema.safeParse({...data, state: {...data.state, ...state}}).success).toBe(false);
    }
    expect(pack.status).toBe('DRAFT'); expect(pack.humanApproval).toBe(false);
  });

  it('rejects an energy-conserving proposal when the entropy balance is negative', () => {
    expect(value('carnot')).toBe(40);
    expect(value('work')).toBe(270); expect(value('coldHeat')).toBe(630);
    expect(value('totalEntropy')).toBe(0.3);
    expect(value('diagnosis')).toBe('Bilanci compatibili: variazione totale di entropia positiva.');
    expect(value('totalEntropy', {eta: 40})).toBe(0);
    expect(value('diagnosis', {eta: 40})).toBe('Limite reversibile: variazione totale di entropia nulla.');
    expect(value('work', {eta: 60})).toBe(540); expect(value('coldHeat', {eta: 60})).toBe(360);
    expect(value('energyResidual', {eta: 60})).toBe(0);
    expect(value('totalEntropy', {eta: 60})).toBe(-0.6);
    expect(value('diagnosis', {eta: 60})).toBe('Incompatibile: variazione totale di entropia negativa.');
    // Conversion of all input heat to work is energy-conserving, but violates Kelvin–Planck here.
    expect(value('energyResidual', {eta: 100})).toBe(0);
    expect(value('coldHeat', {eta: 100})).toBe(0);
    expect(value('diagnosis', {eta: 100})).toMatch(/^Incompatibile/);
  });

  it('agrees with independent SI balances, scales extensive quantities and respects the Kelvin limit', () => {
    for (const Th of [400, 550, 800]) for (const Tc of [250, 300, 350]) for (const Qh of [100, 900, 2000]) {
      const limit = 1 - Tc / Th;
      for (const eta of [0, 30, 60, 100]) {
        const state = {Th, Tc, Qh, eta}, W = Qh * eta / 100, Qc = Qh - W;
        expect(value('work', state)).toBeCloseTo(W, 6);
        expect(value('coldHeat', state)).toBeCloseTo(Qc, 6);
        expect(value('totalEntropy', state)).toBeCloseTo(Qc / Tc - Qh / Th, 6);
        expect(value('energyResidual', state)).toBe(0);
        if (Math.abs(eta / 100 - limit) > 1e-8) expect(String(value('diagnosis', state)).startsWith('Incompatibile')).toBe(eta / 100 > limit);
      }
      expect(value('totalEntropy', {Th, Tc, Qh, eta: 100 * limit})).toBe(0);
      expect(value('diagnosis', {Th, Tc, Qh, eta: 100 * limit})).toMatch(/^Limite reversibile/);
    }
    for (const key of ['work','coldHeat','hotEntropy','coldEntropy','totalEntropy']) expect(value(key, {Qh: 1800})).toBeCloseTo(2 * Number(value(key)), 6);
    expect(value('carnot', {Qh: 1800})).toBe(value('carnot'));
    expect(value('carnot', {Th: 600})).toBe(50);
  });

  it('keeps input heat and the combined output on the same fixed energy scale', () => {
    const shape = (id: string, state: Record<string, number>) => {
      const props = nodes.find(node => node.id === id)!.props;
      return Object.fromEntries(['x','y','width','height'].map(k => [k, Number(evaluate(String(props[k]), state))]));
    };
    for (const Qh of [100, 900, 2000]) for (const eta of [0, 30, 40, 60, 100]) {
      const state = {Qh, eta}, input = shape('inputHeat', state), work = shape('workBar', state), cold = shape('coldBar', state);
      expect(input.width).toBe(Qh / 4);
      expect(work.width! + cold.width!).toBeCloseTo(input.width!, 10);
      expect(cold.x).toBeCloseTo(work.x! + work.width!, 10);
      expect(cold.x! + cold.width!).toBeCloseTo(input.x! + input.width!, 10);
      for (const row of [input, work, cold]) {
        expect(Object.values(row).every(Number.isFinite)).toBe(true);
        expect(row.width).toBeGreaterThanOrEqual(0);
        expect(row.x! + row.width!).toBeLessThanOrEqual(550);
      }
    }
  });
});
