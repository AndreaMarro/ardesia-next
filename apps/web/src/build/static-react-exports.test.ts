import {afterAll, expect, test} from 'vitest';
import {build} from 'vite';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {staticReactExports} from '../../../../tools/static-react-exports.mjs';

const require = createRequire(import.meta.url);
const originalEnvironment = process.env.NODE_ENV;
const originalHook = (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__;
afterAll(() => {
  process.env.NODE_ENV = originalEnvironment;
  (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = originalHook;
});

test('fails closed when any pinned React input changes; development remains untouched', () => {
  const plugin = staticReactExports();
  const transform = plugin.transform as (code: string, id: string) => {code: string} | undefined;
  const path = require.resolve('react');
  const code = readFileSync(path, 'utf8');
  expect(transform(code, path)?.code).toContain('export * from');
  expect(() => transform(code + '\n', path)).toThrow('Pinned React input changed');
  expect(transform('untouched', '/node_modules/react/cjs/react.development.js')).toBeUndefined();
  expect(plugin.apply).toBe('build');
});

test('real production exports, class behavior and startup ordering match the original packages', async () => {
  process.env.NODE_ENV = 'production';
  const events: string[] = [];
  (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    checkDCE: () => events.push('checkDCE'),
    inject: () => {events.push('inject'); return 1;},
  };
  const react = require('react'), dom = require('react-dom'), client = require('react-dom/client'), scheduler = require('scheduler');
  const expectedEvents = [...events];
  events.length = 0;
  const entry = '\0react-api-equivalence';
  const result = await build({
    configFile: false, logLevel: 'silent', plugins: [staticReactExports(), {
      name: 'real-react-api-fixture', resolveId: id => id === entry ? id : undefined,
      load: id => id === entry ? `import * as React from 'react'; import * as DOM from 'react-dom'; import * as Client from 'react-dom/client'; import * as Scheduler from 'scheduler'; export {React, DOM, Client, Scheduler};` : undefined,
    }],
    build: {write: false, minify: false, rollupOptions: {input: entry, preserveEntrySignatures: 'strict', output: {format: 'cjs'}}},
  });
  if (Array.isArray(result) || !('output' in result)) throw Error('Expected one real fixture bundle');
  const chunk = result.output.find(item => item.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw Error('Missing fixture JavaScript');
  const module = {exports: {} as Record<string, any>};
  runInNewContext(chunk.code, {module, exports: module.exports, console, performance, setTimeout, clearTimeout, setImmediate,
    __REACT_DEVTOOLS_GLOBAL_HOOK__: (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__});
  const actual = module.exports;
  expect(events).toEqual(expectedEvents);
  expect(events).toEqual(['checkDCE', 'checkDCE', 'inject']);
  for (const [name, original] of [['React', react], ['DOM', dom], ['Client', client], ['Scheduler', scheduler]] as const) {
    expect(Object.keys(actual[name]).filter(key => key !== 'default').sort()).toEqual(Object.keys(original).sort());
    for (const key of Object.keys(original)) expect(typeof actual[name][key]).toBe(typeof original[key]);
  }
  for (const api of [react, actual.React]) {
    const element = api.createElement('span', {id: 'same'}, 'child');
    expect(api.Children.count([element, null, 'text'])).toBe(3);
    expect(api.cloneElement(element, {id: 'next'}).props).toEqual({id: 'next', children: 'child'});
    const component = new api.Component({id: 'p'}, {});
    expect(component.props).toEqual({id: 'p'});
    expect(new api.PureComponent({}, {}).isPureReactComponent).toBe(true);
    expect(() => component.setState(12)).toThrow('takes an object');
  }
  expect(actual.React.default.createElement).toBe(actual.React.createElement);
  expect(actual.DOM.createPortal('same', {nodeType: 1}, 'key')).toEqual(dom.createPortal('same', {nodeType: 1}, 'key'));
  expect(() => actual.Client.createRoot(null)).toThrow('299');
  expect(() => client.createRoot(null)).toThrow('299');
  for (const api of [scheduler, actual.Scheduler]) await new Promise<void>(resolve => {
    let cancelledRan = false;
    const cancelled = api.unstable_scheduleCallback(api.unstable_NormalPriority, () => {cancelledRan = true;});
    api.unstable_cancelCallback(cancelled);
    api.unstable_scheduleCallback(api.unstable_NormalPriority, () => {expect(cancelledRan).toBe(false); resolve();});
  });
});
