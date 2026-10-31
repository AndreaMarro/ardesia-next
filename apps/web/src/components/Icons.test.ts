import {createElement, type ComponentProps} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import * as lucide from 'lucide-react';
import packageLock from '../../../../package-lock.json' with {type: 'json'};
import * as icons from './Icons';

// These are the actual imports in App and its seven icon-consuming components.
// The pinned package remains the independent geometry/accessibility reference.
const names = [
  'ArrowUpRight', 'Check', 'Download', 'FlaskConical', 'History', 'Layers3',
  'LibraryBig', 'Link2', 'MousePointer2', 'NotebookPen', 'Plus', 'Power', 'Save',
  'Search', 'Settings2', 'ShieldCheck', 'SquareFunction', 'SquarePen', 'Trash2',
  'Type', 'Undo2', 'X',
] as const satisfies readonly (keyof typeof icons)[];
// React's SVG type omits the generic title attribute, which both renderers
// nevertheless accept at runtime and recognize when deciding aria-hidden.
type Props = ComponentProps<typeof icons.X> & {title?: string};
const variants: {name: string; props: Props}[] = [
  {name: 'default decorative icon', props: {}},
  ...[15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25].map(size => ({name: `consumer size ${size}`, props: {size}})),
  {name: 'explicitly hidden source icon', props: {size: 19, 'aria-hidden': true}},
  {name: 'labelled icon', props: {size: 18, 'aria-label': 'Descrizione'}},
  {name: 'SVG colour, stroke and class props', props: {size: 21, strokeWidth: 1.5, color: '#123456', className: 'consumer-icon'}},
  {name: 'dimensions, role, title and duplicate classes', props: {size: 23, width: 31, height: 17, role: 'img', title: 'Titolo', className: 'lucide consumer-icon consumer-icon'}},
  {name: 'accessible title child', props: {size: 22, children: createElement('title', {key: 'label'}, 'Descrizione icona')}},
];

/** Normalize attribute ORDER only; preserve every attribute value, SVG node and text. */
function normalizedMarkup(markup: string): unknown[] {
  const tokens = markup.match(/<[^>]*>|[^<]+/g) ?? [];
  if (tokens.join('') !== markup) throw Error('Unexpected incomplete SVG markup.');
  return tokens.map(token => {
    if (!token.startsWith('<')) return ['text', token];
    const closing = /^<\/([A-Za-z][\w:.-]*)>$/.exec(token);
    if (closing) return ['close', closing[1]];
    const opening = /^<([A-Za-z][\w:.-]*)([\s\S]*?)(\/?)>$/.exec(token);
    if (!opening) throw Error('Unexpected SVG tag: ' + token);
    const rawAttributes = opening[2]!;
    const attributePattern = /\s+([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
    const attributes = [...rawAttributes.matchAll(attributePattern)].map(match => [match[1]!, match[2]!] as const);
    if (rawAttributes.replace(attributePattern, '').trim()
      || new Set(attributes.map(([name]) => name)).size !== attributes.length) {
      throw Error('Unexpected SVG attributes: ' + token);
    }
    return ['open', opening[1], attributes.sort(([left], [right]) => left.localeCompare(right)), opening[3]];
  });
}

describe('application icons preserve the pinned Lucide SVG and accessibility output', () => {
  it('covers every application icon against lucide-react 1.63.0 with all 17 consumer variants', () => {
    expect(packageLock.packages['node_modules/lucide-react'].version).toBe('1.63.0');
    expect(Object.keys(icons).sort()).toEqual([...names].sort());
    expect(names.length * variants.length).toBe(374);
  });

  it.each(names)('%s retains every SVG node and attribute', name => {
    for (const variant of variants) {
      const expected = renderToStaticMarkup(createElement(lucide[name], variant.props));
      const actual = renderToStaticMarkup(createElement(icons[name], variant.props));
      expect(normalizedMarkup(actual), `${name}: ${variant.name}`).toEqual(normalizedMarkup(expected));
    }
  });
});
