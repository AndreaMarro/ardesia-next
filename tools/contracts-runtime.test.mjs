import test from 'node:test';
import assert from 'node:assert/strict';
// This consumer deliberately uses native Node, like the operator CLI. Vite's
// resolver would conceal missing extensions in the public contract graph.
import {canonicalJson, ProgramBodySchema, projectDocumentRevision} from '@ardesia/contracts';

test('the public contracts load under native Node without a bundler or private imports', () => {
  assert.equal(canonicalJson({b: 2, a: 1}), '{"a":1,"b":2}');
  assert.equal(ProgramBodySchema.safeParse({code: 'function update({state}) { return {state,view:{tag:"p"}} }', initialState: {}}).success, true);
  assert.equal(typeof projectDocumentRevision, 'function');
});
