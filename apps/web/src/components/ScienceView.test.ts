import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, it, expect} from 'vitest';
import type {PluginView} from '@ardesia/plugin-sdk';
import {ScienceView} from './ScienceView';

describe('scientific plot scale', () => {
  it.each([2e-6, -2e-6, 0])('keeps the profile legible and finite at axis velocity %s m/s', peak => {
    const view: PluginView = {title: 'Profilo sintetico', summary: 'Fixture di scala del renderer', parameters: [], metrics: [], explanation: [],
      plot: {xLabel: 'Diametro', xUnit: 'm', yLabel: 'Velocità', yUnit: 'm/s', series: [
        {id: 'velocity', label: 'Profilo', points: [{x: -.001, y: 0}, {x: 0, y: peak}, {x: .001, y: 0}]},
      ]}};
    const html = renderToStaticMarkup(createElement(ScienceView, {view}));
    const points = /<polyline[^>]*points="([^"]+)"/.exec(html)![1]!.split(' ').map(pair => pair.split(',').map(Number));
    expect(points.flat().every(Number.isFinite)).toBe(true);
    const height = Math.max(...points.map(p => p[1]!)) - Math.min(...points.map(p => p[1]!));
    if (peak) {expect(height).toBeGreaterThan(100);expect(height).toBeLessThan(146);}
    else expect(height).toBe(0);
  });
});
