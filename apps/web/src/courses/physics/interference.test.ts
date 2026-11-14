import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {CompositionBodySchema, ExtensionDataSchema, extensionDefinitionDigest, type CompositionNode} from '@ardesia/contracts';
import {compileExpression} from '@ardesia/plugin-host';
import {PhysicsImportSchema} from './import';

const pack = PhysicsImportSchema.parse(JSON.parse(readFileSync(new URL('./data/sf-2026-onde-ottica-radiazioni.json', import.meta.url), 'utf8')));
const unit = pack.input.units.find(value => value.id === 'sf-2026-u4-02')!;
const document = pack.documents.find(value => value.id === unit.lesson!.documentId)!;
const lab = document.objects.find(value => value.type === 'extension' && value.data.definition.typeId === 'ardesia.physics.interference');
if (!lab || lab.type !== 'extension') throw Error('The superposition lesson must contain its interactive model');
const data = lab.data, body = CompositionBodySchema.parse(data.definition.body);
const flatten = (nodes: CompositionNode[]): CompositionNode[] => nodes.flatMap(node => [node, ...flatten(node.children ?? [])]);
const nodes = flatten(body.nodes);
const evaluate = (expression: string, state: Record<string, number> = {}) => Number(compileExpression(expression)({...data.state, ...state}));
const output = (id: string, state: Record<string, number> = {}) => evaluate(String(nodes.find(node => node.id === id)!.props.expression), state);

describe('interference compares signed displacement on a shared fixed scale', () => {
  it('distributes a bounded portable model with the exact definition identity', async () => {
    expect(ExtensionDataSchema.safeParse(data).success).toBe(true);
    expect(data.definitionDigest).toBe(await extensionDefinitionDigest(data.definition));
    for (const state of [{A1: 0}, {A2: 3}, {phase: -1}, {phase: 361}, {time: 1.1}]) {
      expect(ExtensionDataSchema.safeParse({...data, state: {...data.state, ...state}}).success).toBe(false);
    }
    expect(pack.status).toBe('DRAFT');
    expect(pack.humanApproval).toBe(false);
  });

  it('distinguishes instantaneous displacement from amplitude and unequal cancellation', () => {
    expect(output('firstValue')).toBe(1);
    expect(output('secondValue')).toBe(-0.5);
    expect(output('sumValue')).toBe(0.5);
    expect(output('resultantAmplitude')).toBeCloseTo(1, 12);
    expect(output('resultantAmplitude', {phase: 0})).toBe(2);
    expect(output('resultantAmplitude', {phase: 180})).toBe(0);
    expect(output('resultantAmplitude', {phase: 360})).toBe(2);
    expect(output('resultantAmplitude', {A1: 1, A2: 2, phase: 180})).toBe(1);
    // Quadrature gives a right-angled phasor triangle with sides 1, 2, √5.
    expect(output('resultantAmplitude', {A1: 1, A2: 2, phase: 90})).toBeCloseTo(Math.sqrt(5), 12);
    for (const time of [0, 0.125, 0.25, 0.375, 0.5, 0.875, 1]) {
      expect(output('sumValue', {phase: 180, time})).toBe(0);
      expect(output('sumValue', {phase: 0, time})).toBeCloseTo(2 * output('firstValue', {time}), 6);
    }
    expect(output('sumValue', {time: 0.625})).toBe(output('sumValue', {time: 0.125}));
  });

  it('keeps the amplitude within triangle bounds for all permitted phase quadrants', () => {
    for (const A1 of [0.1, 0.7, 2]) for (const A2 of [0.1, 1.3, 2]) for (const phase of [0, 60, 90, 120, 180, 270, 360]) {
      const state = {A1, A2, phase}, amplitude = output('resultantAmplitude', state);
      expect(amplitude).toBeGreaterThanOrEqual(Math.abs(A1 - A2) - 1e-10);
      expect(amplitude).toBeLessThanOrEqual(A1 + A2 + 1e-10);
      for (const time of [0, 0.125, 0.25, 0.375]) {
        expect(Math.abs(output('sumValue', {...state, time}))).toBeLessThanOrEqual(amplitude + 1e-6);
      }
    }
  });

  it('draws every curve in the same physical coordinates and shows cancellation as a flat line', () => {
    const scene = nodes.find(node => node.id === 'sharedScene')!;
    expect(scene.props.width).toBe(600);
    expect(scene.props.height).toBe(280);
    const segments = scene.children!.filter(node => /^(first|second|sum)\d+$/.test(node.id));
    expect(segments).toHaveLength(144);
    for (let i = 0; i < 48; i++) {
      const first = segments.find(node => node.id === 'first' + i)!, second = segments.find(node => node.id === 'second' + i)!, sum = segments.find(node => node.id === 'sum' + i)!;
      const y = (node: CompositionNode, phase: number) => evaluate(String(node.props.y), {phase});
      const end = (node: CompositionNode, phase: number) => y(node, phase) + evaluate(String(node.props.height), {phase});
      for (const phase of [0, 120, 180]) {
        expect(evaluate(String(sum.props.x))).toBeCloseTo(50 + 500 * i / 48, 10);
        expect(y(sum, phase) - 140).toBeCloseTo(y(first, phase) + y(second, phase) - 280, 10);
        expect(end(sum, phase) - 140).toBeCloseTo(end(first, phase) + end(second, phase) - 280, 10);
      }
      expect(y(sum, 180)).toBeCloseTo(140, 10);
      expect(end(sum, 180)).toBeCloseTo(140, 10);
    }
    for (const A1 of [0.1, 2]) for (const A2 of [0.1, 2]) for (const phase of [0, 90, 180, 270, 360]) {
      for (const node of scene.children!) {
        for (const coordinate of ['x', 'y', 'width', 'height']) {
          expect(Number.isFinite(evaluate(String(node.props[coordinate]), {A1, A2, phase}))).toBe(true);
        }
        if (node.props.shape === 'line') {
          const y = evaluate(String(node.props.y), {A1, A2, phase});
          const end = y + evaluate(String(node.props.height), {A1, A2, phase});
          expect(Math.min(y, end)).toBeGreaterThanOrEqual(0);
          expect(Math.max(y, end)).toBeLessThanOrEqual(280);
        }
      }
    }
  });
});
